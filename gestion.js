(() => {
  const $ = (selector) => document.querySelector(selector);
  const apiBase = 'https://unabashed-tackle-claw.ngrok-free.dev/bloodline-api';
  const tokenKey = 'bloodline-management-session';
  const statusNames = {
    new: 'Nouvelle', to_contact: 'À contacter', in_discussion: 'En discussion',
    scheduled: 'Rendez-vous confirmé', done: 'Terminé', cancelled: 'Annulé'
  };
  const viewNames = {
    dashboard: ['Tableau de bord', 'Les demandes reçues et les rendez-vous à venir.'],
    requests: ['Demandes & projets', 'Chaque projet garde ses échanges et son rendez-vous au même endroit.'],
    appointments: ['Rendez-vous', 'Les rendez-vous confirmés par l’équipe.'],
    service: ['Mon service', 'Vos heures enregistrées par le salon.']
  };
  const date = (value) => new Intl.DateTimeFormat('fr-BE', {
    timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short'
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

  function showAuth(id) {
    $('#auth-shell').hidden = false;
    $('#workspace').hidden = true;
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
    const name = document.createElement('strong'); name.textContent = item.client_name;
    const meta = document.createElement('small');
    meta.textContent = kind === 'appointment'
      ? `${item.reference} · ${item.artist_name || 'Artiste à préciser'}`
      : `${item.reference} · ${date(item.created_at)}`;
    const side = document.createElement('span'); side.className = 'record-side';
    side.textContent = kind === 'appointment' ? date(item.scheduled_at) : statusNames[item.status] || item.status;
    button.append(name, meta, side);
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

  async function switchView(name) {
    if (!viewNames[name] || (member?.role !== 'superadmin' && name !== 'service')) return;
    activeView = name;
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
    $('#member-name').textContent = member.display_name;
    for (const element of document.querySelectorAll('[data-manager-only]')) element.hidden = member.role !== 'superadmin';
    renderService(data.sessions);
    $('#auth-shell').hidden = true; $('#workspace').hidden = false;
    await switchView(activeView || (member.role === 'superadmin' ? 'dashboard' : 'service'));
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
    setSessionToken(''); clearInterval(tick); member = null; openSession = null; activeView = '';
    status('Vous êtes déconnecté.'); showAuth('login-panel');
  });

  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => switchView(button.dataset.view));
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

  fetch(`${apiBase}/api/health`, { credentials: 'omit', cache: 'no-store', headers: { 'ngrok-skip-browser-warning': 'true' } }).then((response) => {
    if (!response.ok) throw new Error();
    if (sessionToken) return refresh();
    showAuth('login-panel');
  }).catch(() => { showAuth('setup-panel'); status('Le serveur de gestion ne répond pas. Actualisez la page pour réessayer.'); });
})();
