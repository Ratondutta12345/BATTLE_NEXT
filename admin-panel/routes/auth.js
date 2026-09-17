const crypto = require('crypto');
const express = require('express');
const pool = require('../lib/db');

const router = express.Router();

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === verifyHash;
}

function mapUser(row) {
  return {
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    email: row.email,
    mobileNo: `${row.country_code} ${row.mobile}`,
  };
}

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier?.trim() || !password) {
    return res.status(400).json({ error: 'Email/username/mobile and password are required' });
  }

  const value = identifier.trim();
  const isEmail = value.includes('@');
  const isPhone = /^\d+$/.test(value);

  let query = 'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1';
  let params = [value, value.toLowerCase()];

  if (isEmail) {
    query = 'SELECT * FROM users WHERE email = ? LIMIT 1';
    params = [value.toLowerCase()];
  } else if (isPhone) {
    query = 'SELECT * FROM users WHERE mobile = ? LIMIT 1';
    params = [value];
  }

  try {
    const [rows] = await pool.query(query, params);
    const user = rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.is_blocked) return res.status(403).json({ error: 'This account has been blocked by the administrator.' });

    res.json({ user: mapUser(user) });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
