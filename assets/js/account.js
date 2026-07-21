// Espace client SEND — connexion par email via Supabase (site statique).
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const URL = window.SUPABASE_URL;
  const KEY = window.SUPABASE_ANON_KEY;

  const notice = $('notice');
  const authView = $('authView');
  const spaceView = $('spaceView');

  // 1) Configuration manquante -> message d'aide, on n'active pas les formulaires.
  if (!URL || !KEY || !window.supabase) {
    notice.hidden = false;
    if (authView) authView.hidden = true;
    return;
  }

  const client = window.supabase.createClient(URL, KEY);

  function showError(msg) {
    const el = $('formError');
    el.textContent = msg || '';
    el.hidden = !msg;
  }
  function showInfo(msg) {
    const el = $('formInfo');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  // Traduit les messages d'erreur Supabase les plus fréquents.
  function frError(error) {
    const m = (error && error.message) || '';
    if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Votre email n\'est pas encore confirmé. Vérifiez votre boîte mail.';
    if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet email. Connectez-vous.';
    if (/Password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    return m || 'Une erreur est survenue.';
  }

  // 2) Bascule connexion / inscription
  let mode = 'signin';
  const setMode = (m) => {
    mode = m;
    showError(''); showInfo('');
    $('submitBtn').textContent = m === 'signin' ? 'Se connecter' : 'Créer mon compte';
    $('toggleText').innerHTML = m === 'signin'
      ? 'Pas encore de compte ? <a href="#" id="toggleLink">Créer un compte</a>'
      : 'Déjà un compte ? <a href="#" id="toggleLink">Se connecter</a>';
    $('title').textContent = m === 'signin' ? 'Espace client' : 'Créer un compte';
    bindToggle();
  };
  function bindToggle() {
    const l = $('toggleLink');
    if (l) l.addEventListener('click', (e) => { e.preventDefault(); setMode(mode === 'signin' ? 'signup' : 'signin'); });
  }

  // 3) Soumission du formulaire
  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError(''); showInfo('');
    const email = $('email').value.trim();
    const password = $('password').value;
    const btn = $('submitBtn');
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Un instant…';
    try {
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) return showError(frError(error));
        if (data.session) render(data.session);
        else showInfo('Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.');
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) return showError(frError(error));
        render(data.session);
      }
    } catch (err) {
      showError('Erreur de connexion au service. Réessayez.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  // 4) Mot de passe oublié
  $('forgot').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    if (!email) return showError('Entrez votre email d\'abord, puis cliquez sur « mot de passe oublié ».');
    showError('');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
    if (error) showError(frError(error));
    else showInfo('Si un compte existe, un email de réinitialisation vient d\'être envoyé.');
  });

  // 5) Déconnexion
  $('logout').addEventListener('click', async () => {
    await client.auth.signOut();
  });

  // 6) Affichage selon l'état de session
  function render(session) {
    if (session && session.user) {
      authView.hidden = true;
      spaceView.hidden = false;
      $('userEmail').textContent = session.user.email || '';
    } else {
      spaceView.hidden = true;
      authView.hidden = false;
    }
  }

  // Session existante au chargement + écoute des changements
  client.auth.getSession().then(({ data }) => render(data.session));
  client.auth.onAuthStateChange((_event, session) => render(session));

  setMode('signin');
})();
