// auth.js — login, signup, magic link, session management

// ── SUPABASE AUTH CALLS ───────────────────────────────────────────────────────
async function signInWithEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function signUpWithEmail(email, password) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href
    }
  });
  if (error) throw error;
  return data;
}

async function signInWithMagicLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href,
      shouldCreateUser: true
    }
  });
  if (error) throw error;
}

async function signOut() {
  await sb.auth.signOut();
  ['tasks','goals','notes','noteGroups','journal','customCats'].forEach(k => {
    localStorage.removeItem('progrex_' + k);
  });
  localStorage.removeItem('progrex_state');
  showAuthScreen();
}

async function getSession() {
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

// ── AUTH STATE LISTENER ───────────────────────────────────────────────────────
sb.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth event:', event);
  if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
    await onUserSignedIn(session.user);
  } else if (event === 'SIGNED_OUT') {
    showAuthScreen();
  } else if (event === 'PASSWORD_RECOVERY') {
    setAuthMode('reset');
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  }
});

// ── AUTH SCREEN HELPERS ───────────────────────────────────────────────────────
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-success').textContent = '';
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
}

function authError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg;
  const succ = document.getElementById('auth-success');
  if (succ) succ.textContent = '';
}

function authSuccess(msg) {
  const el = document.getElementById('auth-success');
  if (el) el.textContent = msg;
  const err = document.getElementById('auth-error');
  if (err) err.textContent = '';
}

function setLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : defaultText;
}

// ── AUTH MODE SWITCHER ────────────────────────────────────────────────────────
let _authMode = 'login';

function setAuthMode(mode) {
  _authMode = mode;
  const forms = {
    login:  document.getElementById('auth-login-form'),
    signup: document.getElementById('auth-signup-form'),
    magic:  document.getElementById('auth-magic-form'),
    reset:  document.getElementById('auth-reset-form'),
  };
  Object.values(forms).forEach(f => { if (f) f.style.display = 'none'; });
  authError('');
  authSuccess('');

  const titles = {
    login:  ['Welcome back',    'Sign in to your Progrex account'],
    signup: ['Create account',  'Start organizing your life with Progrex'],
    magic:  ['Magic link',      'Get a login link sent to your email — no password needed'],
    reset:  ['New password',    'Choose a new password for your account'],
  };
  const [title, subtitle] = titles[mode] || ['Progrex', ''];
  const t = document.getElementById('auth-title');
  const s = document.getElementById('auth-subtitle');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
  if (forms[mode]) forms[mode].style.display = 'block';
}

// ── SETUP AUTH LISTENERS ──────────────────────────────────────────────────────
function setupAuthListeners() {

  // ── LOGIN ──
  document.getElementById('auth-login-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email')?.value.trim();
    const pass  = document.getElementById('auth-pass')?.value;
    if (!email || !pass) return authError('Please enter your email and password.');
    setLoading('auth-login-btn', true, 'Sign In');
    try {
      await signInWithEmail(email, pass);
      // onAuthStateChange handles the rest
    } catch(e) {
      authError(friendlyError(e.message));
      setLoading('auth-login-btn', false, 'Sign In');
    }
  });

  // Enter key on login form
  ['auth-email', 'auth-pass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('auth-login-btn')?.click();
    });
  });

  // ── SIGN UP ──
  document.getElementById('auth-signup-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email-2')?.value.trim();
    const pass  = document.getElementById('auth-pass-2')?.value;
    const conf  = document.getElementById('auth-pass-conf')?.value;
    if (!email) return authError('Please enter your email address.');
    if (!pass)  return authError('Please choose a password.');
    if (pass.length < 6) return authError('Password must be at least 6 characters.');
    if (pass !== conf)   return authError('Passwords do not match — please try again.');
    setLoading('auth-signup-btn', true, 'Create Account');
    try {
      const result = await signUpWithEmail(email, pass);
      // If email confirmation is required, user will be null but session won't start yet
      if (result.user && !result.session) {
        authSuccess('Account created! Check your email for a confirmation link, then come back and sign in.');
        setAuthMode('login');
      } else if (result.session) {
        // Auto-confirmed (email confirmation disabled in Supabase)
        authSuccess('Account created! Signing you in...');
      } else {
        authSuccess('Check your email for a confirmation link to activate your account.');
        setAuthMode('login');
      }
      setLoading('auth-signup-btn', false, 'Create Account');
    } catch(e) {
      authError(friendlyError(e.message));
      setLoading('auth-signup-btn', false, 'Create Account');
    }
  });

  // Enter key on signup form
  ['auth-email-2', 'auth-pass-2', 'auth-pass-conf'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('auth-signup-btn')?.click();
    });
  });

  // ── MAGIC LINK ──
  document.getElementById('auth-magic-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email-magic')?.value.trim();
    if (!email) return authError('Please enter your email address.');
    if (!email.includes('@')) return authError('Please enter a valid email address.');
    setLoading('auth-magic-btn', true, 'Send Magic Link');
    try {
      await signInWithMagicLink(email);
      authSuccess('Magic link sent! Check your inbox and click the link to sign in. Check spam if you do not see it.');
      setLoading('auth-magic-btn', false, 'Send Magic Link');
    } catch(e) {
      authError(friendlyError(e.message));
      setLoading('auth-magic-btn', false, 'Send Magic Link');
    }
  });

  document.getElementById('auth-email-magic')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('auth-magic-btn')?.click();
  });

  // ── PASSWORD RESET ──
  document.getElementById('auth-reset-btn')?.addEventListener('click', async () => {
    const pass = document.getElementById('auth-new-pass')?.value;
    const conf = document.getElementById('auth-new-pass-conf')?.value;
    if (!pass || pass.length < 6) return authError('Password must be at least 6 characters.');
    if (pass !== conf) return authError('Passwords do not match.');
    setLoading('auth-reset-btn', true, 'Update Password');
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) {
      authError(friendlyError(error.message));
      setLoading('auth-reset-btn', false, 'Update Password');
    } else {
      authSuccess('Password updated! You are now signed in.');
      showApp();
    }
  });

  // ── MODE SWITCHERS ──
  document.getElementById('go-signup')?.addEventListener('click',  () => setAuthMode('signup'));
  document.getElementById('go-login')?.addEventListener('click',   () => setAuthMode('login'));
  document.getElementById('go-magic')?.addEventListener('click',   () => setAuthMode('magic'));
  document.getElementById('go-login-2')?.addEventListener('click', () => setAuthMode('login'));
  document.getElementById('go-magic-2')?.addEventListener('click', () => setAuthMode('magic'));
}

// ── FRIENDLY ERROR MESSAGES ───────────────────────────────────────────────────
function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Please try again.';
  if (msg.includes('Invalid login credentials'))  return 'Wrong email or password. Please try again.';
  if (msg.includes('Email not confirmed'))         return 'Please check your email and click the confirmation link first.';
  if (msg.includes('User already registered'))     return 'An account with this email already exists. Try signing in instead.';
  if (msg.includes('Password should be'))          return 'Password must be at least 6 characters.';
  if (msg.includes('Unable to validate'))          return 'Invalid email address. Please check and try again.';
  if (msg.includes('Email rate limit'))            return 'Too many attempts. Please wait a few minutes and try again.';
  if (msg.includes('over_email_send_rate_limit'))  return 'Too many emails sent. Please wait a minute and try again.';
  if (msg.includes('network'))                     return 'Network error — check your internet connection.';
  return msg;
}
