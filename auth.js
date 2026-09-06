// auth.js — login, signup, magic link, session management

async function signInWithEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function signUpWithEmail(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

async function signInWithMagicLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw error;
}

async function signOut() {
  await sb.auth.signOut();
  // Clear local cache on sign out
  ['tasks','goals','notes','noteGroups','journal','customCats'].forEach(k => {
    localStorage.removeItem('progrex_' + k);
  });
  showAuthScreen();
}

async function getSession() {
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

// Listen for auth state changes
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    await onUserSignedIn(session.user);
  } else if (event === 'SIGNED_OUT') {
    showAuthScreen();
  } else if (event === 'PASSWORD_RECOVERY') {
    showPasswordReset();
  }
});

// ── AUTH UI ───────────────────────────────────────────────────────────────────
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

function showPasswordReset() {
  setAuthMode('reset');
}

// Auth modes: login | signup | magic | reset
let _authMode = 'login';
function setAuthMode(mode) {
  _authMode = mode;
  const loginForm  = document.getElementById('auth-login-form');
  const signupForm = document.getElementById('auth-signup-form');
  const magicForm  = document.getElementById('auth-magic-form');
  const resetForm  = document.getElementById('auth-reset-form');
  const title      = document.getElementById('auth-title');
  const subtitle   = document.getElementById('auth-subtitle');
  [loginForm, signupForm, magicForm, resetForm].forEach(f => { if(f) f.style.display = 'none'; });
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-success').textContent = '';
  if (mode === 'login')  { loginForm.style.display = 'block';  title.textContent = 'Welcome back'; subtitle.textContent = 'Sign in to your Progrex account'; }
  if (mode === 'signup') { signupForm.style.display = 'block'; title.textContent = 'Create account'; subtitle.textContent = 'Start your Progrex journey'; }
  if (mode === 'magic')  { magicForm.style.display = 'block';  title.textContent = 'Magic link'; subtitle.textContent = 'We'll email you a login link — no password needed'; }
  if (mode === 'reset')  { resetForm.style.display = 'block';  title.textContent = 'New password'; subtitle.textContent = 'Enter your new password below'; }
}

function authError(msg) {
  document.getElementById('auth-error').textContent = msg;
  document.getElementById('auth-success').textContent = '';
}

function authSuccess(msg) {
  document.getElementById('auth-success').textContent = msg;
  document.getElementById('auth-error').textContent = '';
}

function setupAuthListeners() {
  // Login
  document.getElementById('auth-login-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const pass  = document.getElementById('auth-pass').value;
    if (!email || !pass) return authError('Please fill in all fields.');
    try {
      document.getElementById('auth-login-btn').textContent = 'Signing in...';
      await signInWithEmail(email, pass);
    } catch(e) {
      authError(e.message || 'Sign in failed.');
      document.getElementById('auth-login-btn').textContent = 'Sign In';
    }
  });

  // Signup
  document.getElementById('auth-signup-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email-2').value.trim();
    const pass  = document.getElementById('auth-pass-2').value;
    const conf  = document.getElementById('auth-pass-conf').value;
    if (!email || !pass) return authError('Please fill in all fields.');
    if (pass !== conf) return authError('Passwords do not match.');
    if (pass.length < 6) return authError('Password must be at least 6 characters.');
    try {
      document.getElementById('auth-signup-btn').textContent = 'Creating...';
      await signUpWithEmail(email, pass);
      authSuccess('Account created! Check your email to confirm, then sign in.');
      setAuthMode('login');
    } catch(e) {
      authError(e.message || 'Sign up failed.');
      document.getElementById('auth-signup-btn').textContent = 'Create Account';
    }
  });

  // Magic link
  document.getElementById('auth-magic-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email-magic').value.trim();
    if (!email) return authError('Please enter your email.');
    try {
      document.getElementById('auth-magic-btn').textContent = 'Sending...';
      await signInWithMagicLink(email);
      authSuccess('Magic link sent! Check your email and click the link to sign in.');
      document.getElementById('auth-magic-btn').textContent = 'Send Magic Link';
    } catch(e) {
      authError(e.message || 'Failed to send magic link.');
      document.getElementById('auth-magic-btn').textContent = 'Send Magic Link';
    }
  });

  // Password reset submit
  document.getElementById('auth-reset-btn')?.addEventListener('click', async () => {
    const pass = document.getElementById('auth-new-pass').value;
    const conf = document.getElementById('auth-new-pass-conf').value;
    if (pass !== conf) return authError('Passwords do not match.');
    if (pass.length < 6) return authError('Password must be at least 6 characters.');
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) return authError(error.message);
    authSuccess('Password updated! You are now signed in.');
    showApp();
  });

  // Mode switchers
  document.getElementById('go-signup')?.addEventListener('click',  () => setAuthMode('signup'));
  document.getElementById('go-login')?.addEventListener('click',   () => setAuthMode('login'));
  document.getElementById('go-magic')?.addEventListener('click',   () => setAuthMode('magic'));
  document.getElementById('go-login-2')?.addEventListener('click', () => setAuthMode('login'));

  // Allow Enter key
  ['auth-pass','auth-email'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('auth-login-btn')?.click(); });
  });
  document.getElementById('auth-email-magic')?.addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('auth-magic-btn')?.click(); });
}
