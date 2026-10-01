const crypto = require('crypto');
const pool = require('./db');

const OWNER_EMAIL = 'ratondutta444@gmail.com';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || '';
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function issueSessionToken(account, type) {
  if (sessionSecret().length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters');
  }
  const payload = Buffer.from(JSON.stringify({
    id: account.id,
    version: account.session_version,
    type,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function issueAdminToken(account) {
  return issueSessionToken(account, 'admin');
}

function issueStaffToken(account) {
  return issueSessionToken(account, 'staff');
}

function verifyAdminToken(token) {
  if (sessionSecret().length < 32 || typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(decoded.id) || !Number.isInteger(decoded.version) || decoded.exp <= Date.now() / 1000) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isLocalSetupRequest(req) {
  const remoteAddress = String(req.socket?.remoteAddress || '').replace(/^::ffff:/i, '').toLowerCase();
  let hostname = '';
  try {
    hostname = new URL(`http://${req.get('host') || ''}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ['127.0.0.1', '::1'].includes(remoteAddress)
    && ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

async function requireAdminSession(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const claims = verifyAdminToken(token);
  if (!claims || (claims.type && claims.type !== 'admin')) return res.status(401).json({ error: 'Admin login required' });

  try {
    const [rows] = await pool.query('SELECT id, username, session_version FROM admin_accounts WHERE id = ?', [claims.id]);
    const account = rows[0];
    if (!account || account.session_version !== claims.version) {
      return res.status(401).json({ error: 'Admin login required' });
    }
    req.admin = { id: account.id, username: account.username };
    return next();
  } catch (error) {
    console.error('Admin session validation failed:', error);
    return res.status(503).json({ error: 'Admin authorization is temporarily unavailable' });
  }
}

async function requireStaffSession(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const claims = verifyAdminToken(token);
  if (!claims || claims.type !== 'staff') return res.status(401).json({ error: 'Staff login required' });
  try {
    const [rows] = await pool.query('SELECT id, username, session_version FROM staff_accounts WHERE id = ?', [claims.id]);
    const account = rows[0];
    if (!account || account.session_version !== claims.version) {
      return res.status(401).json({ error: 'Staff login required' });
    }
    req.staff = { id: account.id, username: account.username };
    return next();
  } catch (error) {
    console.error('Staff session validation failed:', error);
    return res.status(503).json({ error: 'Staff authorization is temporarily unavailable' });
  }
}

async function requireMatchAccess(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const claims = verifyAdminToken(token);
  if (!claims) return res.status(401).json({ error: 'Login required' });
  if (!claims.type || claims.type === 'admin') return requireAdminSession(req, res, next);
  if (claims.type !== 'staff') return res.status(401).json({ error: 'Login required' });
  return requireStaffSession(req, res, next);
}

module.exports = {
  OWNER_EMAIL,
  issueAdminToken,
  issueStaffToken,
  verifyAdminToken,
  isLocalSetupRequest,
  requireAdminSession,
  requireStaffSession,
  requireMatchAccess,
  requireAdminKey: requireAdminSession,
};
