const isStaffPanel = window.location.pathname.startsWith('/stuff-admin-panel/');

const state = {
  users: [],
  depositRequests: [],
  zapupiTransactions: [],
  withdrawRequests: [],
  announcements: [],
  notifications: [],
  contacts: [],
  banners: [],
  matchBanners: [],
  rules: [],
  games: [],
  matches: [],
  dashboard: null,
  selectedMatch: null,
  selectedMatchPlayers: [],
  selectedResultMatch: null,
  selectedResultPlayers: [],
  loading: false,
  error: null,
  search: '',
  matchQuery: '',
  depositQuery: '',
  zapupiQuery: '',
  withdrawQuery: '',
  matchPage: 1,
  matchPageSize: 10,
  activeSection: 'dashboard',
  editingAnnouncement: null,
  editingNotification: null,
  editingGame: null,
  editingRule: null,
  editingMatch: null,
  selectedMatchIds: new Set(),
  staffAccounts: [],
  adminToken: sessionStorage.getItem(isStaffPanel ? 'stuffAdminToken' : 'adminToken') || '',
  adminAccount: null,
  adminStatus: null,
  authView: 'login',
  authMessage: '',
  authError: '',
};

const appEl = document.getElementById('app');
const statusColors = {
  Upcoming: 'neutral',
  Ongoing: 'active',
  Complete: 'success',
  Cancelled: 'danger',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  const dateLabel = date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} · ${dateLabel}`;
};

const formatMatchDateTimeLocal = (value) => {
  if (!value) return '2026-09-06T08:20';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '2026-09-06T08:20';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
};

const matchDateTimeToUtcSql = (value) => {
  if (!value) return '';
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 19).replace('T', ' ');
};

const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const apiFetch = async (url, options = {}) => {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(state.adminToken ? { Authorization: `Bearer ${state.adminToken}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  const publicAdminAuthRoutes = ['/api/admin/auth/status', '/api/admin/auth/request-code', '/api/admin/auth/setup', '/api/admin/auth/login', '/api/admin/auth/reset', '/api/admin/auth/delete'];
  if (response.status === 401 && state.adminToken && !publicAdminAuthRoutes.includes(url)) {
    clearAdminSession();
    if (isStaffPanel) {
      window.location.replace('/stuff-admin-panel/login.html');
      return;
    }
    renderAuthPage();
  }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};

function clearAdminSession() {
  state.adminToken = '';
  state.adminAccount = null;
  sessionStorage.removeItem(isStaffPanel ? 'stuffAdminToken' : 'adminToken');
}

async function adminAuthRequest(path, body) {
  const response = await fetch(`/api/admin/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderAuthPage() {
  const configured = Boolean(state.adminStatus?.configured);
  const mode = state.authView;
  const title = !configured ? 'Create admin login' : mode === 'reset' ? 'Reset password' : mode === 'delete' ? 'Remove admin login' : 'Admin sign in';
  const ownerEmail = escapeHtml(state.adminStatus?.ownerEmail || 'the code-defined owner email');
  const description = mode === 'setup'
    ? `The admin account uses ${ownerEmail}. Create it from localhost; no email verification code is needed.`
    : `Recovery codes are sent to ${ownerEmail}.`;
  const isLogin = configured && mode === 'login';
  const action = isLogin ? 'login' : mode;
  const passwordLabel = mode === 'reset' ? 'New password' : 'Password';
  const showCode = !isLogin && mode !== 'setup';
  const credentialFields = mode === 'setup'
    ? `<label>Default admin email<input name="email" type="email" value="${ownerEmail}" readonly /></label><label>Username<input name="username" autocomplete="username" minlength="3" maxlength="40" required /></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="10" required /></label>`
    : mode === 'reset'
      ? `<label>${passwordLabel}<input name="password" type="password" autocomplete="new-password" minlength="10" required /></label>`
      : isLogin
        ? '<label>Username<input name="username" autocomplete="username" required /></label><label>Password<input name="password" type="password" autocomplete="current-password" required /></label>'
        : '';
  appEl.innerHTML = `<main class="admin-auth-shell"><section class="admin-auth-panel"><div class="admin-auth-brand"><span class="brand-mark">B</span><div><strong>BATTLE-NEXT</strong><span>ADMIN PANEL</span></div></div><p class="dashboard-eyebrow">SECURE ACCESS</p><h1>${title}</h1><p class="admin-auth-description">${isLogin ? 'Sign in with your admin username and password.' : description}</p>${state.authError ? `<div class="state-box error">${escapeHtml(state.authError)}</div>` : ''}${state.authMessage ? `<div class="state-box auth-notice">${escapeHtml(state.authMessage)}</div>` : ''}<form id="admin-auth-form" class="admin-auth-form" data-auth-action="${action}">${showCode ? `<label>Email verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></label>` : ''}${credentialFields}<button class="btn-primary" type="submit">${isLogin ? 'Sign in' : mode === 'setup' ? 'Create admin account' : mode === 'reset' ? 'Save new password' : 'Delete admin credentials'}</button></form>${showCode ? `<button class="btn-secondary auth-code-button" type="button" data-request-auth-code="${mode}">Send code to owner email</button>` : ''}${configured ? `<div class="auth-links">${mode !== 'login' ? '<button type="button" data-auth-view="login">Back to sign in</button>' : '<button type="button" data-auth-view="reset">Forgot password?</button><button type="button" data-auth-view="delete">Remove admin credentials</button>'}</div>` : ''}</section></main>`;
  appEl.querySelector('#admin-auth-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.authError = '';
    state.authMessage = '';
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      if (action === 'login') {
        const data = await adminAuthRequest('login', payload);
        state.adminToken = data.token;
        state.adminAccount = { username: data.username, ownerEmail: state.adminStatus.ownerEmail };
        sessionStorage.setItem('adminToken', data.token);
        state.activeSection = 'dashboard';
        await loadActiveSection();
        return;
      }
      if (action === 'setup') await adminAuthRequest('setup', payload);
      if (action === 'reset') await adminAuthRequest('reset', { ...payload, purpose: 'reset' });
      if (action === 'delete') await adminAuthRequest('delete', { ...payload, purpose: 'delete' });
      state.adminStatus = (await fetch('/api/admin/auth/status').then((response) => response.json()));
      state.authView = state.adminStatus.configured ? 'login' : 'setup';
      state.authMessage = action === 'delete' ? 'Admin credentials removed.' : action === 'reset' ? 'Password updated. Sign in with your new password.' : 'Admin account created. Sign in to continue.';
      renderAuthPage();
    } catch (error) {
      state.authError = error.message;
      renderAuthPage();
    }
  });
  appEl.querySelector('[data-request-auth-code]')?.addEventListener('click', async (event) => {
    state.authError = '';
    state.authMessage = '';
    try {
      const data = await adminAuthRequest('request-code', { purpose: event.currentTarget.dataset.requestAuthCode });
      state.authMessage = data.message;
    } catch (error) {
      state.authError = error.message;
    }
    renderAuthPage();
  });
  appEl.querySelectorAll('[data-auth-view]').forEach((button) => button.addEventListener('click', () => {
    state.authView = button.dataset.authView;
    state.authMessage = '';
    state.authError = '';
    renderAuthPage();
  }));
}

const filteredUsers = () => {
  const query = state.search.trim().toLowerCase();
  return query ? state.users.filter((user) => [user.id, user.fullName, user.firstName, user.lastName, user.username, user.email, user.mobileNo, user.mobile].join(' ').toLowerCase().includes(query)) : state.users;
};

const getFilteredMatches = () => {
  const query = state.matchQuery.trim().toLowerCase();
  const records = [...state.matches];
  if (!query) return records;
  return records.filter((match) => [match.matchId, match.id].join(' ').toLowerCase().includes(query));
};

const getFilteredDepositRequests = () => {
  const query = state.depositQuery.trim().toLowerCase();
  if (!query) return state.depositRequests;
  return state.depositRequests.filter((request) => [request.id, request.userId, request.fullName, request.username, request.mobile, request.amount, request.transactionId, request.status].join(' ').toLowerCase().includes(query));
};

const getFilteredZapupiTransactions = () => {
  const query = state.zapupiQuery.trim().toLowerCase();
  if (!query) return state.zapupiTransactions;
  return state.zapupiTransactions.filter((transaction) => [
    transaction.orderId,
    transaction.providerOrderId,
    transaction.userId,
    transaction.fullName,
    transaction.username,
    transaction.mobile,
    transaction.amount,
    transaction.status,
  ].join(' ').toLowerCase().includes(query));
};

const getFilteredWithdrawRequests = () => {
  const query = state.withdrawQuery.trim().toLowerCase();
  if (!query) return state.withdrawRequests;
  return state.withdrawRequests.filter((request) => [request.id, request.userId, request.fullName, request.username, request.mobile, request.amount, request.upiId, request.status].join(' ').toLowerCase().includes(query));
};

function rerenderSearchResults(input) {
  const { selectionStart, selectionEnd, id } = input;
  renderPage();
  const refreshedInput = document.getElementById(id);
  if (!refreshedInput) return;
  refreshedInput.focus();
  if (selectionStart !== null && selectionEnd !== null) refreshedInput.setSelectionRange(selectionStart, selectionEnd);
}

appEl.addEventListener('input', (event) => {
  const input = event.target;
  const field = {
    'search-input': 'search',
    'match-search': 'matchQuery',
    'deposit-search': 'depositQuery',
    'zapupi-search': 'zapupiQuery',
    'withdraw-search': 'withdrawQuery',
  }[input.id];
  if (!field) return;
  state[field] = input.value;
  if (field === 'matchQuery') state.matchPage = 1;
  rerenderSearchResults(input);
});

const renderStatusBadge = (status) => `<span class="status-badge ${statusColors[status] || 'neutral'}">${status}</span>`;

function setRichEditorContent(name, value) {
  const editor = document.querySelector(`[data-rich-editor="${name}"]`);
  if (editor) editor.innerHTML = value || '';
}

function getRichEditorContent(name) {
  const editor = document.querySelector(`[data-rich-editor="${name}"]`);
  return editor ? (editor.value ?? editor.innerHTML).trim() : '';
}

function applyEditorCommand(command, value = null) {
  document.execCommand(command, false, value);
}

function bindRichEditorHandlers() {
  document.querySelectorAll('[data-rich-editor]').forEach((editor) => {
    editor.addEventListener('focus', () => {
      editor.classList.add('active');
    });
    editor.addEventListener('blur', () => {
      editor.classList.remove('active');
    });
  });

  document.querySelectorAll('[data-editor-command]').forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.dataset.editorCommand;
      if (command === 'createLink') {
        const url = window.prompt('Enter a URL', 'https://');
        if (url) applyEditorCommand('createLink', url);
        return;
      }
      if (command === 'insertImage') {
        const url = window.prompt('Enter image URL', 'https://');
        if (url) applyEditorCommand('insertImage', url);
        return;
      }
      applyEditorCommand(command);
    });
  });
}

function renderUsers() {
  if (state.activeSection === 'money') return renderMoney();
  if (state.activeSection === 'withdraw') return renderWithdrawals();
  const users = filteredUsers();
  const rows = users.map((user) => `<tr><td>${user.id}</td><td><strong>${escapeHtml(user.fullName)}</strong><br /><small>${escapeHtml(user.username)}</small></td><td>${escapeHtml(user.mobileNo)}</td><td>${escapeHtml(user.email)}</td><td>₹${Number(user.coinBalance || 0).toFixed(2)}</td><td><span class="status ${user.isBlocked ? 'danger' : 'active'}">${user.isBlocked ? 'Blocked' : 'Active'}</span></td><td><button class="btn-primary" data-coin-action="add" data-user-id="${user.id}">Add coins</button> <button class="btn-secondary" data-coin-action="deduct" data-user-id="${user.id}">Deduct coins</button> <button class="btn-danger" data-block-user="${user.id}" data-blocked="${user.isBlocked}">${user.isBlocked ? 'Unblock' : 'Block'}</button></td></tr>`).join('');
  return `<section class="panel"><div class="panel-toolbar"><input id="search-input" class="search-input" type="search" placeholder="Search users..." value="${escapeHtml(state.search)}" /><span class="count-badge">${users.length} user${users.length === 1 ? '' : 's'}</span></div>${state.loading ? '<div class="state-box">Loading users...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>User</th><th>Mobile</th><th>Email</th><th>Coins</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="state-box">No users found.</div>'}</section>`;
}

function renderDashboard() {
  const dashboard = state.dashboard;
  if (!dashboard) return '<section class="panel"><div class="state-box">Loading dashboard...</div></section>';
  const metrics = [
    { label: 'Total users', value: dashboard.totalUsers, detail: 'Registered accounts', tone: 'users' },
    { label: 'Total matches', value: dashboard.totalMatches, detail: 'All match records', tone: 'matches' },
    { label: 'Active matches', value: dashboard.activeMatches, detail: 'Upcoming and ongoing', tone: 'active' },
    { label: 'Reviewed payments', value: dashboard.reviewedPayments, detail: 'Approved or rejected', tone: 'reviewed' },
    { label: 'Withdrawal requests', value: dashboard.totalWithdrawals, detail: `${dashboard.pendingWithdrawals} pending review`, tone: 'withdrawals' },
    { label: 'Blocked users', value: dashboard.blockedUsers, detail: 'Accounts restricted', tone: 'blocked' },
    { label: 'Total coins', value: `₹${dashboard.totalCoins.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, detail: 'Across all user wallets', tone: 'coins' },
    { label: 'Pending payments', value: dashboard.pendingDeposits, detail: 'Awaiting review', tone: 'pending' },
    { label: 'Completed matches', value: dashboard.completedMatches, detail: 'Results available', tone: 'completed' },
  ];
  return `<section class="dashboard-overview"><div class="dashboard-section-heading"><div><span class="dashboard-eyebrow">PLATFORM OVERVIEW</span><h2>At a glance</h2></div><span class="dashboard-live"><i></i> Live data</span></div><div class="dashboard-grid">${metrics.map((metric) => `<article class="dashboard-card dashboard-card-${metric.tone}"><div class="dashboard-card-top"><span>${metric.label}</span><i aria-hidden="true"></i></div><strong>${metric.value}</strong><small>${metric.detail}</small></article>`).join('')}</div></section>`;
}

