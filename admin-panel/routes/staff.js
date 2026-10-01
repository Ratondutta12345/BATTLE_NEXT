const express = require('express');
const pool = require('../lib/db');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const { issueStaffToken, requireAdminSession, requireStaffSession } = require('../lib/adminAuth');

const staffRouter = express.Router();
const managementRouter = express.Router();
const loginFailures = new Map();

function validUsername(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.-]{3,40}$/.test(value.trim());
}

function validPassword(value) {
  return typeof value === 'string' && value.length >= 10 && value.length <= 200;
}

staffRouter.post('/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const address = req.ip || req.socket.remoteAddress || 'unknown';
  const attempt = loginFailures.get(address);
  if (attempt && attempt.count >= 10 && Date.now() - attempt.firstFailure < 15 * 60_000) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM staff_accounts WHERE username = ? LIMIT 1', [username]);
    const account = rows[0];
    if (!account || !verifyPassword(password, account.password_hash)) {
      const current = loginFailures.get(address);
      if (!current || Date.now() - current.firstFailure >= 15 * 60_000) {
        loginFailures.set(address, { count: 1, firstFailure: Date.now() });
      } else {
        current.count += 1;
      }
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    loginFailures.delete(address);
    return res.json({ token: issueStaffToken(account), username: account.username });
  } catch (error) {
    console.error('Staff login failed:', error);
    return res.status(503).json({ error: 'Staff login is unavailable.' });
  }
});

staffRouter.get('/auth/me', requireStaffSession, (req, res) => {
  res.json({ username: req.staff.username });
});

staffRouter.post('/auth/logout', requireStaffSession, async (req, res) => {
  try {
    await pool.query('UPDATE staff_accounts SET session_version = session_version + 1 WHERE id = ?', [req.staff.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Staff logout failed:', error);
    res.status(500).json({ error: 'Could not end staff session.' });
  }
});

staffRouter.get('/meta', requireStaffSession, async (_req, res) => {
  try {
    const [games, rules, banners] = await Promise.all([
      pool.query('SELECT id, name FROM games WHERE is_active = 1 ORDER BY display_order, name'),
      pool.query('SELECT id, title FROM rules WHERE is_active = 1 ORDER BY display_order, title'),
      pool.query('SELECT id, title FROM match_banners WHERE is_active = 1 ORDER BY display_order, created_at DESC'),
    ]);
    res.json({ games: games[0], rules: rules[0], banners: banners[0] });
  } catch (error) {
    console.error('Staff match options failed:', error);
    res.status(500).json({ error: 'Could not load match options.' });
  }
});

managementRouter.get('/', requireAdminSession, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, created_at FROM staff_accounts ORDER BY username');
    res.json({ staff: rows });
  } catch (error) {
    console.error('GET /api/admin/staff failed:', error);
    res.status(500).json({ error: 'Could not load staff accounts.' });
  }
});

managementRouter.post('/', requireAdminSession, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = req.body.password;
  if (!validUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3 to 40 characters using letters, numbers, dot, underscore, or hyphen.' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'Password must be between 10 and 200 characters.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO staff_accounts (username, password_hash) VALUES (?, ?)',
      [username, hashPassword(password)],
    );
    res.status(201).json({ staff: { id: result.insertId, username } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That staff username is already in use.' });
    console.error('POST /api/admin/staff failed:', error);
    res.status(500).json({ error: 'Could not create staff account.' });
  }
});

managementRouter.delete('/:id', requireAdminSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid staff account id.' });
  try {
    const [result] = await pool.query('DELETE FROM staff_accounts WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Staff account not found.' });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/staff/:id failed:', error);
    res.status(500).json({ error: 'Could not remove staff account.' });
  }
});

module.exports = { staffRouter, managementRouter };
