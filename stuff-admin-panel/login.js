const TOKEN_KEY = 'stuffAdminToken';

async function submitLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const error = document.getElementById('login-error');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  error.hidden = true;
  button.disabled = true;
  try {
    const response = await fetch('/api/staff/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Sign in failed.');
    sessionStorage.setItem(TOKEN_KEY, data.token);
    window.location.replace('/stuff-admin-panel/matches.html');
  } catch (loginError) {
    error.textContent = loginError.message;
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

document.getElementById('login-form').addEventListener('submit', submitLogin);