function renderMoney() {
  const zapupiTransactions = getFilteredZapupiTransactions();
  const zapupiRows = zapupiTransactions.map((transaction) => `<tr><td><code>${escapeHtml(transaction.orderId)}</code>${transaction.providerOrderId !== transaction.orderId ? `<br /><small>Provider: ${escapeHtml(transaction.providerOrderId)}</small>` : ''}</td><td><strong>${escapeHtml(transaction.fullName || transaction.username)}</strong><br /><small>${escapeHtml(transaction.username)} · ${escapeHtml(transaction.mobile)}</small></td><td>₹${Number(transaction.amount).toFixed(2)}</td><td><span class="status ${transaction.status === 'COMPLETED' ? 'active' : transaction.status === 'FAILED' ? 'danger' : 'neutral'}">${escapeHtml(transaction.status)}</span></td><td>${escapeHtml(formatDate(transaction.createdAt))}</td><td>${escapeHtml(formatDate(transaction.completedAt))}</td></tr>`).join('');
  const requests = getFilteredDepositRequests();
  const rows = requests.map((request) => `<tr><td>#${request.id}</td><td><strong>${escapeHtml(request.fullName || request.username)}</strong><br /><small>${escapeHtml(request.username)} · ${escapeHtml(request.mobile)}</small></td><td>₹${Number(request.amount).toFixed(2)}</td><td><code>${escapeHtml(request.transactionId)}</code></td><td>${escapeHtml(formatDate(request.createdAt))}</td><td><span class="status ${request.status === 'approved' ? 'active' : request.status === 'rejected' ? 'danger' : 'neutral'}">${escapeHtml(request.status)}</span></td><td>${request.status === 'pending' ? `<button class="btn-primary" data-approve-request="${request.id}">Accept</button> <button class="btn-danger" data-reject-request="${request.id}">Reject</button>` : 'Reviewed'}</td></tr>`).join('');
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const emptyMessage = state.depositQuery ? 'No payment requests match your search.' : 'No payment requests yet.';
  return `<section class="panel"><div class="panel-toolbar"><strong>ZapUPI transactions</strong><input id="zapupi-search" class="search-input" type="search" placeholder="Search by order, user, phone, amount, or status" aria-label="Search ZapUPI transactions" value="${escapeHtml(state.zapupiQuery)}" /><span class="count-badge">${zapupiTransactions.length} of ${state.zapupiTransactions.length} transactions</span></div>${state.loading ? '<div class="state-box">Loading ZapUPI transactions...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : zapupiRows ? `<div class="table-wrap"><table><thead><tr><th>Order ID</th><th>User</th><th>Amount</th><th>Status</th><th>Created</th><th>Completed</th></tr></thead><tbody>${zapupiRows}</tbody></table></div>` : `<div class="state-box">${state.zapupiQuery ? 'No ZapUPI transactions match your search.' : 'No ZapUPI transactions yet.'}</div>`}</section><section class="panel"><div class="panel-toolbar"><strong>Legacy manual payment requests</strong><input id="deposit-search" class="search-input" type="search" placeholder="Search by user, phone, amount, or transaction ID" aria-label="Search manual payment requests" value="${escapeHtml(state.depositQuery)}" /><span class="count-badge">${requests.length} requests · ${pendingCount} pending</span></div>${state.loading ? '<div class="state-box">Loading payment requests...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows ? `<div class="table-wrap"><table><thead><tr><th>Request</th><th>User</th><th>Amount</th><th>Transaction ID</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="state-box">${emptyMessage}</div>`}</section>`;
}

function renderWithdrawals() {
  const requests = getFilteredWithdrawRequests();
  const rows = requests.map((request) => `<tr><td>#${request.id}</td><td><strong>${escapeHtml(request.fullName || request.username)}</strong><br /><small>${escapeHtml(request.username)} · ${escapeHtml(request.mobile)}</small></td><td>₹${Number(request.amount).toFixed(2)}</td><td><code>${escapeHtml(request.upiId)}</code></td><td>${escapeHtml(formatDate(request.createdAt))}</td><td><span class="status ${request.status === 'approved' ? 'active' : request.status === 'cancelled' ? 'danger' : 'neutral'}">${escapeHtml(request.status)}</span></td><td>${request.status === 'pending' ? `<button class="btn-primary" data-approve-withdraw="${request.id}">Approve</button> <button class="btn-danger" data-cancel-withdraw="${request.id}">Cancel</button>` : 'Reviewed'}</td></tr>`).join('');
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const emptyMessage = state.withdrawQuery ? 'No withdrawal requests match your search.' : 'No withdrawal requests yet.';
  return `<section class="panel"><div class="panel-toolbar"><strong>Withdrawal requests</strong><input id="withdraw-search" class="search-input" type="search" placeholder="Search by user, phone, amount, or UPI ID" aria-label="Search withdrawal requests" value="${escapeHtml(state.withdrawQuery)}" /><span class="count-badge">${requests.length} requests · ${pendingCount} pending</span></div>${state.loading ? '<div class="state-box">Loading withdrawals...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows ? `<div class="table-wrap"><table><thead><tr><th>Request</th><th>User</th><th>Amount</th><th>UPI ID</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="state-box">${emptyMessage}</div>`}</section>`;
}

function renderAnnouncements() {
  const item = state.editingAnnouncement;
  const form = `<form id="announcement-form" class="announcement-form"><label>Title<input name="title" maxlength="255" value="${escapeHtml(item?.title || '')}" placeholder="Optional title" /></label><label>Message<textarea name="message" maxlength="2000" required placeholder="Announcement message">${escapeHtml(item?.message || '')}</textarea></label><label class="checkbox-label"><input name="isActive" type="checkbox" ${item?.isActive !== false ? 'checked' : ''} /> Active</label><div class="form-actions"><button class="btn-primary" type="submit">${item ? 'Update Announcement' : 'Save Announcement'}</button>${item ? '<button class="btn-secondary" type="button" id="cancel-edit">Cancel</button>' : ''}</div></form>`;
  const rows = state.announcements.map((announcement) => `<article class="announcement-row"><div><div class="announcement-row-title">${escapeHtml(announcement.title || 'Announcement')} <span class="status ${announcement.isActive ? 'active' : ''}">${announcement.isActive ? 'Active' : 'Inactive'}</span></div><p>${escapeHtml(announcement.message)}</p><small>Created ${escapeHtml(formatDate(announcement.createdAt))} · Updated ${escapeHtml(formatDate(announcement.updatedAt))}</small></div><div class="row-actions"><button class="btn-secondary" data-edit="${announcement.id}">Edit</button><button class="btn-secondary" data-toggle="${announcement.id}">${announcement.isActive ? 'Deactivate' : 'Activate'}</button><button class="btn-danger" data-delete="${announcement.id}">Delete</button></div></article>`).join('');
  return `<section class="panel"><div class="announcement-panel-header"><h2>${item ? 'Edit announcement' : 'New announcement'}</h2><p class="page-subtitle">Only active announcements appear in the mobile app.</p></div>${form}</section><section class="panel announcement-list"><div class="panel-toolbar"><strong>All announcements</strong><span class="count-badge">${state.announcements.length}</span></div>${state.loading ? '<div class="state-box">Loading announcements...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows || '<div class="state-box">No announcements yet.</div>'}</section>`;
}

function renderNotifications() {
  const item = state.editingNotification;
  const form = `<form id="notification-form" class="announcement-form"><label>Title<input name="title" maxlength="255" value="${escapeHtml(item?.title || '')}" placeholder="Optional title" /></label><label>Message<textarea name="message" maxlength="2000" required placeholder="Notification message">${escapeHtml(item?.message || '')}</textarea></label><label class="checkbox-label"><input name="isActive" type="checkbox" ${item?.isActive !== false ? 'checked' : ''} /> Active</label><div class="form-actions"><button class="btn-primary" type="submit">${item ? 'Update Notification' : 'Send Notification'}</button>${item ? '<button class="btn-secondary" type="button" id="cancel-notification-edit">Cancel</button>' : ''}</div></form>`;
  const rows = state.notifications.map((notification) => `<article class="announcement-row"><div><div class="announcement-row-title">${escapeHtml(notification.title || 'Notification')} <span class="status ${notification.isActive ? 'active' : ''}">${notification.isActive ? 'Active' : 'Inactive'}</span></div><p>${escapeHtml(notification.message)}</p><small>Created ${escapeHtml(formatDate(notification.createdAt))} · Updated ${escapeHtml(formatDate(notification.updatedAt))}</small></div><div class="row-actions"><button class="btn-secondary" data-edit-notification="${notification.id}">Edit</button><button class="btn-secondary" data-toggle-notification="${notification.id}">${notification.isActive ? 'Deactivate' : 'Activate'}</button><button class="btn-danger" data-delete-notification="${notification.id}">Delete</button></div></article>`).join('');
  return `<section class="panel"><div class="announcement-panel-header"><h2>${item ? 'Edit notification' : 'New notification'}</h2><p class="page-subtitle">Active notifications appear in the mobile app and trigger the unread badge.</p></div>${form}</section><section class="panel announcement-list"><div class="panel-toolbar"><strong>All notifications</strong><span class="count-badge">${state.notifications.length}</span></div>${state.loading ? '<div class="state-box">Loading notifications...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows || '<div class="state-box">No notifications yet.</div>'}</section>`;
}

function renderSendNotification() {
  return `<section class="panel"><div class="announcement-panel-header"><h2>Compose push notification</h2></div><form id="send-notification-form" class="announcement-form"><label>Title<input name="title" maxlength="255" required placeholder="Notification title" /></label><label>Notification text<textarea name="message" maxlength="2000" required placeholder="Write a message for all app users"></textarea></label><label>Link / URL<input name="link" maxlength="1000" placeholder="https://example.com or /match/123" /></label><label>Icon / image URL<input name="iconUrl" type="url" maxlength="1000" placeholder="https://example.com/notification-image.png" /></label><label>Upload icon / image<input name="iconFile" type="file" accept="image/png,image/jpeg,image/webp" /></label><div class="form-actions"><button class="btn-primary" type="submit">Send Notification</button></div></form></section>`;
}

