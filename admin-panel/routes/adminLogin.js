const crypto = require('crypto');
const express = require('express');
const nodemailer = require('nodemailer');
const pool = require('../lib/db');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const { OWNER_EMAIL, issueAdminToken, isLocalSetupRequest, requireAdminSession } = require('../lib/adminAuth');

const router = express.Router();
const loginFailures = new Map();

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hashCode(code) {
  return crypto.createHash('sha256').update(`${process.env.ADMIN_SESSION_SECRET}:${code}`).digest('hex');
}

function validateUsername(username) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,40}$/.test(username.trim())) {
    throw new RequestError(400, 'Username must be 3 to 40 characters using letters, numbers, dot, underscore, or hyphen.');
  }
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) {
    throw new RequestError(400, 'Password must be between 10 and 200 characters.');
  }
}

async function sendVerificationCode(code, purpose) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new RequestError(503, 'Email delivery is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASSWORD to the backend environment.');
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  const action = purpose === 'delete' ? 'remove' : 'reset';
  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: OWNER_EMAIL,
    subject: 'Admin panel verification code',
    text: `Your code to ${action} the admin panel credentials is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
  });
}

async function consumeCode(connection, purpose, code) {
  const [rows] = await connection.query('SELECT * FROM admin_verification_codes WHERE id = 1 FOR UPDATE');
  const record = rows[0];
  if (!record || record.purpose !== purpose || record.attempts >= 5 || new Date(record.expires_at).getTime() <= Date.now()) {
    throw new RequestError(400, 'Verification code is invalid or expired.');
  }
  const expected = Buffer.from(record.code_hash, 'hex');
  const supplied = Buffer.from(hashCode(String(code || '')), 'hex');
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    await connection.query('UPDATE admin_verification_codes SET attempts = attempts + 1 WHERE id = 1');
    throw new RequestError(400, 'Verification code is invalid or expired.');
  }
  await connection.query('DELETE FROM admin_verification_codes WHERE id = 1');
}

async function withVerification(req, res, purpose, callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await consumeCode(connection, purpose, req.body.code);
    const result = await callback(connection);
    await connection.commit();
    return res.json(result || { ok: true });
  } catch (error) {
    if (error instanceof RequestError) {
      await connection.commit();
      return res.status(error.status).json({ error: error.message });
    }
    await connection.rollback();
    console.error('Admin credential operation failed:', error);
    return res.status(500).json({ error: 'Could not update admin credentials.' });
  } finally {
    connection.release();
  }
}

router.get('/status', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT username FROM admin_accounts WHERE id = 1');
    res.json({ configured: Boolean(rows[0]), ownerEmail: OWNER_EMAIL });
  } catch (error) {
    console.error('Admin account status failed:', error);
    res.status(503).json({ error: 'Admin account status is unavailable.' });
  }
});

router.post('/request-code', async (req, res) => {
  const purpose = String(req.body.purpose || '');
  if (!['reset', 'delete'].includes(purpose)) {
    return res.status(400).json({ error: 'Invalid verification purpose.' });
  }
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
    return res.status(503).json({ error: 'Set ADMIN_SESSION_SECRET to at least 32 characters before using admin credentials.' });
  }
  try {
    const [accounts] = await pool.query('SELECT id FROM admin_accounts WHERE id = 1');
    const configured = Boolean(accounts[0]);
    if (!configured) {
      return res.status(409).json({ error: 'This credential action is not available.' });
    }
    const [pending] = await pool.query('SELECT requested_at FROM admin_verification_codes WHERE id = 1');
    if (pending[0] && Date.now() - new Date(pending[0].requested_at).getTime() < 60_000) {
      return res.status(429).json({ error: 'Please wait one minute before requesting another code.' });
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await pool.query(
      `INSERT INTO admin_verification_codes (id, purpose, code_hash, expires_at, attempts, requested_at)
       VALUES (1, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, NOW())
       ON DUPLICATE KEY UPDATE purpose = VALUES(purpose), code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), attempts = 0, requested_at = NOW()`,
      [purpose, hashCode(code)],
    );
    try {
      await sendVerificationCode(code, purpose);
    } catch (error) {
      await pool.query('DELETE FROM admin_verification_codes WHERE id = 1');
      throw error;
    }
    res.json({ ok: true, message: `Verification code sent to ${OWNER_EMAIL}.` });
  } catch (error) {
    if (error instanceof RequestError) return res.status(error.status).json({ error: error.message });
    console.error('Admin verification email failed:', error);
    res.status(503).json({ error: 'Could not send a verification email.' });
  }
});

router.post('/setup', async (req, res) => {
  if (!isLocalSetupRequest(req)) {
    return res.status(403).json({ error: 'Open the admin panel on localhost on the server computer to create its first login.' });
  }
  if (String(req.body.email || '').trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    return res.status(400).json({ error: 'Use the default admin email shown on this page.' });
  }
  try {
    validateUsername(req.body.username);
    validatePassword(req.body.password);
  } catch (error) {
    return res.status(error.status).json({ error: error.message });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT id FROM admin_accounts WHERE id = 1 FOR UPDATE');
    if (existing[0]) {
      await connection.rollback();
      return res.status(409).json({ error: 'Admin credentials have already been created.' });
    }
    await connection.query(
      'INSERT INTO admin_accounts (id, username, password_hash) VALUES (1, ?, ?)',
      [req.body.username.trim(), hashPassword(req.body.password)],
    );
    await connection.commit();
    return res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Admin credentials have already been created.' });
    console.error('Admin setup failed:', error);
    return res.status(500).json({ error: 'Could not create admin credentials.' });
  } finally {
    connection.release();
  }
});

router.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const address = req.ip || req.socket.remoteAddress || 'unknown';
  const attempt = loginFailures.get(address);
  if (attempt && attempt.count >= 10 && Date.now() - attempt.firstFailure < 15 * 60_000) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM admin_accounts WHERE id = 1');
    const account = rows[0];
    if (!account || account.username !== username || !verifyPassword(password, account.password_hash)) {
      const current = loginFailures.get(address);
      if (!current || Date.now() - current.firstFailure >= 15 * 60_000) {
        loginFailures.set(address, { count: 1, firstFailure: Date.now() });
      } else {
        current.count += 1;
      }
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    loginFailures.delete(address);
    const token = issueAdminToken(account);
    res.json({ token, username: account.username });
  } catch (error) {
    console.error('Admin login failed:', error);
    res.status(503).json({ error: 'Admin login is unavailable.' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    validatePassword(req.body.password);
  } catch (error) {
    return res.status(error.status).json({ error: error.message });
  }
  return withVerification(req, res, 'reset', async (connection) => {
    await connection.query('UPDATE admin_accounts SET password_hash = ?, session_version = session_version + 1 WHERE id = 1', [hashPassword(req.body.password)]);
    return { ok: true };
  });
});

router.post('/change', requireAdminSession, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const currentPassword = req.body.currentPassword;
  const password = req.body.password;
  try {
    if (username) validateUsername(username);
    if (!username && !password) throw new RequestError(400, 'Enter a new username or password.');
    validatePassword(currentPassword);
    if (password) validatePassword(password);
  } catch (error) {
    return res.status(error.status).json({ error: error.message });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id, password_hash FROM admin_accounts WHERE id = ? FOR UPDATE', [req.admin.id]);
    const account = rows[0];
    if (!account || !verifyPassword(currentPassword, account.password_hash)) {
      await connection.rollback();
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    await connection.query(
      `UPDATE admin_accounts SET username = COALESCE(NULLIF(?, ''), username),
       password_hash = COALESCE(?, password_hash), session_version = session_version + 1 WHERE id = ?`,
      [username, password ? hashPassword(password) : null, req.admin.id],
    );
    await connection.commit();
    return res.json({ ok: true, username: username || req.admin.username });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That username is already in use.' });
    console.error('Admin credential update failed:', error);
    return res.status(500).json({ error: 'Could not update admin credentials.' });
  } finally {
    connection.release();
  }
});

router.post('/delete', async (req, res) => withVerification(req, res, 'delete', async (connection) => {
  await connection.query('DELETE FROM admin_accounts WHERE id = 1');
  return { ok: true };
}));

router.get('/me', requireAdminSession, async (req, res) => {
  res.json({ username: req.admin.username, ownerEmail: OWNER_EMAIL });
});

router.post('/logout', requireAdminSession, async (req, res) => {
  try {
    await pool.query('UPDATE admin_accounts SET session_version = session_version + 1 WHERE id = ?', [req.admin.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin logout failed:', error);
    res.status(500).json({ error: 'Could not end admin session.' });
  }
});

module.exports = router;