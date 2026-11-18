(() => {
  const $ = (selector) => document.querySelector(selector);
  const apiOrigin = 'https://dojojoserv.tail95e116.ts.net';
  const tokenKey = 'bloodline-management-session';
  const show = (id) => { for (const panel of ['setup-panel', 'login-panel', 'activate-panel', 'shift-panel']) $(`#${panel}`).hidden = panel !== id; };
  const status = (message) => { $('#status').textContent = message; };
  let sessionToken = '';
  try { sessionToken = sessionStorage.getItem(tokenKey) || ''; } catch { /* Private browsing may disable storage. */ }
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

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...options.headers };
    const response = await fetch(`${apiOrigin}/api${path}`, { ...options, credentials: 'omit', cache: 'no-store', headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.detail || 'La requête a échoué.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const formatDuration = (seconds) => {
    const whole = Math.max(0, Math.floor(seconds));
    return [Math.floor(whole / 3600), Math.floor(whole % 3600 / 60), whole % 60].map((part) => String(part).padStart(2, '0')).join(':');
  };
  const date = (value) => new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const clock = () => { $('#clock').textContent = openSession ? formatDuration((Date.now() - Date.parse(openSession.started_at)) / 1000) : '00:00:00'; };

  async function refresh() {
    try {
      const data = await request('/me');
      member = data.member;
      openSession = data.sessions.find((item) => !item.ended_at) || null;
      $('#member-name').textContent = member.display_name;
      $('#shift-action').firstChild.textContent = openSession ? 'Terminer mon service ' : 'Prendre mon service ';
      $('#shift-state').textContent = openSession ? `Service commencé le ${date(openSession.started_at)}.` : 'Aucun service en cours.';
      const history = $('#history'); history.replaceChildren();
      for (const session of data.sessions.filter((item) => item.ended_at)) {
        const row = document.createElement('div'); row.className = 'history-row';
        const when = document.createElement('span'); when.textContent = `${date(session.started_at)} → ${date(session.ended_at)}`;
        const duration = document.createElement('strong'); duration.textContent = formatDuration((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000);
        row.append(when, duration); history.append(row);
      }
      if (!history.childElementCount) history.textContent = 'Aucun service terminé.';
      show('shift-panel'); clock(); clearInterval(tick); tick = setInterval(clock, 1000);
    } catch (error) {
      if (error.status === 401) setSessionToken('');
      member = null; openSession = null; clearInterval(tick); show('login-panel');
      if (error.status === 401) status('');
      else status('Impossible de charger votre profil. Réessayez.');
    }
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
        pendingActivation = { username, code }; show('activate-panel'); status('Choisissez votre mot de passe pour terminer la première connexion.');
        $('#activate-password').focus();
      } else { setSessionToken(result.token); status(''); await refresh(); }
    } catch (error) { status(error.message || 'Connexion impossible. Vérifiez vos identifiants et réessayez.'); }
    button.disabled = false;
  });
  $('#activate-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!pendingActivation) { show('login-panel'); return; }
    const next = $('#activate-password').value;
    if (next !== $('#activate-confirm').value) { status('Les deux mots de passe sont différents.'); return; }
    const button = event.currentTarget.querySelector('button'); button.disabled = true; status('Création du mot de passe…');
    try {
      const result = await request('/activate', { method: 'POST', body: JSON.stringify({ ...pendingActivation, new_password: next }) });
      setSessionToken(result.token);
      pendingActivation = null; event.currentTarget.reset(); status('Mot de passe créé.'); await refresh();
    } catch (error) { status(error.message || 'Impossible de créer le mot de passe. Réessayez.'); }
    button.disabled = false;
  });
  $('#activate-back').addEventListener('click', () => {
    pendingActivation = null; $('#activate-form').reset(); status(''); show('login-panel'); $('#username').focus();
  });
  $('#logout').addEventListener('click', async () => {
    try { await request('/logout', { method: 'POST' }); } catch { /* Le serveur invalide les sessions expirées. */ }
    setSessionToken(''); clearInterval(tick); member = null; openSession = null; status('Vous êtes déconnecté.'); show('login-panel');
  });
  $('#shift-action').addEventListener('click', async () => {
    if (!member) return;
    const button = $('#shift-action'); button.disabled = true; status('Enregistrement…');
    const ending = Boolean(openSession);
    try {
      await request(ending ? '/shifts/end' : '/shifts/start', { method: 'POST' });
      status(ending ? 'Fin de service enregistrée.' : 'Début de service enregistré.'); await refresh();
    } catch (error) { status(error.message || 'Impossible d’enregistrer le pointage. Réessayez.'); }
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
      setSessionToken('');
      event.currentTarget.reset(); clearInterval(tick); member = null; openSession = null;
      show('login-panel'); status('Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.');
    } catch (error) { status(error.message || 'Le mot de passe n’a pas été modifié. Réessayez.'); }
    button.disabled = false;
  });

  fetch(`${apiOrigin}/api/health`, { credentials: 'omit', cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error();
    if (sessionToken) return refresh();
    show('login-panel');
  }).catch(() => { show('setup-panel'); status('Le serveur de gestion ne répond pas. Actualisez la page pour réessayer.'); });
})();