function renderAdminAccount() {
  const username = state.adminAccount?.username || '';
  const ownerEmail = state.adminAccount?.ownerEmail || state.adminStatus?.ownerEmail || '';
  const staffRows = state.staffAccounts.map((staff) => `<article class="announcement-row"><div><div class="announcement-row-title">${escapeHtml(staff.username)}</div><small>Created ${escapeHtml(formatDate(staff.createdAt))}</small></div><button class="btn-danger" data-delete-staff="${staff.id}">Remove staff</button></article>`).join('');
  return `<section class="panel admin-account-panel"><div class="announcement-panel-header"><h2>Admin credentials</h2><p class="page-subtitle">The recovery email is fixed in backend source code and cannot be changed here.</p></div><dl class="admin-account-details"><div><dt>Username</dt><dd>${escapeHtml(username)}</dd></div><div><dt>Recovery email</dt><dd>${escapeHtml(ownerEmail)}</dd></div></dl></section><section class="panel admin-account-panel"><div class="announcement-panel-header"><h2>Change username or password</h2><p class="page-subtitle">Enter your current password to confirm this change.</p></div><form id="admin-change-form" class="announcement-form"><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required /></label><label>New username<input name="username" minlength="3" maxlength="40" value="${escapeHtml(username)}" autocomplete="username" /></label><label>New password<input name="password" type="password" minlength="10" autocomplete="new-password" placeholder="Leave blank to keep current password" /></label><div class="form-actions"><button class="btn-primary" type="submit">Update credentials</button></div></form></section><section class="panel admin-account-panel"><div class="announcement-panel-header"><h2>Staff sign up</h2><p class="page-subtitle">Create a staff login for match management. Staff accounts can only access match operations.</p></div><form id="staff-create-form" class="announcement-form"><label>Staff username<input name="username" minlength="3" maxlength="40" autocomplete="off" required /></label><label>Staff password<input name="password" type="password" minlength="10" maxlength="200" autocomplete="new-password" required /></label><div class="form-actions"><button class="btn-primary" type="submit">Create staff login</button><a class="btn-secondary" href="/stuff-admin-panel/login.html" target="_blank" rel="noreferrer">Open staff panel</a></div></form><div class="panel-toolbar"><strong>Staff accounts</strong><span class="count-badge">${state.staffAccounts.length}</span></div>${staffRows || '<div class="state-box">No staff accounts created.</div>'}</section><section class="panel admin-account-panel danger-zone"><div class="announcement-panel-header"><h2>Remove admin login</h2><p class="page-subtitle">This removes the current username and password. An owner-email code is required, and the login must be set up again afterward.</p></div><form id="admin-delete-form" class="announcement-form"><label>Email verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></label><div class="form-actions"><button class="btn-secondary" type="button" id="request-delete-code">Send code</button><button class="btn-danger" type="submit">Remove credentials</button></div></form></section>`;
}

function renderContacts() {
  const rows = state.contacts.map((contact) => `<article class="announcement-row"><div><div class="announcement-row-title">${escapeHtml(contact.label)} <span class="status ${contact.isActive ? 'active' : ''}">${contact.isActive ? 'Active' : 'Inactive'}</span></div><p>${escapeHtml(contact.type)} · ${escapeHtml(contact.value)}</p></div><div class="row-actions"><button class="btn-secondary" data-toggle-contact="${contact.id}">${contact.isActive ? 'Deactivate' : 'Activate'}</button><button class="btn-danger" data-delete-contact="${contact.id}">Delete</button></div></article>`).join('');
  return `<section class="panel"><div class="announcement-panel-header"><h2>Add contact option</h2><p class="page-subtitle">These options appear in the app Contact page.</p></div><form id="contact-form" class="announcement-form"><label>Contact type<select name="type"><option value="phone">Phone</option><option value="telegram">Telegram</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></label><label>Label<input name="label" maxlength="100" placeholder="Phone support" required /></label><label>Number, username, or email<input name="value" maxlength="255" placeholder="4656465543" required /></label><label>Display order<input name="displayOrder" type="number" min="0" value="0" /></label><label class="checkbox-label"><input name="isActive" type="checkbox" checked /> Active</label><button class="btn-primary" type="submit">Save Contact</button></form></section><section class="panel announcement-list"><div class="panel-toolbar"><strong>Contact options</strong><span class="count-badge">${state.contacts.length}</span></div>${state.loading ? '<div class="state-box">Loading contacts...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows || '<div class="state-box">No contact options yet.</div>'}</section>`;
}

function renderBanners() {
  const form = `<form id="banner-form" class="announcement-form"><label>Banner image<input id="banner-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label><img id="banner-preview" class="banner-preview" alt="Selected banner preview" hidden /><label>Optional link<input name="targetUrl" type="url" placeholder="https://example.com" /></label><label>Display order<input name="displayOrder" type="number" min="0" step="1" value="0" required /></label><label class="checkbox-label"><input name="isActive" type="checkbox" checked /> Active</label><button class="btn-primary" type="submit">Upload Banner</button></form>`;
  const rows = state.banners.map((banner) => `<article class="announcement-row"><div class="banner-row-info"><img class="banner-thumb" src="${escapeHtml(banner.imageUrl)}" alt="Banner ${banner.id}" /><div><div class="announcement-row-title">Order ${banner.displayOrder} <span class="status ${banner.isActive ? 'active' : ''}">${banner.isActive ? 'Active' : 'Inactive'}</span></div><small>Created ${escapeHtml(formatDate(banner.createdAt))}${banner.targetUrl ? ` · <a href="${escapeHtml(banner.targetUrl)}" target="_blank" rel="noreferrer">Open link</a>` : ''}</small></div></div><div class="row-actions"><label class="order-control">Order<input data-order="${banner.id}" type="number" min="0" value="${banner.displayOrder}" /></label><label class="order-control">Link<input data-link="${banner.id}" type="url" value="${escapeHtml(banner.targetUrl || '')}" placeholder="Optional URL" /></label><button class="btn-secondary" data-toggle-banner="${banner.id}">${banner.isActive ? 'Deactivate' : 'Activate'}</button><button class="btn-danger" data-delete-banner="${banner.id}">Delete</button></div></article>`).join('');
  return `<section class="panel"><div class="announcement-panel-header"><h2>Upload banner</h2><p class="page-subtitle">Use JPG, PNG, or WebP images up to 5 MB.</p></div>${form}</section><section class="panel announcement-list"><div class="panel-toolbar"><strong>Uploaded banners</strong><span class="count-badge">${state.banners.length}</span></div>${state.loading ? '<div class="state-box">Loading banners...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows || '<div class="state-box">No banners uploaded yet.</div>'}</section>`;
}

function renderGames() {
  const game = state.editingGame;
  const form = `<form id="game-form" class="announcement-form"><label>Game name<input name="name" maxlength="150" required value="${escapeHtml(game?.name || '')}" placeholder="Game name" /></label><label>Game image<input id="game-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" ${game ? '' : 'required'} /></label><img id="game-preview" class="banner-preview" alt="Selected game preview" ${game ? `src="${escapeHtml(game.imageUrl)}"` : ''} ${game ? '' : 'hidden'} /><label>Display order<input name="displayOrder" type="number" min="0" step="1" value="${game?.displayOrder ?? 0}" required /></label><label class="checkbox-label"><input name="isActive" type="checkbox" ${game?.isActive !== false ? 'checked' : ''} /> Active</label><div class="form-actions"><button class="btn-primary" type="submit">${game ? 'Update Game' : 'Save Game'}</button>${game ? '<button class="btn-secondary" type="button" id="cancel-game-edit">Cancel</button>' : ''}</div></form>`;
  const rows = state.games.map((item) => `<article class="announcement-row"><div class="banner-row-info"><img class="banner-thumb" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" /><div><div class="announcement-row-title">${escapeHtml(item.name)} <span class="status ${item.isActive ? 'active' : ''}">${item.isActive ? 'Active' : 'Inactive'}</span></div><small>Order ${item.displayOrder} · Created ${escapeHtml(formatDate(item.createdAt))}</small></div></div><div class="row-actions"><button class="btn-secondary" data-edit-game="${item.id}">Edit</button><button class="btn-secondary" data-toggle-game="${item.id}">${item.isActive ? 'Deactivate' : 'Activate'}</button><button class="btn-danger" data-delete-game="${item.id}">Delete</button></div></article>`).join('');
  return `<section class="panel"><div class="announcement-panel-header"><h2>${game ? 'Edit game' : 'Add game'}</h2><p class="page-subtitle">Use JPG, PNG, or WebP images up to 5 MB.</p></div>${form}</section><section class="panel announcement-list"><div class="panel-toolbar"><strong>eSport Games</strong><span class="count-badge">${state.games.length}</span></div>${state.loading ? '<div class="state-box">Loading games...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows || '<div class="state-box">No games added yet.</div>'}</section>`;
}

function renderRules() {
  const item = state.editingRule;
    const form = `<form id="rule-form" class="announcement-form"><label>Rule title<input name="title" maxlength="255" required value="${escapeHtml(item?.title || '')}" /></label><label>Rule content<textarea name="content" maxlength="5000" required>${escapeHtml(item?.content || '')}</textarea></label><label>Match slot<input name="matchSlot" maxlength="100" value="${escapeHtml(item?.matchSlot || 'all')}" placeholder="all, slot-1, slot-2" /></label><label>Display order<input name="displayOrder" type="number" min="0" value="${item?.displayOrder ?? 0}" /></label><label class="checkbox-label"><input name="isActive" type="checkbox" ${item?.isActive !== false ? 'checked' : ''} /> Active</label><div class="form-actions"><button class="btn-primary" type="submit">${item ? 'Update Rule' : 'Save Rule'}</button>${item ? '<button class="btn-secondary" type="button" id="cancel-rule-edit">Cancel</button>' : ''}</div></form>`;
  const rows = state.rules.map((rule) => `<article class="announcement-row"><div><div class="announcement-row-title">${escapeHtml(rule.title)} <span class="status ${rule.isActive ? 'active' : ''}">${rule.isActive ? 'Active' : 'Inactive'}</span></div><p>${escapeHtml(rule.content)}</p></div><div class="row-actions"><button class="btn-secondary" data-edit-rule="${rule.id}">Edit</button><button class="btn-secondary" data-toggle-rule="${rule.id}">${rule.isActive ? 'Deactivate' : 'Activate'}</button><button class="btn-danger" data-delete-rule="${rule.id}">Delete</button></div></article>`).join('');
  return `<section class="panel"><div class="announcement-panel-header"><h2>${item ? 'Edit rule' : 'Add rule'}</h2><p class="page-subtitle">Rules shown to players for matches and contests.</p></div>${form}</section><section class="panel announcement-list"><div class="panel-toolbar"><strong>Match rules</strong><span class="count-badge">${state.rules.length}</span></div>${state.loading ? '<div class="state-box">Loading rules...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows || '<div class="state-box">No rules yet.</div>'}</section>`;
}

function renderMatchBanners() {
  const form = `<form id="match-banner-form" class="announcement-form"><label>Title<input name="title" maxlength="255" required /></label><label>Banner image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label>Match slot<input name="matchSlot" maxlength="100" value="all" placeholder="all, slot-1, slot-2" /></label><label>Display order<input name="displayOrder" type="number" min="0" value="0" /></label><label class="checkbox-label"><input name="isActive" type="checkbox" checked /> Active</label><button class="btn-primary" type="submit">Upload Match Banner</button></form>`;
  const rows = state.matchBanners.map((banner) => `<article class="announcement-row"><div class="banner-row-info"><img class="banner-thumb" src="${escapeHtml(banner.imageUrl)}" alt="${escapeHtml(banner.title)}" /><div><div class="announcement-row-title">${escapeHtml(banner.title)} <span class="status ${banner.isActive ? 'active' : ''}">${banner.isActive ? 'Active' : 'Inactive'}</span></div><small>Order ${banner.displayOrder}</small></div></div><div class="row-actions"><button class="btn-secondary" data-toggle-match-banner="${banner.id}">${banner.isActive ? 'Deactivate' : 'Activate'}</button><button class="btn-danger" data-delete-match-banner="${banner.id}">Delete</button></div></article>`).join('');
  return `<section class="panel"><div class="announcement-panel-header"><h2>Upload match banner</h2><p class="page-subtitle">Dedicated banners for match screens.</p></div>${form}</section><section class="panel announcement-list"><div class="panel-toolbar"><strong>Match banners</strong><span class="count-badge">${state.matchBanners.length}</span></div>${state.loading ? '<div class="state-box">Loading match banners...</div>' : state.error ? `<div class="state-box error">${escapeHtml(state.error)}</div>` : rows || '<div class="state-box">No match banners yet.</div>'}</section>`;
}

