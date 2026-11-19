(() => {
  const $ = (selector) => document.querySelector(selector);
  const apiBase = 'https://unabashed-tackle-claw.ngrok-free.dev/bloodline-api';
  const tokenKey = 'bloodline-management-session';
  const statusNames = {
    new: 'Nouvelle', to_contact: 'À contacter', in_discussion: 'En discussion',
    scheduled: 'Rendez-vous confirmé', done: 'Terminé', cancelled: 'Annulé'
  };
  const viewNames = {
    dashboard: ['Gestion du salon', 'Tableau de bord · demandes et rendez-vous à venir.'],
    requests: ['Demandes & projets', 'Chaque projet garde ses échanges et son rendez-vous au même endroit.'],
    appointments: ['Rendez-vous', 'Les rendez-vous confirmés par l’équipe.'],
    service: ['Mon service', 'Vos heures enregistrées par le salon.'],
    access: ['Accès & rôles', 'Les comptes et droits de votre équipe.'],
    'team-hours': ['Heures de l’équipe', 'Les services enregistrés par mois et par personne.']
  };
  const date = (value) => new Intl.DateTimeFormat('fr-BE', {
    timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short'
  }).format(new Date(value));
  const briefDate = (value) => new Intl.DateTimeFormat('fr-BE', {
    timeZone: 'Europe/Brussels', dateStyle: 'short', timeStyle: 'short'
  }).format(new Date(value));
  const status = (message) => { $('#status').textContent = message; };
  let sessionToken = '';
  try { sessionToken = sessionStorage.getItem(tokenKey) || ''; } catch { /* Storage may be disabled. */ }
  const setSessionToken = (token) => {
    sessionToken = token;
    try {
      if (token) sessionStorage.setItem(tokenKey, token);
      else sessionStorage.removeItem(tokenKey);
    } catch { /* Keep the session in memory until this page closes. */ }
  };
  let member = null;
  let openSession = null;
  let tick = null;
  let pendingActivation = null;
  let activeView = '';
  let requestItems = [];
  let selectedRequest = null;
  let accessData = null;
  let teamHoursData = null;

  function showAuth(id) {
    $('#auth-shell').hidden = false;
    $('#workspace').hidden = true;
    $('#topbar-session').hidden = true;
    for (const panel of ['setup-panel', 'login-panel', 'activate-panel']) $(`#${panel}`).hidden = panel !== id;
  }

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...options.headers };
    const response = await fetch(`${apiBase}/api${path}`, { ...options, credentials: 'omit', cache: 'no-store', headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && path !== '/login' && path !== '/activate') {
        setSessionToken(''); showAuth('login-panel');
      }
      const error = new Error(data.detail || 'La requête a échoué.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function formatDuration(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    return [Math.floor(whole / 3600), Math.floor(whole % 3600 / 60), whole % 60]
      .map((part) => String(part).padStart(2, '0')).join(':');
  }

  function clock() {
    $('#clock').textContent = openSession
      ? formatDuration((Date.now() - Date.parse(openSession.started_at)) / 1000) : '00:00:00';
  }

  function renderService(sessions) {
    openSession = sessions.find((item) => !item.ended_at) || null;
    $('#shift-action').textContent = openSession ? 'Terminer mon service' : 'Prendre mon service';
    $('#shift-state').textContent = openSession ? `Service commencé le ${date(openSession.started_at)}.` : 'Aucun service en cours.';
    const history = $('#history'); history.replaceChildren();
    for (const session of sessions.filter((item) => item.ended_at)) {
      const row = document.createElement('div'); row.className = 'history-row';
      const when = document.createElement('span'); when.textContent = `${date(session.started_at)} → ${date(session.ended_at)}`;
      const duration = document.createElement('strong'); duration.textContent = formatDuration((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000);
      row.append(when, duration); history.append(row);
    }
    if (!history.childElementCount) history.textContent = 'Aucun service terminé.';
    clock(); clearInterval(tick); tick = setInterval(clock, 1000);
  }

  function empty(container, message) {
    const text = document.createElement('p'); text.className = 'empty-state'; text.textContent = message;
    container.replaceChildren(text);
  }

  function recordButton(item, kind) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'record-button';
    if (selectedRequest?.id === (kind === 'appointment' ? item.request_id : item.id)) button.classList.add('is-selected');
    const identity = document.createElement('span'); identity.className = 'record-identity';
    const name = document.createElement('strong'); name.textContent = item.client_name;
    const meta = document.createElement('small');
    meta.textContent = kind === 'appointment'
      ? [item.project_type, item.artist_name ? `avec ${item.artist_name}` : 'Artiste à préciser'].filter(Boolean).join(' · ')
      : item.project_type || item.reference;
    identity.append(name, meta);
    const badge = document.createElement('span'); badge.className = 'record-badge';
    badge.dataset.status = kind === 'appointment' ? 'scheduled' : item.status;
    badge.textContent = kind === 'appointment' ? 'Confirmé' : statusNames[item.status] || item.status;
    const when = document.createElement('time'); when.className = 'record-when';
    when.dateTime = kind === 'appointment' ? item.scheduled_at : item.created_at;
    when.textContent = briefDate(when.dateTime);
    button.append(identity, badge, when);
    button.addEventListener('click', () => openRequest(kind === 'appointment' ? item.request_id : item.id));
    return button;
  }

  function renderRecords(container, items, kind, emptyText) {
    if (!items.length) return empty(container, emptyText);
    container.replaceChildren(...items.map((item) => recordButton(item, kind)));
  }

  async function loadDashboard() {
    const data = await request('/dashboard');
    $('#stat-new').textContent = data.new;
    $('#stat-contact').textContent = data.to_contact;
    $('#stat-appointments').textContent = data.scheduled;
    $('#stat-discussion').textContent = data.in_discussion;
    renderRecords($('#recent-requests'), data.recent, 'request', 'Aucune demande reçue pour le moment.');
    renderRecords($('#next-appointments'), data.appointments, 'appointment', 'Aucun rendez-vous confirmé pour le moment.');
  }

  function renderRequestList() {
    const query = $('#request-search').value.trim().toLocaleLowerCase('fr');
    const filter = $('#request-filter').value;
    const filtered = requestItems.filter((item) => (!filter || item.status === filter) &&
      (!query || `${item.client_name} ${item.phone} ${item.reference}`.toLocaleLowerCase('fr').includes(query)));
    renderRecords($('#request-list'), filtered, 'request', requestItems.length
      ? 'Aucune demande ne correspond à cette recherche.' : 'Aucune demande reçue pour le moment.');
  }

  async function loadRequests() {
    requestItems = (await request('/requests')).items;
    renderRequestList();
  }

  async function loadAppointments() {
    const items = (await request('/appointments')).items;
    renderRecords($('#appointments-list'), items, 'appointment', 'Aucun rendez-vous confirmé pour le moment.');
  }

  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function clearInviteCode() {
    $('#invite-code').textContent = '';
    $('#invite-result').hidden = true;
  }

  function showInviteCode(code) {
    $('#invite-code').textContent = code;
    $('#invite-result').hidden = false;
  }

  function roleOptions(select, chosen, includeProtected = false) {
    select.replaceChildren(...accessData.roles.filter((role) => includeProtected || !role.protected)
      .map((role) => {
        const option = node('option', '', role.name);
        option.value = role.slug;
        option.selected = role.slug === chosen;
        return option;
      }));
  }

  function renderAccess(data) {
    accessData = data;
    $('#member-count').textContent = `${data.members.filter((item) => item.active).length} actifs`;
    const memberList = $('#access-members');
    memberList.replaceChildren(...data.members.map((item) => {
      const row = node('article', 'access-member');
      const heading = node('div', 'access-member-heading');
      heading.append(node('strong', '', item.display_name), node('small', '', `@${item.username} · ${item.active ? item.activation_required ? 'Invitation en attente' : 'Actif' : 'Désactivé'}`));
      row.append(heading);
      if (item.role_slug === 'superadmin') {
        row.append(node('span', 'protected-label', item.role_name));
      } else {
        const controls = node('div', 'access-member-actions');
        const label = node('label', '', 'Rôle');
        const select = node('select');
        select.setAttribute('aria-label', `Rôle de ${item.display_name}`);
        roleOptions(select, item.role_slug);
        select.addEventListener('change', async () => {
          select.disabled = true;
          try {
            renderAccess(await request(`/members/${item.id}`, { method: 'POST', body: JSON.stringify({ role_slug: select.value, active: Boolean(item.active) }) }));
            status('Rôle enregistré.');
          } catch (error) { select.value = item.role_slug; status(error.message); }
          select.disabled = false;
        });
        const active = node('button', 'button-quiet', item.active ? 'Désactiver' : 'Réactiver');
        active.type = 'button';
        active.addEventListener('click', async () => {
          active.disabled = true;
          try {
            renderAccess(await request(`/members/${item.id}`, { method: 'POST', body: JSON.stringify({ role_slug: select.value, active: !item.active }) }));
            status(item.active ? 'Compte désactivé.' : 'Compte réactivé.');
          } catch (error) { status(error.message); active.disabled = false; }
        });
        const reset = node('button', 'button-quiet', 'Renouveler le code');
        reset.type = 'button';
        reset.hidden = !item.active;
        reset.addEventListener('click', async () => {
          reset.disabled = true;
          try {
            const result = await request(`/members/${item.id}/reset`, { method: 'POST' });
            renderAccess(result); showInviteCode(result.code);
            status(`Nouveau code créé pour ${item.display_name}. L’ancien mot de passe est invalidé.`);
          } catch (error) { status(error.message); reset.disabled = false; }
        });
        controls.append(label, select, active, reset);
        row.append(controls);
      }
      return row;
    }));
    roleOptions($('#invite-role'));
    const roles = $('#access-roles');
    roles.replaceChildren(...data.roles.map((role) => {
      const button = node('button', 'role-item');
      button.type = 'button';
      button.append(node('strong', '', role.name), node('small', '', role.protected ? 'Protégé' : `${data.members.filter((item) => item.role_slug === role.slug).length} compte(s)`));
      button.addEventListener('click', () => selectRole(role));
      return button;
    }));
    const events = $('#access-events');
    events.replaceChildren(...data.events.map((item) => {
      const row = node('div', 'access-event');
      row.append(node('strong', '', `${item.action} · ${item.target}`), node('small', '', `${item.author} · ${date(item.created_at)}`));
      return row;
    }));
    if (!data.events.length) events.append(node('p', 'empty-state', 'Aucune modification pour le moment.'));
  }

  async function loadAccess() {
    renderAccess(await request('/access'));
  }

  function hours(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  function localMonth() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit'
    }).formatToParts(new Date()).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}`;
  }

  function renderTeamHours(data) {
    teamHoursData = data;
    $('#team-hours-total').textContent = hours(data.total_seconds);
    $('#team-hours-export').disabled = !data.members.some((item) => item.sessions.length);
    const container = $('#team-hours-members');
    container.replaceChildren(...data.members.map((item) => {
      const panel = node('details', 'team-hours-member');
      const summary = node('summary');
      const identity = node('span', 'team-hours-identity');
      identity.append(node('strong', '', item.display_name), node('small', '', `@${item.username}${item.active ? '' : ' · compte désactivé'}`));
      const total = node('span', 'team-hours-number', hours(item.seconds));
      summary.append(identity, total);
      if (item.open) summary.append(node('span', 'open-indicator', 'Service en cours'));
      panel.append(summary);
      if (!item.sessions.length) panel.append(node('p', 'empty-state', 'Aucun service sur ce mois.'));
      for (const session of item.sessions) {
        const row = node('div', 'team-hours-session');
        row.append(node('span', '', `${date(session.started_at)} → ${session.ended_at ? date(session.ended_at) : 'En cours'}`),
          node('strong', '', hours(session.seconds)));
        panel.append(row);
      }
      return panel;
    }));
    if (!data.members.length) container.append(node('p', 'empty-state', 'Aucun compte ni service pour cette période.'));
  }

  async function loadTeamHours() {
    if (!$('#team-month').value) $('#team-month').value = localMonth();
    renderTeamHours(await request(`/team-hours?month=${encodeURIComponent($('#team-month').value)}`));
  }

  function csvCell(value) {
    const text = String(value ?? '');
    const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }

  function exportTeamHours() {
    if (!teamHoursData) return;
    const rows = [['Compte', 'Nom', 'Début', 'Fin', 'Durée en heures', 'Statut']];
    for (const memberRow of teamHoursData.members) {
      for (const session of memberRow.sessions) rows.push([
        memberRow.username, memberRow.display_name, date(session.started_at),
        session.ended_at ? date(session.ended_at) : '', (session.seconds / 3600).toFixed(2).replace('.', ','),
        session.ended_at ? 'Terminé' : 'En cours'
      ]);
    }
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = node('a'); link.href = url; link.download = `bloodline-heures-${teamHoursData.month}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function selectRole(role = null) {
    $('#role-slug').value = role?.slug || '';
    $('#role-name').value = role?.name || '';
    for (const input of $('#role-permissions').querySelectorAll('input')) {
      input.checked = Boolean(role?.[input.name]);
      input.disabled = Boolean(role?.protected);
    }
    $('#role-submit').textContent = role ? 'Enregistrer le rôle' : 'Ajouter ce rôle';
    $('#role-cancel').hidden = !role;
    $('#role-delete').hidden = !role || Boolean(role.protected);
    if (role) $('#role-name').focus();
  }

  async function switchView(name) {
    if (!viewNames[name] || (['access', 'team-hours'].includes(name) && member?.role !== 'superadmin') ||
      (['dashboard', 'requests', 'appointments'].includes(name) && !member?.projects)) return;
    if (activeView === 'access' && name !== 'access') clearInviteCode();
    $('#topbar-session').open = false;
    activeView = name;
    $('#workspace').dataset.view = name;
    for (const panel of document.querySelectorAll('.workspace-view')) panel.hidden = panel.id !== `${name}-view`;
    for (const button of document.querySelectorAll('.workspace-nav [data-view]')) {
      if (button.dataset.view === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    $('#view-title').textContent = viewNames[name][0];
    $('#view-description').textContent = viewNames[name][1];
    status('');
    try {
      if (name === 'dashboard') await loadDashboard();
      if (name === 'requests') await loadRequests();
      if (name === 'appointments') await loadAppointments();
      if (name === 'access') await loadAccess();
      if (name === 'team-hours') await loadTeamHours();
    } catch (error) { status(error.message || 'Impossible de charger les données. Réessayez.'); }
  }

  function detailField(label, value) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const description = document.createElement('dd'); description.textContent = value || 'Non renseigné';
    wrapper.append(term, description);
    return wrapper;
  }

  function appointmentInputDate(value) {
    if (!value) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function renderHistory(container, items, textKey, emptyText) {
    if (!items.length) return empty(container, emptyText);
    container.replaceChildren(...items.map((item) => {
      const article = document.createElement('article');
      const content = document.createElement('p'); content.textContent = item[textKey];
      const byline = document.createElement('small'); byline.textContent = `${item.author} · ${date(item.created_at)}`;
      article.append(content, byline); return article;
    }));
  }

  function renderDetail(detail) {
    selectedRequest = detail;
    $('#request-detail').hidden = false; $('#detail-placeholder').hidden = true;
    $('#detail-reference').textContent = detail.reference;
    $('#detail-name').textContent = detail.client_name;
    $('#detail-fields').replaceChildren(
      detailField('Numéro', detail.phone), detailField('Statut', statusNames[detail.status] || detail.status),
      detailField('Type de projet', detail.project_type), detailField('Création souhaitée', detail.creation_type),
      detailField('Personnes', detail.group_size ? String(detail.group_size) : ''),
      detailField('Emplacement', detail.placement), detailField('Disponibilités proposées', detail.availability),
      detailField('Motif ou idée', detail.idea), detailField('Demande reçue', date(detail.created_at))
    );
    $('#detail-status').value = detail.status;
    const appointment = detail.appointment;
    $('#appointment-current').textContent = appointment?.status === 'scheduled'
      ? `Confirmé le ${date(appointment.scheduled_at)}${appointment.artist_name ? ` avec ${appointment.artist_name}` : ''}.`
      : 'Aucun rendez-vous confirmé.';
    $('#appointment-when').value = appointment?.status === 'scheduled' ? appointmentInputDate(appointment.scheduled_at) : '';
    $('#appointment-artist').value = appointment?.status === 'scheduled' ? appointment.artist_name : '';
    renderHistory($('#detail-notes'), detail.notes, 'body', 'Aucune note pour ce projet.');
    renderHistory($('#detail-events'), detail.events, 'detail', 'Aucun changement enregistré.');
    renderRequestList();
  }

  async function openRequest(id) {
    if (activeView !== 'requests') await switchView('requests');
    try {
      renderDetail(await request(`/requests/${id}`));
      if (window.matchMedia('(max-width:760px)').matches) $('#request-detail').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (error) { status(error.message || 'Impossible d’ouvrir cette fiche.'); }
  }

  async function refresh() {
    let data;
    try { data = await request('/me'); }
    catch (error) {
      member = null; openSession = null; clearInterval(tick); showAuth('login-panel');
      if (error.status !== 401) status('Impossible de charger votre profil. Réessayez.');
      return;
    }
    member = data.member;
    $('#topbar-member-name').textContent = member.display_name;
    $('#topbar-member-role').textContent = member.role_name || '';
    $('#session-avatar').textContent = [...member.display_name.trim()][0]?.toLocaleUpperCase('fr') || 'B';
    $('#topbar-session').hidden = false;
    for (const element of document.querySelectorAll('[data-manager-only]')) element.hidden = !member.projects;
    for (const element of document.querySelectorAll('[data-access-only]')) element.hidden = member.role !== 'superadmin';
    renderService(data.sessions);
    $('#auth-shell').hidden = true; $('#workspace').hidden = false;
    await switchView(activeView || (member.projects ? 'dashboard' : 'service'));
  }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); status('Connexion en cours…');
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      const username = $('#username').value.trim();
      const code = $('#password').value;
      const result = await request('/login', { method: 'POST', body: JSON.stringify({ username, password: code }) });
      $('#password').value = '';
      if (result.setup_required) {
        pendingActivation = { username, code }; showAuth('activate-panel');
        status('Choisissez votre mot de passe pour terminer la première connexion.');
        $('#activate-password').focus();
      } else { setSessionToken(result.token); status(''); await refresh(); }
    } catch (error) { status(error.message || 'Connexion impossible. Vérifiez vos identifiants et réessayez.'); }
    button.disabled = false;
  });

  $('#activate-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!pendingActivation) { showAuth('login-panel'); return; }
    const next = $('#activate-password').value;
    if (next !== $('#activate-confirm').value) { status('Les deux mots de passe sont différents.'); return; }
    const button = event.currentTarget.querySelector('button'); button.disabled = true; status('Création du mot de passe…');
    try {
      const result = await request('/activate', { method: 'POST', body: JSON.stringify({ ...pendingActivation, new_password: next }) });
      setSessionToken(result.token); pendingActivation = null; event.currentTarget.reset(); status('Mot de passe créé.'); await refresh();
    } catch (error) { status(error.message || 'Impossible de créer le mot de passe. Réessayez.'); }
    button.disabled = false;
  });
  $('#activate-back').addEventListener('click', () => {
    pendingActivation = null; $('#activate-form').reset(); status(''); showAuth('login-panel'); $('#username').focus();
  });
  $('#logout').addEventListener('click', async () => {
    try { await request('/logout', { method: 'POST' }); } catch { /* Expired sessions are already invalid. */ }
    clearInviteCode();
    setSessionToken(''); clearInterval(tick); member = null; openSession = null; activeView = '';
    status('Vous êtes déconnecté.'); showAuth('login-panel');
  });

  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => switchView(button.dataset.view));
  $('#invite-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true; clearInviteCode();
    try {
      const result = await request('/members/invite', { method: 'POST', body: JSON.stringify({
        username: $('#invite-username').value, display_name: $('#invite-name').value, role_slug: $('#invite-role').value
      }) });
      renderAccess(result); showInviteCode(result.code);
      event.currentTarget.reset(); status('Compte créé. Transmettez le nom de compte et le code temporaire à cette personne.');
    } catch (error) { status(error.message || 'Impossible de créer le compte.'); }
    button.disabled = false;
  });
  $('#copy-code').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#invite-code').textContent); status('Code copié.'); }
    catch { status('Copie impossible : sélectionnez le code affiché.'); }
  });
  $('#role-cancel').addEventListener('click', () => selectRole());
  $('#role-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#role-submit'); button.disabled = true;
    const permissions = Object.fromEntries([...$('#role-permissions').querySelectorAll('input')].map((input) => [input.name, input.checked]));
    try {
      renderAccess(await request('/roles', { method: 'POST', body: JSON.stringify({
        slug: $('#role-slug').value, name: $('#role-name').value, ...permissions
      }) }));
      selectRole(); status('Rôle enregistré.');
    } catch (error) { status(error.message || 'Impossible d’enregistrer ce rôle.'); }
    button.disabled = false;
  });
  $('#role-delete').addEventListener('click', async () => {
    const slug = $('#role-slug').value;
    if (!slug || !window.confirm('Supprimer ce rôle ? Les comptes qui l’utilisent doivent être réattribués avant.')) return;
    const button = $('#role-delete'); button.disabled = true;
    try {
      renderAccess(await request(`/roles/${encodeURIComponent(slug)}/delete`, { method: 'POST' }));
      selectRole(); status('Rôle supprimé.');
    } catch (error) { status(error.message || 'Impossible de supprimer ce rôle.'); button.disabled = false; }
  });
  $('#team-hours-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await loadTeamHours(); status('Heures mises à jour.'); }
    catch (error) { status(error.message || 'Impossible de charger les heures.'); }
  });
  $('#team-hours-export').addEventListener('click', exportTeamHours);
  $('#request-search').addEventListener('input', renderRequestList);
  $('#request-filter').addEventListener('change', renderRequestList);
  $('#detail-close').addEventListener('click', () => {
    selectedRequest = null; $('#request-detail').hidden = true; $('#detail-placeholder').hidden = false; renderRequestList();
  });
  $('#status-form').addEventListener('submit', async (event) => {
    event.preventDefault(); if (!selectedRequest) return;
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      renderDetail(await request(`/requests/${selectedRequest.id}/status`, { method: 'POST', body: JSON.stringify({ status: $('#detail-status').value }) }));
      await loadRequests(); status('Statut enregistré.');
    } catch (error) { status(error.message || 'Impossible d’enregistrer le statut.'); }
    button.disabled = false;
  });
  $('#appointment-form').addEventListener('submit', async (event) => {
    event.preventDefault(); if (!selectedRequest) return;
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      renderDetail(await request(`/requests/${selectedRequest.id}/appointment`, { method: 'POST', body: JSON.stringify({
        local_when: $('#appointment-when').value, artist_name: $('#appointment-artist').value.trim()
      }) }));
      await loadRequests(); status('Rendez-vous confirmé.');
    } catch (error) { status(error.message || 'Impossible de confirmer le rendez-vous.'); }
    button.disabled = false;
  });
  $('#note-form').addEventListener('submit', async (event) => {
    event.preventDefault(); if (!selectedRequest) return;
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      renderDetail(await request(`/requests/${selectedRequest.id}/notes`, { method: 'POST', body: JSON.stringify({ body: $('#note-body').value }) }));
      $('#note-body').value = ''; status('Note ajoutée.');
    } catch (error) { status(error.message || 'Impossible d’ajouter la note.'); }
    button.disabled = false;
  });

  $('#shift-action').addEventListener('click', async () => {
    if (!member) return;
    const button = $('#shift-action'); button.disabled = true; status('Enregistrement…');
    const ending = Boolean(openSession);
    try {
      await request(ending ? '/shifts/end' : '/shifts/start', { method: 'POST' });
      await refresh(); status(ending ? 'Fin de service enregistrée.' : 'Début de service enregistré.');
    } catch (error) { status(error.message || 'Impossible d’enregistrer le pointage.'); }
    button.disabled = false;
  });
  $('#password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const current = $('#current-password').value;
    const next = $('#new-password').value;
    if (next !== $('#confirm-password').value) { status('Les deux nouveaux mots de passe sont différents.'); return; }
    const button = event.currentTarget.querySelector('button'); button.disabled = true; status('Enregistrement du nouveau mot de passe…');
    try {
      await request('/password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: next }) });
      setSessionToken(''); event.currentTarget.reset(); clearInterval(tick); member = null; openSession = null; activeView = '';
      showAuth('login-panel'); status('Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.');
    } catch (error) { status(error.message || 'Le mot de passe n’a pas été modifié. Réessayez.'); }
    button.disabled = false;
  });

  showAuth('login-panel');
  if (sessionToken) refresh();
  else fetch(`${apiBase}/api/health`, { credentials: 'omit', cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' } }).then((response) => {
    if (!response.ok) throw new Error();
  }).catch(() => {
    if ($('#username').value) status('Le serveur de gestion ne répond pas. Réessayez dans un instant.');
    else { showAuth('setup-panel'); status('Le serveur de gestion ne répond pas. Actualisez la page pour réessayer.'); }
  });
})();
