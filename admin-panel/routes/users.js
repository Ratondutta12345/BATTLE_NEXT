const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');

const router = express.Router();
const avatarDirectory = path.join(__dirname, '..', 'public', 'uploads', 'users');
fs.mkdirSync(avatarDirectory, { recursive: true });
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarDirectory,
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)),
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.country_code, u.mobile, u.email, u.referral_code, u.is_blocked, u.created_at,
          COALESCE(w.coin_balance, 0) AS wallet_balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       ORDER BY u.created_at DESC`,
    );

    const users = rows.map((row) => ({
      id: row.id,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      mobileNo: `${row.country_code} ${row.mobile}`,
      countryCode: row.country_code,
      mobile: row.mobile,
      email: row.email,
      referralCode: row.referral_code,
      coinBalance: Number(row.wallet_balance ?? 0),
      isBlocked: Boolean(row.is_blocked),
      createdAt: row.created_at,
    }));

    res.json({ users });
  } catch (error) {
    console.error('GET /api/users failed:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/:id/coins', requireAdminKey, async (req, res) => {
  const userId = Number(req.params.id);
  const amount = Number(req.body.amount);
  const operation = req.body.operation;
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Coin amount must be greater than 0' });
  if (!['add', 'deduct'].includes(operation)) return res.status(400).json({ error: 'Invalid coin operation' });
  const roundedAmount = Number(amount.toFixed(2));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!users[0]) { await connection.rollback(); return res.status(404).json({ error: 'User not found' }); }
    await connection.query('INSERT INTO wallets (user_id, coin_balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id', [userId]);
    const [result] = await connection.query(
      operation === 'add'
        ? 'UPDATE wallets SET coin_balance = coin_balance + ? WHERE user_id = ?'
        : 'UPDATE wallets SET coin_balance = coin_balance - ? WHERE user_id = ? AND coin_balance >= ?',
      operation === 'add' ? [roundedAmount, userId] : [roundedAmount, userId, roundedAmount],
    );
    if (!result.affectedRows) { await connection.rollback(); return res.status(400).json({ error: 'Insufficient coins to deduct' }); }
    await connection.query(`INSERT INTO wallet_transactions (user_id, transaction_type, amount, description) VALUES (?, ?, ?, ?)`, [userId, operation === 'add' ? 'added' : 'withdraw', roundedAmount, `Admin ${operation}ed coins`]);
    const [wallets] = await connection.query('SELECT coin_balance FROM wallets WHERE user_id = ?', [userId]);
    await connection.commit();
    res.json({ coinBalance: Number(wallets[0].coin_balance) });
  } catch (error) {
    await connection.rollback();
    console.error('PATCH /api/users/:id/coins failed:', error);
    res.status(500).json({ error: 'Failed to update user coins' });
  } finally {
    connection.release();
  }
});

router.patch('/:id/block', requireAdminKey, async (req, res) => {
  const userId = Number(req.params.id);
  const isBlocked = req.body.isBlocked === true;
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const [result] = await pool.query('UPDATE users SET is_blocked = ? WHERE id = ?', [isBlocked ? 1 : 0, userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ isBlocked });
  } catch (error) {
    console.error('PATCH /api/users/:id/block failed:', error);
    res.status(500).json({ error: 'Failed to update user block status' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const [rows] = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.username, u.country_code, u.mobile, u.email, u.referral_code, u.avatar_url, u.points, u.wins, u.matches, u.is_blocked, u.created_at,
          COALESCE(w.coin_balance, 0) AS wallet_balance
         FROM users u
         LEFT JOIN wallets w ON w.user_id = u.id
         WHERE u.id = ?`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const row = rows[0];
    const [statsRows] = await pool.query(
      `SELECT COUNT(*) AS matches_played,
          COALESCE(SUM(mp.kill_count), 0) AS total_kills,
          COALESCE(SUM(CASE WHEN m.status = 'Complete' THEN mp.total_prize ELSE 0 END), 0) AS coins_won
       FROM match_participants mp
       INNER JOIN matches m ON m.id = mp.match_id
       WHERE mp.user_id = ?`,
      [id],
    );
    const stats = statsRows[0];
    res.json({
      user: {
        id: row.id,
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        firstName: row.first_name,
        lastName: row.last_name,
        username: row.username,
        email: row.email,
        mobileNo: `${row.country_code} ${row.mobile}`,
        referralCode: row.referral_code,
        avatarUrl: row.avatar_url,
        points: row.points,
        wins: row.wins,
        matches: Number(stats.matches_played ?? row.matches ?? 0),
        totalKills: Number(stats.total_kills ?? 0),
        coinsWon: Number(row.wallet_balance ?? 0),
        isBlocked: Boolean(row.is_blocked),
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error('GET /api/users/:id failed:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.patch('/:id/avatar', avatarUpload.single('avatar'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid user id' });
  if (!req.file) return res.status(400).json({ error: 'A valid image is required' });

  try {
    const avatarUrl = `/uploads/users/${req.file.filename}`;
    const [result] = await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ avatarUrl });
  } catch (error) {
    console.error('PATCH /api/users/:id/avatar failed:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

router.post('/', async (req, res) => {
  const {
    firstName,
    lastName,
    username,
    countryCode = '+91',
    phone,
    mobile,
    email,
    password,
    promoCode,
    referralCode,
  } = req.body;

  const mobileNumber = (mobile || phone || '').trim();

  if (!firstName?.trim() || !lastName?.trim() || !username?.trim() || !mobileNumber || !email?.trim() || !password) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  try {
    const passwordHash = hashPassword(password);
    const code = (referralCode || promoCode || '').trim() || null;

    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, username, country_code, mobile, email, password_hash, referral_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName.trim(),
        lastName.trim(),
        username.trim(),
        countryCode.trim(),
        mobileNumber,
        email.trim().toLowerCase(),
        passwordHash,
        code,
      ],
    );

    res.status(201).json({
      user: {
        id: result.insertId,
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        mobileNo: `${countryCode.trim()} ${mobileNumber}`,
        email: email.trim().toLowerCase(),
      },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const message = error.message.includes('username')
        ? 'Username is already taken'
        : error.message.includes('email')
          ? 'Email is already registered'
          : 'User already exists';
      return res.status(409).json({ error: message });
    }

    console.error('POST /api/users failed:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

module.exports = router;