function renderMatchForm() {
  const match = { ...(state.editingMatch || {}) };
  if (match.matchSchedule) {
    match.matchSchedule = `${formatMatchDateTimeLocal(match.matchSchedule)}:00Z`;
  }
  const selectedGameId = match.gameId ?? '';
  const selectedBannerId = match.matchBannerId ?? match.bannerId ?? '';
  const gameOptions = state.games.map((game) => `<option value="${game.id}" ${String(game.id) === String(selectedGameId) ? 'selected' : ''}>${escapeHtml(game.name)}</option>`).join('');
  const bannerOptions = state.matchBanners.map((banner) => `<option value="${banner.id}" ${String(banner.id) === String(selectedBannerId) ? 'selected' : ''}>${escapeHtml(banner.title || 'Match Banner')}</option>`).join('');

  return `<section class="panel form-panel"><div class="form-header"><div><h2>${match.id ? 'Edit Match' : 'Create Match'}</h2></div><button type="button" class="btn-secondary" data-close-match-form>Cancel</button></div><form id="match-form" class="match-form"><div class="form-section"><h3>Room Description *</h3><div class="rich-editor"><div class="editor-toolbar"><button type="button" data-editor-command="bold"><strong>B</strong></button><button type="button" data-editor-command="italic"><em>I</em></button><button type="button" data-editor-command="strikeThrough"><span>S</span></button><button type="button" data-editor-command="insertUnorderedList">• List</button><button type="button" data-editor-command="createLink">Link</button><button type="button" data-editor-command="insertImage">Image</button><button type="button" data-editor-command="formatBlock" value="blockquote">Quote</button></div><div class="editor-content" data-rich-editor="roomDescription" contenteditable="true">${match.roomDescription || ''}</div></div></div><div class="form-grid two-column"><div class="form-field"><label>Game *</label><select name="gameId"><option value="">Select game</option>${gameOptions}</select></div><div class="form-field"><label>Match/Event Name *</label><input name="eventName" value="${escapeHtml(match.eventName || '')}" placeholder="CLASH SQUAD 1VS1" /></div><div class="form-field"><label>Match URL *</label><input name="matchUrl" value="${escapeHtml(match.matchUrl || 'https://youtube.com/')}" placeholder="https://youtube.com/" /></div><div class="form-field"><label>Match Schedule *</label><input name="matchSchedule" type="datetime-local" value="${match.matchSchedule ? new Date(match.matchSchedule).toISOString().slice(0, 16) : '2026-09-06T08:20'}" /></div><div class="form-field"><label>Prize Pool *</label><input name="prizePool" type="number" min="0" step="1" value="${match.prizePool ?? 40}" /></div><div class="form-field"><label>Per Kill</label><input name="perKill" type="number" min="0" step="1" value="${match.perKill ?? 0}" /></div><div class="form-field"><label>Team *</label><select name="teamType"><option value="SOLO" ${match.teamType === 'SOLO' ? 'selected' : ''}>SOLO</option><option value="DUO" ${match.teamType === 'DUO' ? 'selected' : ''}>DUO</option><option value="SQUAD" ${match.teamType === 'SQUAD' ? 'selected' : ''}>SQUAD</option></select></div><div class="form-field"><label>Entry Fee *</label><input name="entryFee" type="number" min="0" step="1" value="${match.entryFee ?? 25}" /></div><div class="form-field"><label>Total Player *</label><input name="totalPlayers" type="number" min="1" step="1" value="${match.totalPlayers ?? 2}" /></div><div class="form-field"><label>Map *</label><input name="map" value="${escapeHtml(match.map || 'Bermuda')}" placeholder="Bermuda" /></div><div class="form-field"><label>Match Status</label><select name="status"><option value="Upcoming" ${match.status === 'Upcoming' ? 'selected' : ''}>Upcoming</option><option value="Ongoing" ${match.status === 'Ongoing' ? 'selected' : ''}>Ongoing</option><option value="Complete" ${match.status === 'Complete' ? 'selected' : ''}>Complete</option><option value="Cancelled" ${match.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select></div></div><div class="form-section banner-row"><div class="banner-upload"><h3>Browse Banner</h3><input type="file" name="bannerFile" accept="image/jpeg,image/png,image/webp" /><small>Upload 1000x500 size of image for better view in app.</small></div><div class="banner-select"><h3>Select Banner</h3><select name="bannerId"><option value="">Choose existing banner</option>${bannerOptions}</select>${match.bannerUrl ? `<img src="${escapeHtml(match.bannerUrl)}" class="banner-preview" alt="Selected banner" />` : '<div class="preview-box">No banner selected</div>'}</div></div><div class="form-section"><h3>Prize Description</h3><div class="rich-editor"><div class="editor-toolbar"><button type="button" data-editor-command="bold"><strong>B</strong></button><button type="button" data-editor-command="italic"><em>I</em></button><button type="button" data-editor-command="insertUnorderedList">• List</button><button type="button" data-editor-command="createLink">Link</button></div><div class="editor-content" data-rich-editor="prizeDescription" contenteditable="true">${match.prizeDescription || '1st Place - ₹30<br>2nd Place - ₹10'}</div></div></div><div class="form-section"><h3>Match Description</h3><div class="rich-editor"><div class="editor-toolbar"><button type="button" data-editor-command="bold"><strong>B</strong></button><button type="button" data-editor-command="italic"><em>I</em></button><button type="button" data-editor-command="insertUnorderedList">• List</button><button type="button" data-editor-command="createLink">Link</button></div><div class="editor-content" data-rich-editor="matchDescription" contenteditable="true">${match.matchDescription || 'Custom room settings:'}</div></div></div><div class="form-section"><h3>Match Private Description <span class="muted-text">(Only match join member can see)</span></h3><div class="rich-editor"><div class="editor-toolbar"><button type="button" data-editor-command="bold"><strong>B</strong></button><button type="button" data-editor-command="italic"><em>I</em></button><button type="button" data-editor-command="insertUnorderedList">• List</button><button type="button" data-editor-command="createLink">Link</button></div><div class="editor-content" data-rich-editor="privateDescription" contenteditable="true">${match.privateDescription || 'Private instructions for members only.'}</div></div></div><div class="form-actions end"><button class="btn-primary" type="submit">${match.id ? 'Save Changes' : 'Create Match'}</button><button type="button" class="btn-secondary" data-close-match-form>Cancel</button></div></form></section>`;
}

function renderMatchDetailCard(match) {
  return `<div class="detail-grid">
    <div class="detail-card"><span>Match ID</span><strong>#${match.matchId || match.id}</strong></div>
    <div class="detail-card"><span>Game</span><strong>${escapeHtml(match.gameName || 'Unknown')}</strong></div>
    <div class="detail-card"><span>Event</span><strong>${escapeHtml(match.eventName || '—')}</strong></div>
    <div class="detail-card"><span>Schedule</span><strong>${escapeHtml(formatDate(match.matchSchedule))}</strong></div>
    <div class="detail-card"><span>Status</span><strong>${renderStatusBadge(match.status || 'Upcoming')}</strong></div>
    <div class="detail-card"><span>Prize Pool</span><strong>₹${Number(match.prizePool || 0).toFixed(2)}</strong></div>
    <div class="detail-card"><span>Entry Fee</span><strong>₹${Number(match.entryFee || 0).toFixed(2)}</strong></div>
    <div class="detail-card"><span>Players Joined</span><strong>${match.joinedPlayers || 0}</strong></div>
    <div class="detail-card"><span>Room ID</span><strong>${escapeHtml(match.roomId || 'Not set')}</strong></div>
  </div>`;
}

function renderMatchDetails() {
  const match = state.selectedMatch;
  if (!match) return '';
  const players = state.selectedMatchPlayers || [];
  return `<section class="panel detail-panel"><div class="detail-header"><div><h2>Match Details</h2></div><button class="btn-secondary" type="button" data-close-match-detail>Close</button></div>${renderMatchDetailCard(match)}<div class="players-table-wrap"><h3>Players / Participants</h3><table><thead><tr><th>Player ID</th><th>Username</th><th>Name</th><th>Join Date</th><th>Entry Fee</th><th>Status</th><th>Result</th><th>Actions</th></tr></thead><tbody>${players.length ? players.map((player) => `<tr><td>${player.userId || player.id}</td><td>${escapeHtml(player.username || '—')}</td><td>${escapeHtml(player.name || '—')}</td><td>${escapeHtml(formatDate(player.joinedAt))}</td><td>₹${Number(player.entryFee || 0).toFixed(2)}</td><td>${escapeHtml(player.status || 'Joined')}</td><td>${escapeHtml(player.result || '—')}</td><td><button class="link-action" data-remove-player="${player.id}">Remove</button></td></tr>`).join('') : '<tr><td colspan="8">No players joined yet.</td></tr>'}</tbody></table></div></section>`;
}

