(() => {
  const config = window.BLOODLINE_GESTION_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const show = (id) => { for (const panel of ['setup-panel', 'login-panel', 'shift-panel']) $(`#${panel}`).hidden = panel !== id; };
  const status = (message) => { $('#status').textContent = message; };
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url || '') && Boolean(config.publishableKey);
  if (!configured || !window.supabase?.createClient) {
    show('setup-panel');
    status(configured ? 'Le service de connexion est indisponible. Réessayez plus tard.' : 'La connexion au service de données n’est pas encore configurée.');
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  let member = null;
  let openSession = null;
  let tick = null;
  const formatDuration = (seconds) => {
    const whole = Math.max(0, Math.floor(seconds));
    return [Math.floor(whole / 3600), Math.floor(whole % 3600 / 60), whole % 60].map((part) => String(part).padStart(2, '0')).join(':');
  };
  const clock = () => { $('#clock').textContent = openSession ? formatDuration((Date.now() - Date.parse(openSession.started_at)) / 1000) : '00:00:00'; };
  const date = (value) => new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

  async function refresh() {
    const { data: auth } = await client.auth.getUser();
    if (!auth?.user) { member = null; show('login-panel'); return; }
    const { data: profile, error: profileError } = await client.from('staff_members').select('user_id, display_name, active').eq('user_id', auth.user.id).maybeSingle();
    if (profileError || !profile?.active) {
      member = null; show('login-panel');
      status('Ce compte n’a pas encore accès à la gestion. Contactez un administrateur.');
      await client.auth.signOut();
      return;
    }
    member = profile;
    const { data: sessions, error } = await client.from('work_sessions').select('id, started_at, ended_at').eq('user_id', member.user_id).order('started_at', { ascending: false }).limit(20);
    if (error) { status('Impossible de charger vos services. Réessayez.'); return; }
    openSession = sessions.find((session) => !session.ended_at) || null;
    $('#member-name').textContent = member.display_name;
    $('#shift-action').firstChild.textContent = openSession ? 'Terminer mon service ' : 'Prendre mon service ';
    $('#shift-state').textContent = openSession ? `Service commencé le ${date(openSession.started_at)}.` : 'Aucun service en cours.';
    const history = $('#history');
    history.replaceChildren();
    for (const session of sessions.filter((item) => item.ended_at)) {
      const row = document.createElement('div'); row.className = 'history-row';
      const when = document.createElement('span'); when.textContent = `${date(session.started_at)} → ${date(session.ended_at)}`;
      const duration = document.createElement('strong'); duration.textContent = formatDuration((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000);
      row.append(when, duration); history.append(row);
    }
    if (!history.childElementCount) history.textContent = 'Aucun service terminé.';
    show('shift-panel'); clock(); clearInterval(tick); tick = setInterval(clock, 1000);
  }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); status('Connexion en cours…');
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    const { error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
    $('#password').value = ''; button.disabled = false;
    if (error) { status('Connexion impossible. Vérifiez vos identifiants et réessayez.'); return; }
    status(''); await refresh();
  });
  $('#logout').addEventListener('click', async () => { await client.auth.signOut(); clearInterval(tick); member = null; openSession = null; status('Vous êtes déconnecté.'); show('login-panel'); });
  $('#shift-action').addEventListener('click', async () => {
    if (!member) return;
    const button = $('#shift-action'); button.disabled = true; status('Enregistrement…');
    const result = openSession
      ? await client.from('work_sessions').update({ ended_at: new Date().toISOString() }).eq('id', openSession.id).eq('user_id', member.user_id)
      : await client.from('work_sessions').insert({ user_id: member.user_id });
    button.disabled = false;
    if (result.error) { status('Impossible d’enregistrer le pointage. Vérifiez votre connexion et réessayez.'); return; }
    status(openSession ? 'Fin de service enregistrée.' : 'Début de service enregistré.');
    await refresh();
  });
  refresh();
})();
