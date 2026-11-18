(() => {
  const $ = (selector) => document.querySelector(selector);
  const show = (id) => { for (const panel of ['setup-panel', 'login-panel', 'shift-panel']) $(`#${panel}`).hidden = panel !== id; };
  const status = (message) => { $('#status').textContent = message; };
  let member = null;
  let openSession = null;
  let tick = null;

  async function request(path, options = {}) {
    const response = await fetch(`/api${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'La requête a échoué.');
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
      member = null; openSession = null; clearInterval(tick); show('login-panel');
      if (!error.message.includes('session')) status('Impossible de charger votre profil. Réessayez.');
    }
  }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); status('Connexion en cours…');
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      await request('/login', { method: 'POST', body: JSON.stringify({ email: $('#email').value.trim(), password: $('#password').value }) });
      $('#password').value = ''; status(''); await refresh();
    } catch { status('Connexion impossible. Vérifiez vos identifiants et réessayez.'); }
    button.disabled = false;
  });
  $('#logout').addEventListener('click', async () => {
    try { await request('/logout', { method: 'POST' }); } catch { /* Le serveur invalide les sessions expirées. */ }
    clearInterval(tick); member = null; openSession = null; status('Vous êtes déconnecté.'); show('login-panel');
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

  fetch('/api/health', { credentials: 'same-origin' }).then((response) => {
    if (!response.ok) throw new Error();
    return refresh();
  }).catch(() => { show('setup-panel'); status('La gestion fonctionne sur le serveur Linux, une fois son installation terminée.'); });
})();