function renderMatchResult() {
  const match = state.selectedResultMatch;
  const players = state.selectedResultPlayers || [];
  if (!match) return '';
  return `<section class="panel detail-panel result-panel"><div class="detail-header"><div><h2>Match Result</h2><p class="form-intro">${escapeHtml(match.event_name || 'Match')} · Kill prize: ₹${Number(match.per_kill || 0).toFixed(2)} per kill</p></div><button class="btn-secondary" type="button" data-close-match-result>Back to Matches</button></div><form id="match-result-form"><div class="players-table-wrap result-table-wrap"><table><thead><tr><th>Username</th><th>In-game Name</th><th>Kills</th><th>Position</th><th>Booyah Prize</th><th>Total Prize</th></tr></thead><tbody>${players.length ? players.map((player) => `<tr data-result-row="${player.id}" data-kill-rate="${Number(match.per_kill || 0)}"><td>${escapeHtml(player.username || '—')}</td><td>${escapeHtml(player.inGameName || player.name || '—')}</td><td><input class="result-input result-kills" name="kills" type="number" min="0" step="1" value="${Number(player.kills || 0)}" /></td><td><input class="result-input" name="position" type="text" maxlength="30" value="${escapeHtml(player.position || '')}" placeholder="1st" /></td><td><input class="result-input result-booyah" name="booyahPrize" type="number" min="0" step="0.01" value="${Number(player.booyahPrize || 0)}" /></td><td class="result-total">₹${Number(player.totalPrize || 0).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">No joined members for this match.</td></tr>'}</tbody></table></div><div class="form-actions result-actions"><button class="btn-primary" type="submit" ${players.length ? '' : 'disabled'}>Save Result</button></div></form></section>`;
}

function renderMatches() {
  const matches = getFilteredMatches();
  const totalPages = Math.max(1, Math.ceil(matches.length / state.matchPageSize));
  if (state.matchPage > totalPages) state.matchPage = totalPages;
  const start = (state.matchPage - 1) * state.matchPageSize;
  const visibleMatches = matches.slice(start, start + state.matchPageSize);
  const allSelected = visibleMatches.length > 0 && visibleMatches.every((match) => state.selectedMatchIds.has(match.id));
  const allowedStatuses = { Upcoming: ['Upcoming', 'Ongoing', 'Cancelled'], Ongoing: ['Ongoing', 'Complete', 'Cancelled'], Complete: ['Complete'], Cancelled: ['Cancelled'] };

  return `<section class="panel matches-panel"><div class="table-header"><div class="table-controls"><label class="page-size"><span>Show</span><select id="match-page-size"><option value="10" ${state.matchPageSize === 10 ? 'selected' : ''}>10</option><option value="25" ${state.matchPageSize === 25 ? 'selected' : ''}>25</option><option value="50" ${state.matchPageSize === 50 ? 'selected' : ''}>50</option></select><span>entries</span></label><div class="search-box"><input id="match-search" type="search" placeholder="Search matches" value="${escapeHtml(state.matchQuery)}" /></div></div><div class="header-actions match-header-actions"><button class="btn-primary" id="new-match-btn">Create Match</button></div></div><div class="bulk-toolbar"><div class="bulk-left"><select id="bulk-action"><option value="">Bulk action</option><option value="delete">Delete Selected</option><option value="cancel">Cancel Selected</option><option value="complete">Complete Selected</option></select><button class="btn-secondary" id="apply-bulk-btn" type="button">Apply</button></div></div><div class="table-wrap"><table class="match-table"><thead><tr><th class="checkbox-col"><input id="select-all-matches" type="checkbox" ${allSelected ? 'checked' : ''} /></th><th>Match ID</th><th>Game Name</th><th>Match/Event Name</th><th>Match Schedule</th><th>Total Player</th><th>Total Player Joined</th><th>Win Prize</th><th>Entry Fee</th><th>Match Type</th><th>Match Status</th><th>Actions</th><th>Room Details</th><th>Result</th><th>View</th></tr></thead><tbody>${visibleMatches.length ? visibleMatches.map((match) => `<tr><td><input type="checkbox" data-select-match="${match.id}" ${state.selectedMatchIds.has(match.id) ? 'checked' : ''} /></td><td>${match.matchId || match.id}</td><td>${escapeHtml(match.gameName || '—')}</td><td>${escapeHtml(match.eventName || '—')}</td><td>${escapeHtml(formatDate(match.matchSchedule))}</td><td>${match.totalPlayers || 0}</td><td>${match.joinedPlayers || 0}</td><td>₹${Number(match.prizePool || 0).toFixed(2)}</td><td>₹${Number(match.entryFee || 0).toFixed(2)}</td><td>${escapeHtml(match.matchType || 'Paid')}</td><td><select class="match-status-select" data-status-match="${match.id}">${['Upcoming', 'Ongoing', 'Complete', 'Cancelled'].map((status) => `<option value="${status}" ${status === (match.status || 'Upcoming') ? 'selected' : ''}>${status}</option>`).join('')}</select></td><td class="table-actions"><button class="icon-btn" data-edit-match="${match.id}" title="Edit">Edit</button><button class="icon-btn danger" data-delete-match="${match.id}" title="Delete">Delete</button></td><td><button class="icon-btn" data-room-details="${match.id}" title="Update room details">${match.roomId ? 'Update' : 'Add'}</button></td><td><button class="icon-btn result-btn" data-result-match="${match.id}" title="Enter match result">Result</button></td><td><button class="icon-btn view-btn" data-view-match="${match.id}" title="View">View</button></td></tr>`).join('') : '<tr><td colspan="15" class="empty-cell">No matches found.</td></tr>'}</tbody></table></div><div class="pagination"><button type="button" data-page="prev" ${state.matchPage <= 1 ? 'disabled' : ''}>Prev</button><span>Page ${state.matchPage} of ${totalPages}</span><button type="button" data-page="next" ${state.matchPage >= totalPages ? 'disabled' : ''}>Next</button></div></section>`;
}

function renderPage() {
  if (isStaffPanel && !state.adminToken) {
    window.location.replace('/stuff-admin-panel/login.html');
    return;
  }
  if (!state.adminToken || (!isStaffPanel && !state.adminAccount)) {
    renderAuthPage();
    return;
  }
  
  const announcements = state.activeSection === 'announcements';
  const notifications = state.activeSection === 'notifications';
  const isSendNotification = state.activeSection === 'send-notification';
  const contacts = state.activeSection === 'contacts';
  const banners = state.activeSection === 'banners';
  const games = state.activeSection === 'games';
  const matches = state.activeSection === 'matches';
  const matchCreate = state.activeSection === 'match-create';
  const matchResult = state.activeSection === 'match-result';
  const title = matchResult ? 'Match Result' : matchCreate ? 'Create Match' : matches ? 'Match' : games ? 'Games Slot' : banners ? 'Banners' : contacts ? 'Contact' : notifications ? 'Notifications' : announcements ? 'Announcements' : state.activeSection === 'withdraw' ? 'Withdraw' : state.activeSection === 'dashboard' ? 'Dashboard' : 'Users';

  appEl.innerHTML = `<div class="layout"><aside class="sidebar"><div class="brand"><div class="brand-mark">B</div><div><p class="brand-title">BATTLE-NEXT</p><p class="brand-subtitle">Admin Panel</p></div></div><nav class="nav"><button class="nav-item ${matches ? 'active' : ''}" data-section="matches">Matches</button><button class="nav-item ${games ? 'active' : ''}" data-section="games">Games</button><button class="nav-item ${announcements ? 'active' : ''}" data-section="announcements">Announcements</button><button class="nav-item ${notifications ? 'active' : ''}" data-section="notifications">Notifications</button><button class="nav-item ${contacts ? 'active' : ''}" data-section="contacts">Contact</button><button class="nav-item ${banners ? 'active' : ''}" data-section="banners">Games Slot</button></nav></aside><main class="main"><header class="page-header"><div><h1>${title}</h1><p class="page-subtitle">${matches ? 'Manage esports match lifecycle and participant state.' : matchResult ? 'Enter kills, positions, and prizes for joined members.' : games ? 'Manage games shown in the mobile app.' : banners ? 'Manage images shown in the mobile carousel.' : contacts ? 'Manage phone, Telegram, and email support options.' : notifications ? 'Send messages and alerts to mobile app users.' : announcements ? 'Manage messages shown in the mobile app.' : 'Registered app users from the database'}</p></div><div class="header-actions"><input id="admin-key" class="key-input" type="password" placeholder="Admin API key" value="${escapeHtml(state.adminKey)}" /><button class="btn-secondary" id="refresh-btn">Refresh</button></div></header>${state.error ? `<div class="state-box error page-error">${escapeHtml(state.error)}</div>` : ''}${matches ? renderMatches() : matchResult ? renderMatchResult() : games ? renderGames() : banners ? renderBanners() : contacts ? renderContacts() : notifications ? renderNotifications() : announcements ? renderAnnouncements() : renderUsers()}${state.editingMatch ? renderMatchForm() : ''}${state.selectedMatch ? renderMatchDetails() : ''}</main></div>`;
  const layout = appEl.querySelector('.layout');
  if (isSendNotification) {
    const main = appEl.querySelector('.main');
    main?.querySelectorAll('.panel').forEach((panel) => panel.remove());
    main?.querySelector('.page-header')?.insertAdjacentHTML('afterend', renderSendNotification());
    const heading = main?.querySelector('.page-header h1');
    const subtitle = main?.querySelector('.page-header .page-subtitle');
    if (heading) heading.textContent = 'Send Notification';
    if (subtitle) subtitle.textContent = 'Broadcast a push notification to registered mobile devices.';
  }
  if (state.activeSection === 'account') {
    const main = appEl.querySelector('.main');
    main?.querySelectorAll('.panel').forEach((panel) => panel.remove());
    main?.querySelector('.page-header')?.insertAdjacentHTML('afterend', renderAdminAccount());
    const heading = main?.querySelector('.page-header h1');
    if (heading) heading.textContent = 'Admin account';
  }
  const sidebar = layout?.querySelector('.sidebar');
  const nav = appEl.querySelector('.nav');
  appEl.querySelector('.page-header > div > .page-subtitle')?.remove();
  appEl.querySelector('.page-header > .header-actions')?.remove();
  const userSearch = appEl.querySelector('#search-input');
  if (userSearch) {
    userSearch.placeholder = 'Search by username, name, number, or email';
    userSearch.setAttribute('aria-label', 'Search users by username, name, phone number, or email');
  }
  const matchSearch = appEl.querySelector('#match-search');
  if (matchSearch) {
    matchSearch.placeholder = 'Search by match ID';
    matchSearch.setAttribute('aria-label', 'Search matches by ID');
  }
  const pageHeading = appEl.querySelector('.page-header > div');
  if (nav && sidebar && pageHeading) {
    nav.id = 'primary-navigation';
    pageHeading.classList.add('page-title-group');
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'mobile-nav-toggle';
    menuButton.setAttribute('aria-label', 'Open navigation');
    menuButton.setAttribute('aria-controls', nav.id);
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.innerHTML = '<span aria-hidden="true"></span>';
    pageHeading.prepend(menuButton);

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mobile-nav-backdrop';
    backdrop.setAttribute('aria-label', 'Close navigation');
    layout.insertBefore(backdrop, sidebar.nextSibling);

    const closeNavigation = () => {
      layout.classList.remove('mobile-nav-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
    };
    menuButton.addEventListener('click', () => {
      const isOpen = layout.classList.toggle('mobile-nav-open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
    backdrop.addEventListener('click', closeNavigation);
  }
  if (nav) {
    const sections = isStaffPanel ? [['matches', 'Match']] : [
      ['dashboard', 'Dashboard'],
      ['matches', 'Match'],
      ['users', 'Users'],
      ['send-notification', 'Send Notification'],
      ['money', 'Transactions'],
      ['withdraw', 'Withdraw'],
      ['games', 'Games Slot'],
      ['match-banners', 'Match Banner'],
      ['banners', 'Banners'],
      ['rules', 'Rules'],
      ['notifications', 'Notification'],
      ['announcements', 'Announcements'],
      ['contacts', 'Contact'],
      ['account', 'Admin account'],
    ];
    nav.innerHTML = `${sections.map(([section, label]) => `<button class="nav-item ${state.activeSection === section ? 'active' : ''}" data-section="${section}">${label}</button>`).join('')}<button class="nav-item nav-logout" id="sidebar-logout">Sign out</button>`;
  }
  const matchesNav = nav?.querySelector('[data-section="matches"]');
  const gamesNav = nav?.querySelector('[data-section="games"]');
  const bannersNav = nav?.querySelector('[data-section="banners"]');
  if (matchesNav) matchesNav.textContent = 'Match';
  if (gamesNav) gamesNav.textContent = 'Games Slot';
  if (bannersNav) bannersNav.textContent = 'Banners';
  if (state.activeSection === 'rules' || state.activeSection === 'match-banners') {
    const main = appEl.querySelector('.main');
    main?.querySelectorAll('.panel').forEach((panel) => panel.remove());
    main?.querySelector('.page-header')?.insertAdjacentHTML('afterend', state.activeSection === 'rules' ? renderRules() : renderMatchBanners());
    const heading = main?.querySelector('h1');
    if (heading) heading.textContent = state.activeSection === 'rules' ? 'Rules' : 'Match Banners';
  }
  if (state.activeSection === 'dashboard') {
    const main = appEl.querySelector('.main');
    main?.querySelectorAll('.panel').forEach((panel) => panel.remove());
    main?.querySelector('.page-header')?.insertAdjacentHTML('afterend', renderDashboard());
  }
  const moneyNav = nav?.querySelector('[data-section="money"]');
  if (moneyNav) moneyNav.classList.toggle('active', state.activeSection === 'money');
  const usersNav = nav?.querySelector('[data-section="users"]');
  if (usersNav) usersNav.classList.toggle('active', state.activeSection === 'users');
  const dashboardNav = nav?.querySelector('[data-section="dashboard"]');
  if (dashboardNav) dashboardNav.classList.toggle('active', state.activeSection === 'dashboard');
  const withdrawNav = nav?.querySelector('[data-section="withdraw"]');
  if (withdrawNav) withdrawNav.classList.toggle('active', state.activeSection === 'withdraw');
  if (state.activeSection === 'dashboard' || state.activeSection === 'money' || state.activeSection === 'withdraw') {
    const heading = appEl.querySelector('.page-header h1');
    const subtitle = appEl.querySelector('.page-header .page-subtitle');
    if (heading) heading.textContent = state.activeSection === 'dashboard' ? 'Dashboard' : state.activeSection === 'money' ? 'Transactions' : 'Withdraw';
    if (subtitle) subtitle.textContent = state.activeSection === 'dashboard' ? 'Live overview of users, wallets, matches, and pending reviews.' : state.activeSection === 'withdraw' ? 'Review user withdrawal requests and UPI details.' : 'Review legacy manual payment requests and credit approved wallet deposits.';
  }
  if ((state.activeSection === 'matches' || matchCreate) && state.editingMatch) {
    const matchGrid = appEl.querySelector('#match-form .form-grid');
    if (matchGrid) {
      matchGrid.insertAdjacentHTML('afterbegin', `<div class="form-field"><label>Game Version *</label><input name="gameVersion" maxlength="100" value="${escapeHtml(state.editingMatch.gameVersion || 'Current')}" placeholder="Current version" required /></div>`);
      const teamTypeField = matchGrid.querySelector('[name="teamType"]');
      if (teamTypeField && teamTypeField.tagName === 'INPUT') teamTypeField.outerHTML = `<select name="teamType"><option value="SOLO" ${state.editingMatch.teamType === 'SOLO' ? 'selected' : ''}>Solo</option><option value="DUO" ${state.editingMatch.teamType === 'DUO' ? 'selected' : ''}>Duo</option><option value="SQUAD" ${state.editingMatch.teamType === 'SQUAD' ? 'selected' : ''}>Squad</option></select>`;
      const gameField = matchGrid.querySelector('[name="gameId"]')?.closest('.form-field');
      if (gameField) {
        const gameLabel = gameField.querySelector('label');
        if (gameLabel) gameLabel.childNodes[0].textContent = 'Games Slot *';
        gameField.insertAdjacentHTML('afterend', `<div class="form-field"><label>Rules *</label><select name="ruleId" required><option value="">Select rules</option>${state.rules.map((rule) => `<option value="${rule.id}" ${String(rule.id) === String(state.editingMatch.ruleId || '') ? 'selected' : ''}>${escapeHtml(rule.title)}</option>`).join('')}</select></div>`);
      }
      const bannerSelect = matchGrid.closest('.match-form')?.querySelector('[name="bannerId"]');
      if (bannerSelect) {
        bannerSelect.name = 'matchBannerId';
        bannerSelect.innerHTML = `<option value="">Select banner</option>${state.matchBanners.map((banner) => `<option value="${banner.id}" ${String(banner.id) === String(state.editingMatch.matchBannerId || '') ? 'selected' : ''}>${escapeHtml(banner.title)}</option>`).join('')}`;
        const bannerLabel = bannerSelect.closest('.form-field')?.querySelector('label');
        if (bannerLabel) bannerLabel.childNodes[0].textContent = 'Match Banner';
      }
      for (const name of ['prizeDescription', 'matchDescription']) {
        const editor = matchGrid.closest('.match-form')?.querySelector(`[data-rich-editor="${name}"]`);
        if (editor) editor.outerHTML = `<textarea class="description-textarea" data-rich-editor="${name}" name="${name}" rows="4">${escapeHtml(editor.innerHTML)}</textarea>`;
      }
      const prizeSection = matchGrid.closest('.match-form')?.querySelector('[data-rich-editor="prizeDescription"]')?.closest('.form-section');
      if (prizeSection) matchGrid.insertBefore(prizeSection, matchGrid.firstChild);
      const ruleField = matchGrid.querySelector('[name="ruleId"]')?.closest('.form-field');
      if (prizeSection && ruleField) prizeSection.insertAdjacentElement('afterend', ruleField);
      matchGrid.querySelector('[name="matchSlot"]')?.closest('.form-field')?.remove();
      matchGrid.querySelector('[data-rich-editor="privateDescription"]')?.closest('.form-section')?.remove();
      matchGrid.closest('.match-form')?.querySelector('[data-rich-editor="matchDescription"]')?.closest('.form-section')?.remove();
      matchGrid.closest('.match-form')?.querySelector('[data-rich-editor="roomDescription"]')?.closest('.form-section')?.remove();
      const financialFields = ['entryFee', 'perKill', 'prizePool'].map((name) => matchGrid.querySelector(`[name="${name}"]`)?.closest('.form-field')).filter(Boolean);
      if (financialFields.length) {
        const layout = document.createElement('div');
        layout.className = 'match-form-columns';
        const financial = document.createElement('div');
        financial.className = 'match-financial-column';
        financial.innerHTML = '<h3>Match Rewards</h3>';
        const details = document.createElement('div');
        details.className = 'match-details-column';
        matchGrid.parentNode.insertBefore(layout, matchGrid);
        layout.append(financial, details);
        financialFields.forEach((field) => financial.appendChild(field));
        details.appendChild(matchGrid);
      }
      if (!state.editingMatch.id) {
        const matchForm = matchGrid.closest('.match-form');
        for (const [name, label] of [['teamType', 'Select team type'], ['status', 'Select match status']]) {
          const select = matchForm.elements.namedItem(name);
          if (select && !select.querySelector('option[value=""]')) {
            select.insertAdjacentHTML('afterbegin', `<option value="">${label}</option>`);
          }
        }
        matchForm.querySelectorAll('input:not([type="file"]), select, textarea').forEach((field) => {
          field.value = '';
          if ('placeholder' in field) field.placeholder = '';
        });
        const requiredFields = ['gameId', 'gameVersion', 'eventName', 'matchUrl', 'matchSchedule', 'prizePool', 'perKill', 'teamType', 'entryFee', 'totalPlayers', 'map', 'status', 'ruleId', 'prizeDescription'];
        for (const name of requiredFields) {
          const field = matchForm.elements.namedItem(name);
          if (!field) continue;
          field.required = true;
          const label = field.closest('.form-field')?.querySelector('label');
          const sectionTitle = field.closest('.form-section')?.querySelector('h3');
          const labelElement = label || sectionTitle;
          if (labelElement && !labelElement.textContent.trim().endsWith('*')) {
            labelElement.append(document.createTextNode(' *'));
          }
        }
      }
    }
  }
  if (matchCreate) {
    const main = appEl.querySelector('.main');
    main?.querySelectorAll('.panel:not(.form-panel)').forEach((panel) => panel.remove());
  }

  if (state.activeSection === 'matches') {
    bindMatchTableEvents();
  }

  if (matchResult) {
    appEl.querySelector('.main')?.querySelectorAll('.panel:not(.detail-panel)').forEach((panel) => panel.remove());
    bindMatchResultEvents();
  }

  document.querySelectorAll('[data-section]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeSection = button.dataset.section;
      state.error = null;
      state.editingAnnouncement = null;
      state.editingNotification = null;
      state.editingGame = null;
      state.editingRule = null;
      state.editingMatch = null;
      state.selectedMatch = null;
      state.selectedMatchPlayers = [];
      state.selectedResultMatch = null;
      state.selectedResultPlayers = [];
      loadActiveSection();
    });
  });

  const signOut = async () => {
    try {
      await apiFetch(isStaffPanel ? '/api/staff/auth/logout' : '/api/admin/auth/logout', { method: 'POST' });
    } catch {
    }
    clearAdminSession();
    if (isStaffPanel) {
      window.location.replace('/stuff-admin-panel/login.html');
      return;
    }
    state.authView = 'login';
    state.authMessage = '';
    state.authError = '';
    renderAuthPage();
  };
  document.getElementById('sidebar-logout')?.addEventListener('click', signOut);
  document.getElementById('logout-btn')?.addEventListener('click', signOut);
  document.getElementById('admin-change-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/api/admin/auth/change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.get('currentPassword'), username: form.get('username'), password: form.get('password') }),
      });
      clearAdminSession();
      state.adminStatus = { ...state.adminStatus, configured: true };
      state.authView = 'login';
      state.authMessage = 'Credentials updated. Sign in again.';
      renderAuthPage();
    } catch (error) {
      state.error = error.message;
      renderPage();
    }
  });
  document.getElementById('staff-create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      await loadAdminAccount();
      state.error = null;
    } catch (error) {
      state.error = error.message;
      renderPage();
    }
  });
  document.querySelectorAll('[data-delete-staff]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Remove this staff login? Their active sessions will stop working.')) return;
    try {
      await apiFetch(`/api/admin/staff/${button.dataset.deleteStaff}`, { method: 'DELETE' });
      await loadAdminAccount();
    } catch (error) {
      state.error = error.message;
      renderPage();
    }
  }));
  document.getElementById('request-delete-code')?.addEventListener('click', async () => {
    try {
      const data = await adminAuthRequest('request-code', { purpose: 'delete' });
      alert(data.message);
    } catch (error) {
      alert(error.message);
    }
  });
  document.getElementById('admin-delete-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('Remove the admin login credentials?')) return;
    const form = new FormData(event.currentTarget);
    try {
      await adminAuthRequest('delete', { purpose: 'delete', code: form.get('code') });
      clearAdminSession();
      state.adminStatus = { ...state.adminStatus, configured: false };
      state.authView = 'setup';
      state.authMessage = 'Admin credentials removed. Create a new login to continue.';
      renderAuthPage();
    } catch (error) {
      state.error = error.message;
      renderPage();
    }
  });

  document.getElementById('announcement-form')?.addEventListener('submit', saveAnnouncement);
  document.getElementById('cancel-edit')?.addEventListener('click', () => { state.editingAnnouncement = null; renderPage(); });
  document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => { state.editingAnnouncement = state.announcements.find((item) => item.id === Number(button.dataset.edit)); renderPage(); }));
  document.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => toggleAnnouncement(Number(button.dataset.toggle))));
  document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteAnnouncement(Number(button.dataset.delete))));
  document.querySelectorAll('[data-approve-request]').forEach((button) => button.addEventListener('click', () => reviewDepositRequest(Number(button.dataset.approveRequest), 'approve')));
  document.querySelectorAll('[data-reject-request]').forEach((button) => button.addEventListener('click', () => reviewDepositRequest(Number(button.dataset.rejectRequest), 'reject')));
  document.querySelectorAll('[data-approve-withdraw]').forEach((button) => button.addEventListener('click', () => reviewWithdrawRequest(Number(button.dataset.approveWithdraw), 'approve')));
  document.querySelectorAll('[data-cancel-withdraw]').forEach((button) => button.addEventListener('click', () => reviewWithdrawRequest(Number(button.dataset.cancelWithdraw), 'cancel')));
  document.getElementById('notification-form')?.addEventListener('submit', saveNotification);
  document.getElementById('send-notification-form')?.addEventListener('submit', submitPushNotification);
  document.getElementById('cancel-notification-edit')?.addEventListener('click', () => { state.editingNotification = null; renderPage(); });
  document.querySelectorAll('[data-edit-notification]').forEach((button) => button.addEventListener('click', () => { state.editingNotification = state.notifications.find((item) => item.id === Number(button.dataset.editNotification)); renderPage(); }));
  document.querySelectorAll('[data-toggle-notification]').forEach((button) => button.addEventListener('click', () => toggleNotification(Number(button.dataset.toggleNotification))));
  document.querySelectorAll('[data-delete-notification]').forEach((button) => button.addEventListener('click', () => deleteNotification(Number(button.dataset.deleteNotification))));
  document.getElementById('contact-form')?.addEventListener('submit', saveContact);
  document.querySelectorAll('[data-toggle-contact]').forEach((button) => button.addEventListener('click', () => toggleContact(Number(button.dataset.toggleContact))));
  document.querySelectorAll('[data-delete-contact]').forEach((button) => button.addEventListener('click', () => deleteContact(Number(button.dataset.deleteContact))));
  document.getElementById('banner-form')?.addEventListener('submit', saveBanner);
  document.getElementById('banner-image')?.addEventListener('change', (event) => { const file = event.target.files[0]; const preview = document.getElementById('banner-preview'); if (file && preview) { preview.src = URL.createObjectURL(file); preview.hidden = false; } });
  document.querySelectorAll('[data-toggle-banner]').forEach((button) => button.addEventListener('click', () => toggleBanner(Number(button.dataset.toggleBanner))));
  document.querySelectorAll('[data-delete-banner]').forEach((button) => button.addEventListener('click', () => deleteBanner(Number(button.dataset.deleteBanner))));
  document.querySelectorAll('[data-order]').forEach((input) => input.addEventListener('change', () => updateBanner(Number(input.dataset.order), Number(input.value))));
  document.querySelectorAll('[data-link]').forEach((input) => input.addEventListener('change', () => updateBannerLink(Number(input.dataset.link), input.value)));
  document.getElementById('game-form')?.addEventListener('submit', saveGame);
  document.getElementById('cancel-game-edit')?.addEventListener('click', () => { state.editingGame = null; renderPage(); });
  document.getElementById('game-image')?.addEventListener('change', (event) => { const file = event.target.files[0]; const preview = document.getElementById('game-preview'); if (file && preview) { preview.src = URL.createObjectURL(file); preview.hidden = false; } });
  document.querySelectorAll('[data-edit-game]').forEach((button) => button.addEventListener('click', () => { state.editingGame = state.games.find((item) => item.id === Number(button.dataset.editGame)); renderPage(); }));
  document.querySelectorAll('[data-toggle-game]').forEach((button) => button.addEventListener('click', () => toggleGame(Number(button.dataset.toggleGame))));
  document.querySelectorAll('[data-delete-game]').forEach((button) => button.addEventListener('click', () => deleteGame(Number(button.dataset.deleteGame))));
  document.getElementById('rule-form')?.addEventListener('submit', saveRule);
  document.getElementById('cancel-rule-edit')?.addEventListener('click', () => { state.editingRule = null; renderPage(); });
  document.querySelectorAll('[data-edit-rule]').forEach((button) => button.addEventListener('click', () => { state.editingRule = state.rules.find((item) => item.id === Number(button.dataset.editRule)); renderPage(); }));
  document.querySelectorAll('[data-toggle-rule]').forEach((button) => button.addEventListener('click', async () => { const rule = state.rules.find((item) => item.id === Number(button.dataset.toggleRule)); if (rule) { await apiFetch(`/api/rules/${rule.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !rule.isActive }) }); await loadRules(); } }));
  document.querySelectorAll('[data-delete-rule]').forEach((button) => button.addEventListener('click', async () => { if (window.confirm('Delete this rule?')) { await apiFetch(`/api/rules/${button.dataset.deleteRule}`, { method: 'DELETE' }); await loadRules(); } }));
  document.getElementById('match-banner-form')?.addEventListener('submit', saveMatchBanner);
  document.querySelectorAll('[data-toggle-match-banner]').forEach((button) => button.addEventListener('click', async () => { const banner = state.matchBanners.find((item) => item.id === Number(button.dataset.toggleMatchBanner)); if (banner) { await apiFetch(`/api/match-banners/${banner.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !banner.isActive }) }); await loadMatchBanners(); } }));
  document.querySelectorAll('[data-delete-match-banner]').forEach((button) => button.addEventListener('click', async () => { if (window.confirm('Delete this match banner?')) { await apiFetch(`/api/match-banners/${button.dataset.deleteMatchBanner}`, { method: 'DELETE' }); await loadMatchBanners(); } }));
  document.getElementById('match-form')?.addEventListener('submit', saveMatch);
  document.querySelectorAll('[data-close-match-form]').forEach((button) => button.addEventListener('click', () => { state.editingMatch = null; state.activeSection = 'matches'; renderPage(); }));
  document.querySelectorAll('[data-close-match-detail]').forEach((button) => button.addEventListener('click', () => { state.selectedMatch = null; state.selectedMatchPlayers = []; renderPage(); }));
  document.querySelectorAll('[data-close-match-result]').forEach((button) => button.addEventListener('click', () => { state.selectedResultMatch = null; state.selectedResultPlayers = []; state.activeSection = 'matches'; renderPage(); }));
  bindRichEditorHandlers();
}

function bindMatchTableEvents() {
  document.getElementById('new-match-btn')?.addEventListener('click', () => {
    state.editingMatch = {};
    state.selectedMatch = null;
    state.activeSection = 'match-create';
    loadMatchCreatePage();
  });

  document.getElementById('match-page-size')?.addEventListener('change', (event) => {
    state.matchPageSize = Number(event.target.value) || 10;
    state.matchPage = 1;
    renderPage();
  });

  document.getElementById('select-all-matches')?.addEventListener('change', (event) => {
    const checked = event.target.checked;
    const rows = [...document.querySelectorAll('[data-select-match]')];
    state.selectedMatchIds = new Set();
    if (checked) {
      rows.forEach((row) => state.selectedMatchIds.add(Number(row.dataset.selectMatch)));
    }
    renderPage();
  });

  document.querySelectorAll('[data-select-match]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const id = Number(event.target.dataset.selectMatch);
      if (event.target.checked) {
        state.selectedMatchIds.add(id);
      } else {
        state.selectedMatchIds.delete(id);
      }
      renderPage();
    });
  });

  document.querySelectorAll('[data-status-match]').forEach((select) => {
    select.addEventListener('change', async (event) => {
      const id = Number(event.target.dataset.statusMatch);
      const nextStatus = event.target.value;
      if (!window.confirm(`Are you sure you want to change this match status to ${nextStatus}?`)) {
        event.target.value = state.matches.find((match) => match.id === id)?.status || 'Upcoming';
        return;
      }
      try {
        const response = await apiFetch(`/api/admin/matches/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        state.error = null;
        state.selectedMatch = response.match;
        await loadMatches();
      } catch (error) {
        state.error = error.message;
        renderPage();
      }
    });
  });

  document.querySelectorAll('[data-delete-match]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.deleteMatch);
      if (!window.confirm('Are you sure you want to delete this match?')) return;
      try {
        await apiFetch(`/api/admin/matches/${id}`, { method: 'DELETE' });
        state.selectedMatchIds.delete(id);
        await loadMatches();
      } catch (error) {
        state.error = error.message;
        renderPage();
      }
    });
  });

  document.querySelectorAll('[data-edit-match]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.editMatch);
      const match = state.matches.find((item) => item.id === id);
      if (match) {
        state.editingMatch = match;
        state.selectedMatch = null;
        renderPage();
      }
    });
  });

  document.querySelectorAll('[data-view-match]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.viewMatch);
      await loadMatchDetails(id);
      renderPage();
    });
  });

  document.querySelectorAll('[data-result-match]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        state.error = null;
        await loadMatchResult(Number(button.dataset.resultMatch));
      } catch (error) {
        state.error = error.message;
        renderPage();
      }
    });
  });

  bindRoomDetailsEvents();

  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.page === 'next' ? 1 : -1;
      state.matchPage = Math.max(1, state.matchPage + next);
      renderPage();
    });
  });

  document.getElementById('apply-bulk-btn')?.addEventListener('click', async () => {
    const action = document.getElementById('bulk-action')?.value;
    const ids = [...state.selectedMatchIds];
    if (!action || ids.length === 0) return;

    const confirmMessage = action === 'delete' ? 'Delete selected matches?' : action === 'cancel' ? 'Cancel selected matches?' : 'Complete selected matches?';
    if (!window.confirm(confirmMessage)) return;

    try {
      for (const id of ids) {
        if (action === 'delete') {
          await apiFetch(`/api/admin/matches/${id}`, { method: 'DELETE' });
        } else {
          await apiFetch(`/api/admin/matches/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: action === 'cancel' ? 'Cancelled' : 'Complete' }),
          });
        }
      }
      state.selectedMatchIds = new Set();
      await loadMatches();
    } catch (error) {
      state.error = error.message;
      renderPage();
    }
  });

  document.querySelectorAll('[data-remove-player]').forEach((button) => {
    button.addEventListener('click', async () => {
      const playerId = Number(button.dataset.removePlayer);
      if (!state.selectedMatch?.id || !window.confirm('Remove this player from the match?')) return;
      try {
        await apiFetch(`/api/admin/matches/${state.selectedMatch.id}/players/${playerId}`, { method: 'DELETE' });
        await loadMatchDetails(state.selectedMatch.id);
        renderPage();
      } catch (error) {
        state.error = error.message;
        renderPage();
      }
    });
  });
}

function bindRoomDetailsEvents() {
  document.querySelectorAll('[data-room-details]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.roomDetails);
      const match = state.matches.find((item) => item.id === id);
      const roomId = window.prompt('Enter room ID', match?.roomId || '');
      if (roomId === null) return;
      const roomPassword = window.prompt('Enter room password', match?.roomPassword || '');
      if (roomPassword === null) return;
      try {
        state.error = null;
        await apiFetch(`/api/admin/matches/${id}/room`, {
          method: 'PATCH',
          body: JSON.stringify({ roomId: roomId.trim(), roomPassword: roomPassword.trim() }),
        });
        await loadMatches();
      } catch (error) {
        state.error = error.message;
        renderPage();
      }
    });
  });
}

async function loadMatchResult(id) {
  const data = await apiFetch(`/api/admin/matches/${id}/result`);
  state.selectedResultMatch = data.match;
  state.selectedResultPlayers = data.players || [];
  state.selectedMatch = null;
  state.editingMatch = null;
  state.error = null;
  state.activeSection = 'match-result';
  renderPage();
}

function bindMatchResultEvents() {
  const form = document.getElementById('match-result-form');
  const updateTotal = (row) => {
    const kills = Number(row.querySelector('.result-kills')?.value || 0);
    const booyah = Number(row.querySelector('.result-booyah')?.value || 0);
    const rate = Number(row.dataset.killRate || 0);
    const total = Math.max(0, kills) * Math.max(0, rate) + Math.max(0, booyah);
    const output = row.querySelector('.result-total');
    if (output) output.textContent = `₹${total.toFixed(2)}`;
  };
  document.querySelectorAll('[data-result-row]').forEach((row) => {
    row.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => updateTotal(row)));
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const players = [...document.querySelectorAll('[data-result-row]')].map((row) => ({
      id: Number(row.dataset.resultRow),
      kills: Number(row.querySelector('.result-kills')?.value || 0),
      position: row.querySelector('[name="position"]')?.value || '',
      booyahPrize: Number(row.querySelector('.result-booyah')?.value || 0),
    }));
    try {
      state.error = null;
      await apiFetch(`/api/admin/matches/${state.selectedResultMatch.id}/result`, { method: 'PUT', body: JSON.stringify({ players }) });
      alert('Match result saved successfully.');
      await loadMatchResult(state.selectedResultMatch.id);
    } catch (error) {
      state.error = error.message;
      renderPage();
    }
  });
}

async function loadUsers() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    state.users = (await apiFetch('/api/users')).users || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadDashboard() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    const [users, matches, deposits, withdrawals] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/admin/matches'),
      apiFetch('/api/wallet/deposit-requests'),
      apiFetch('/api/wallet/withdraw-requests'),
    ]);
    const userRows = users.users || [];
    const matchRows = matches.matches || [];
    const depositRows = deposits.requests || [];
    const withdrawalRows = withdrawals.requests || [];
    state.dashboard = {
      totalUsers: userRows.length,
      blockedUsers: userRows.filter((user) => user.isBlocked).length,
      totalCoins: userRows.reduce((total, user) => total + Number(user.coinBalance || 0), 0),
      totalMatches: matchRows.length,
      activeMatches: matchRows.filter((match) => ['Upcoming', 'Ongoing'].includes(match.status)).length,
      completedMatches: matchRows.filter((match) => match.status === 'Complete').length,
      reviewedPayments: depositRows.filter((request) => request.status !== 'pending').length,
      pendingDeposits: depositRows.filter((request) => request.status === 'pending').length,
      totalWithdrawals: withdrawalRows.length,
      pendingWithdrawals: withdrawalRows.filter((request) => request.status === 'pending').length,
    };
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function updateUserCoins(userId, operation) {
  const input = window.prompt(`${operation === 'add' ? 'Add' : 'Deduct'} how many coins?`, '10');
  if (input === null) return;
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0) { window.alert('Enter a coin amount greater than 0.'); return; }
  try {
    await apiFetch(`/api/users/${userId}/coins`, { method: 'PATCH', body: JSON.stringify({ operation, amount }) });
    await loadUsers();
  } catch (error) {
    state.error = error.message;
    window.alert(error.message);
    renderPage();
  }
}

async function toggleUserBlock(userId, isBlocked) {
  const action = isBlocked ? 'unblock' : 'block';
  if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
  try {
    await apiFetch(`/api/users/${userId}/block`, { method: 'PATCH', body: JSON.stringify({ isBlocked: !isBlocked }) });
    await loadUsers();
  } catch (error) {
    state.error = error.message;
    window.alert(error.message);
    renderPage();
  }
}

appEl.addEventListener('click', (event) => {
  const target = event.target.closest('[data-coin-action], [data-block-user]');
  if (!target) return;
  if (target.dataset.coinAction) {
    void updateUserCoins(Number(target.dataset.userId), target.dataset.coinAction);
    return;
  }
  void toggleUserBlock(Number(target.dataset.blockUser), target.dataset.blocked === 'true');
});

async function loadDepositRequests() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    const [depositResult, zapupiResult] = await Promise.all([
      apiFetch('/api/wallet/deposit-requests'),
      apiFetch('/api/wallet/zapupi-orders'),
    ]);
    state.depositRequests = depositResult.requests || [];
    state.zapupiTransactions = zapupiResult.transactions || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadWithdrawRequests() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    state.withdrawRequests = (await apiFetch('/api/wallet/withdraw-requests')).requests || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function reviewDepositRequest(id, action) {
  const message = action === 'approve' ? 'Approve this payment and credit the user wallet?' : 'Reject this payment request?';
  if (!window.confirm(message)) return;
  try {
    await apiFetch(`/api/wallet/deposit-requests/${id}/${action}`, { method: 'POST' });
    await loadDepositRequests();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function reviewWithdrawRequest(id, action) {
  if (!window.confirm(action === 'approve' ? 'Approve this withdrawal request?' : 'Cancel this withdrawal and refund the user?')) return;
  try {
    await apiFetch(`/api/wallet/withdraw-requests/${id}/${action}`, { method: 'POST' });
    await loadWithdrawRequests();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function loadAnnouncements() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    state.announcements = (await apiFetch('/api/announcements')).announcements || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadNotifications() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    state.notifications = (await apiFetch('/api/notifications/admin')).notifications || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadContacts() {
  state.loading = true; state.error = null; renderPage();
  try { state.contacts = (await apiFetch('/api/settings/contacts')).contacts || []; } catch (error) { state.error = error.message; } finally { state.loading = false; renderPage(); }
}

async function loadBanners() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    state.banners = (await apiFetch('/api/banners')).banners || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadGames() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    state.games = (await apiFetch('/api/games')).games || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadRules() {
  state.loading = true; state.error = null; renderPage();
  try { state.rules = (await apiFetch('/api/rules')).rules || []; } catch (error) { state.error = error.message; } finally { state.loading = false; renderPage(); }
}

async function loadMatchBanners() {
  state.loading = true; state.error = null; renderPage();
  try { state.matchBanners = (await apiFetch('/api/match-banners')).banners || []; } catch (error) { state.error = error.message; } finally { state.loading = false; renderPage(); }
}

async function saveRule(event) {
  event.preventDefault(); const form = new FormData(event.target);
  const payload = { title: form.get('title'), content: form.get('content'), matchSlot: form.get('matchSlot'), displayOrder: Number(form.get('displayOrder') || 0), isActive: form.get('isActive') === 'on' };
  try { await apiFetch(state.editingRule ? `/api/rules/${state.editingRule.id}` : '/api/rules', { method: state.editingRule ? 'PUT' : 'POST', body: JSON.stringify(payload) }); state.editingRule = null; await loadRules(); } catch (error) { state.error = error.message; renderPage(); }
}

async function saveMatchBanner(event) {
  event.preventDefault(); const form = event.target; const payload = new FormData(form); payload.set('isActive', form.isActive.checked ? 'true' : 'false');
  try { await apiFetch('/api/match-banners', { method: 'POST', body: payload }); await loadMatchBanners(); } catch (error) { state.error = error.message; renderPage(); }
}

async function loadMatchCreatePage() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    if (isStaffPanel) {
      const options = await apiFetch('/api/staff/meta');
      state.games = options.games || [];
      state.rules = options.rules || [];
      state.matchBanners = options.banners || [];
    } else {
      const [games, rules, matchBanners] = await Promise.all([apiFetch('/api/games'), apiFetch('/api/rules'), apiFetch('/api/match-banners')]);
      state.games = games.games || [];
      state.rules = rules.rules || [];
      state.matchBanners = matchBanners.banners || [];
    }
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadMatches() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    const data = await apiFetch('/api/admin/matches');
    state.matches = data.matches || [];
    if (isStaffPanel) {
      if (!state.games.length || !state.matchBanners.length || !state.rules.length) {
        const options = await apiFetch('/api/staff/meta');
        state.games = options.games || [];
        state.rules = options.rules || [];
        state.matchBanners = options.banners || [];
      }
    } else {
      if (!state.matchBanners.length) state.matchBanners = (await apiFetch('/api/match-banners')).banners || [];
      if (!state.rules.length) state.rules = (await apiFetch('/api/rules')).rules || [];
    }
    state.selectedMatchIds = new Set([...state.selectedMatchIds].filter((id) => state.matches.some((match) => match.id === id)));
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function loadMatchDetails(id) {
  try {
    const data = await apiFetch(`/api/admin/matches/${id}`);
    state.selectedMatch = data.match;
    state.selectedMatchPlayers = data.participants || [];
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

function loadActiveSection() {
  if (state.activeSection === 'account') return loadAdminAccount();
  if (state.activeSection === 'dashboard') return loadDashboard();
  if (state.activeSection === 'send-notification') { state.loading = false; state.error = null; return renderPage(); }
  if (state.activeSection === 'match-create') return loadMatchCreatePage();
  if (state.activeSection === 'announcements') return loadAnnouncements();
  if (state.activeSection === 'notifications') return loadNotifications();
  if (state.activeSection === 'contacts') return loadContacts();
  if (state.activeSection === 'banners') return loadBanners();
  if (state.activeSection === 'match-banners') return loadMatchBanners();
  if (state.activeSection === 'rules') return loadRules();
  if (state.activeSection === 'games') return loadGames();
  if (state.activeSection === 'matches') return loadMatches();
  if (state.activeSection === 'money') return loadDepositRequests();
  if (state.activeSection === 'withdraw') return loadWithdrawRequests();
  return loadUsers();
}

async function loadAdminAccount() {
  state.loading = true;
  state.error = null;
  renderPage();
  try {
    const [account, staff] = await Promise.all([
      apiFetch('/api/admin/auth/me'),
      apiFetch('/api/admin/staff'),
    ]);
    state.adminAccount = account;
    state.staffAccounts = staff.staff || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderPage();
  }
}

async function initializeAdminPanel() {
  try {
    if (isStaffPanel) {
      if (!state.adminToken) {
        window.location.replace('/stuff-admin-panel/login.html');
        return;
      }
      const accountResponse = await fetch('/api/staff/auth/me', {
        headers: { Authorization: `Bearer ${state.adminToken}` },
      });
      if (!accountResponse.ok) {
        clearAdminSession();
        window.location.replace('/stuff-admin-panel/login.html');
        return;
      }
      state.adminAccount = await accountResponse.json();
      state.activeSection = 'matches';
      await loadActiveSection();
      return;
    }
    const statusResponse = await fetch('/api/admin/auth/status');
    state.adminStatus = await statusResponse.json();
    if (state.adminToken) {
      const accountResponse = await fetch('/api/admin/auth/me', {
        headers: { Authorization: `Bearer ${state.adminToken}` },
      });
      if (accountResponse.ok) {
        state.adminAccount = await accountResponse.json();
        await loadActiveSection();
        return;
      }
      clearAdminSession();
    }
    state.authView = state.adminStatus.configured ? 'login' : 'setup';
    renderAuthPage();
  } catch (error) {
    state.authError = error.message || 'Could not load admin account status.';
    renderAuthPage();
  }
}

async function submitPushNotification(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  let iconUrl = form.get('iconUrl');
  const button = formElement.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Sending...';
  try {
    const iconFile = form.get('iconFile');
    if (iconFile && typeof iconFile === 'object' && 'size' in iconFile && iconFile.size > 0) {
      const uploadForm = new FormData();
      uploadForm.append('icon', iconFile);
      const uploaded = await apiFetch('/api/admin/notifications/upload-icon', { method: 'POST', body: uploadForm });
      iconUrl = uploaded.iconUrl;
    }
    const result = await apiFetch('/api/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify({ title: form.get('title'), message: form.get('message'), link: form.get('link'), iconUrl }),
    });
    formElement.reset();
    window.alert(`Sent to ${result.devices} registered devices: ${result.sent} accepted, ${result.failed} failed. The notification is also available in the app's Notifications screen.`);
  } catch (error) {
    state.error = error.message;
    renderPage();
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = 'Send Notification';
    }
  }
}

async function saveContact(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try { await apiFetch('/api/settings/contacts', { method: 'POST', body: JSON.stringify({ type: form.get('type'), label: form.get('label'), value: form.get('value'), displayOrder: Number(form.get('displayOrder') || 0), isActive: form.get('isActive') === 'on' }) }); await loadContacts(); } catch (error) { state.error = error.message; renderPage(); }
}

async function toggleContact(id) {
  const item = state.contacts.find((contact) => contact.id === id);
  if (!item) return;
  try { await apiFetch(`/api/settings/contacts/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: !item.isActive }) }); await loadContacts(); } catch (error) { state.error = error.message; renderPage(); }
}

async function deleteContact(id) {
  if (!window.confirm('Delete this contact option?')) return;
  try { await apiFetch(`/api/settings/contacts/${id}`, { method: 'DELETE' }); await loadContacts(); } catch (error) { state.error = error.message; renderPage(); }
}

async function saveAnnouncement(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = { title: form.get('title'), message: form.get('message'), isActive: form.get('isActive') === 'on' };
  try {
    await apiFetch(state.editingAnnouncement ? `/api/announcements/${state.editingAnnouncement.id}` : '/api/announcements', { method: state.editingAnnouncement ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    state.editingAnnouncement = null;
    await loadAnnouncements();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function toggleAnnouncement(id) {
  const item = state.announcements.find((announcement) => announcement.id === id);
  if (!item) return;
  try {
    await apiFetch(`/api/announcements/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: !item.isActive }) });
    await loadAnnouncements();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function deleteAnnouncement(id) {
  if (!window.confirm('Delete this announcement?')) return;
  try {
    await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
    await loadAnnouncements();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function saveNotification(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = { title: form.get('title'), message: form.get('message'), isActive: form.get('isActive') === 'on' };
  try {
    await apiFetch(state.editingNotification ? `/api/notifications/${state.editingNotification.id}` : '/api/notifications', { method: state.editingNotification ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    state.editingNotification = null;
    await loadNotifications();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function toggleNotification(id) {
  const item = state.notifications.find((notification) => notification.id === id);
  if (!item) return;
  try {
    await apiFetch(`/api/notifications/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: !item.isActive }) });
    await loadNotifications();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function deleteNotification(id) {
  if (!window.confirm('Delete this notification?')) return;
  try {
    await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
    await loadNotifications();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function saveBanner(event) {
  event.preventDefault();
  const form = event.target;
  const file = form.image.files[0];
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    state.error = 'Choose a JPG, PNG, or WebP image up to 5 MB.';
    renderPage();
    return;
  }
  const payload = new FormData(form);
  try {
    await apiFetch('/api/banners', { method: 'POST', body: payload });
    await loadBanners();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function toggleBanner(id) {
  const banner = state.banners.find((item) => item.id === id);
  if (!banner) return;
  try {
    await apiFetch(`/api/banners/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: !banner.isActive }) });
    await loadBanners();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function updateBanner(id, displayOrder) {
  try {
    await apiFetch(`/api/banners/${id}`, { method: 'PUT', body: JSON.stringify({ displayOrder }) });
    await loadBanners();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function updateBannerLink(id, targetUrl) {
  try {
    await apiFetch(`/api/banners/${id}`, { method: 'PUT', body: JSON.stringify({ targetUrl }) });
    await loadBanners();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function deleteBanner(id) {
  if (!window.confirm('Delete this banner?')) return;
  try {
    await apiFetch(`/api/banners/${id}`, { method: 'DELETE' });
    await loadBanners();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function saveGame(event) {
  event.preventDefault();
  const form = event.target;
  const file = form.image.files[0];
  if (!state.editingGame && !file) {
    state.error = 'Choose a game image.';
    renderPage();
    return;
  }
  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
    state.error = 'Choose a JPG, PNG, or WebP image up to 5 MB.';
    renderPage();
    return;
  }
  const payload = new FormData(form);
  payload.set('isActive', form.isActive.checked ? 'true' : 'false');
  try {
    await apiFetch(state.editingGame ? `/api/games/${state.editingGame.id}` : '/api/games', { method: state.editingGame ? 'PUT' : 'POST', body: payload });
    state.editingGame = null;
    await loadGames();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function toggleGame(id) {
  const game = state.games.find((item) => item.id === id);
  if (!game) return;
  try {
    await apiFetch(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: !game.isActive }) });
    await loadGames();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function deleteGame(id) {
  if (!window.confirm('Delete this game?')) return;
  try {
    await apiFetch(`/api/games/${id}`, { method: 'DELETE' });
    await loadGames();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

async function saveMatch(event) {
  event.preventDefault();
  const form = event.target;
  const valueOf = (name) => {
    const field = form.elements.namedItem(name);
    return field && 'value' in field ? field.value : '';
  };
  const selectedGame = state.games.find((game) => String(game.id) === String(valueOf('gameId')));
  const payload = {
    matchSlot: 'all',
    gameId: valueOf('gameId') || null,
    gameName: selectedGame?.name || '',
    gameVersion: valueOf('gameVersion'),
    eventName: valueOf('eventName'),
    matchUrl: valueOf('matchUrl'),
    matchSchedule: matchDateTimeToUtcSql(valueOf('matchSchedule')),
    prizePool: Number(valueOf('prizePool') || 0),
    perKill: Number(valueOf('perKill') || 0),
    teamType: valueOf('teamType'),
    entryFee: Number(valueOf('entryFee') || 0),
    totalPlayers: Number(valueOf('totalPlayers') || 0),
    map: valueOf('map'),
    matchBannerId: valueOf('matchBannerId') || null,
    ruleId: valueOf('ruleId') || null,
    status: valueOf('status'),
    roomDescription: '',
    prizeDescription: getRichEditorContent('prizeDescription'),
    matchDescription: state.editingMatch?.matchDescription || '',
    privateDescription: '',
    matchType: 'Paid',
  };

  try {
    const isEditing = Boolean(state.editingMatch?.id);
    await apiFetch(isEditing ? `/api/admin/matches/${state.editingMatch.id}` : '/api/admin/matches', {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    state.editingMatch = null;
    state.activeSection = 'matches';
    await loadMatches();
  } catch (error) {
    state.error = error.message;
    renderPage();
  }
}

function render() {
  renderPage();
}

initializeAdminPanel();
