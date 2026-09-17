const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');

const router = express.Router();
const paymentDirectory = path.join(__dirname, '..', 'public', 'uploads', 'payment');
fs.mkdirSync(paymentDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: paymentDirectory,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

async function getPaymentConfig() {
  const upiId = String(process.env.PAYMENT_UPI_ID || '').trim();
  const [rows] = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'wallet_qr_url'`);
  const qrImageUrl = rows[0]?.setting_value || null;
  return { upiId, payeeName: String(process.env.PAYMENT_PAYEE_NAME || 'BATTLE-NEXT').trim(), qrImageUrl, configured: Boolean(qrImageUrl || upiId) };
}

router.get('/payment-config', async (_req, res) => {
  try {
    res.json({ payment: await getPaymentConfig() });
  } catch (error) {
    console.error('GET /api/wallet/payment-config failed:', error);
    res.status(500).json({ error: 'Failed to fetch payment configuration' });
  }
});

router.get('/payment-config/admin', requireAdminKey, async (_req, res) => {
  try {
    res.json({ payment: await getPaymentConfig() });
  } catch (error) {
    console.error('GET /api/wallet/payment-config/admin failed:', error);
    res.status(500).json({ error: 'Failed to fetch payment configuration' });
  }
});

router.post('/payment-config/qr', requireAdminKey, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A JPG, PNG, or WebP QR image is required' });
  const imageUrl = `/uploads/payment/${req.file.filename}`;
  try {
    const [rows] = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'wallet_qr_url'`);
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('wallet_qr_url', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [imageUrl],
    );
    const previousUrl = rows[0]?.setting_value;
    if (previousUrl?.startsWith('/uploads/')) fs.rmSync(path.join(__dirname, '..', 'public', previousUrl), { force: true });
    res.status(201).json({ payment: await getPaymentConfig() });
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    console.error('POST /api/wallet/payment-config/qr failed:', error);
    res.status(500).json({ error: 'Failed to save payment QR image' });
  }
});

router.post('/:userId/deposit-requests', async (req, res) => {
  const userId = Number(req.params.userId);
  const amount = Number(req.body.amount);
  const transactionId = String(req.body.transactionId || '').trim();

  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
  if (!Number.isFinite(amount) || amount < 10) return res.status(400).json({ error: 'Minimum deposit amount is ₹10.' });
  if (!transactionId || transactionId.length > 150) return res.status(400).json({ error: 'A valid transaction ID is required.' });

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    const roundedAmount = Number(amount.toFixed(2));
    const [result] = await pool.query(
      `INSERT INTO wallet_deposit_requests (user_id, amount, transaction_id)
       VALUES (?, ?, ?)`,
      [userId, roundedAmount, transactionId],
    );
    res.status(201).json({ message: 'Payment request sent for approval.', requestId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This transaction ID has already been submitted.' });
    console.error('POST /api/wallet/:userId/deposit-requests failed:', error);
    res.status(500).json({ error: 'Failed to submit payment request' });
  }
});

router.get('/:userId/withdraw-status', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const [walletRows] = await pool.query('SELECT coin_balance FROM wallets WHERE user_id = ?', [userId]);
    if (!walletRows[0]) return res.status(404).json({ error: 'Wallet not found' });
    const [recentRows] = await pool.query(
      `SELECT created_at FROM wallet_withdraw_requests
       WHERE user_id = ? AND status <> 'cancelled' AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 12 HOUR)
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const availableAt = recentRows[0] ? new Date(new Date(recentRows[0].created_at).getTime() + 12 * 60 * 60 * 1000) : null;
    res.json({ eligible: !availableAt || availableAt <= new Date(), availableAt, balance: Number(walletRows[0].coin_balance) });
  } catch (error) {
    console.error('GET /api/wallet/:userId/withdraw-status failed:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawal status' });
  }
});

router.post('/:userId/withdraw-requests', async (req, res) => {
  const userId = Number(req.params.userId);
  const amount = Number(req.body.amount);
  const upiId = String(req.body.upiId || '').trim();
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
  if (!Number.isFinite(amount) || amount < 50) return res.status(400).json({ error: 'Minimum withdrawal amount is ₹50.' });
  if (!upiId || upiId.length > 255) return res.status(400).json({ error: 'A valid UPI ID is required.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [walletRows] = await connection.query('SELECT coin_balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]);
    if (!walletRows[0]) { await connection.rollback(); return res.status(404).json({ error: 'Wallet not found' }); }
    const [recentRows] = await connection.query(
      `SELECT id FROM wallet_withdraw_requests
       WHERE user_id = ? AND status <> 'cancelled' AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 12 HOUR)
       LIMIT 1`,
      [userId],
    );
    if (recentRows[0]) { await connection.rollback(); return res.status(409).json({ error: 'You can withdraw again after 12 hours, unless the admin cancels this request.' }); }
    const roundedAmount = Number(amount.toFixed(2));
    if (Number(walletRows[0].coin_balance) < roundedAmount) { await connection.rollback(); return res.status(400).json({ error: 'Insufficient wallet balance.' }); }
    await connection.query('UPDATE wallets SET coin_balance = coin_balance - ? WHERE user_id = ?', [roundedAmount, userId]);
    const [result] = await connection.query('INSERT INTO wallet_withdraw_requests (user_id, amount, upi_id) VALUES (?, ?, ?)', [userId, roundedAmount, upiId]);
    await connection.query(`INSERT INTO wallet_transactions (user_id, transaction_type, amount, description) VALUES (?, 'withdraw', ?, ?)`, [userId, roundedAmount, `Withdrawal request #${result.insertId}`]);
    await connection.commit();
    res.status(201).json({ message: 'Withdrawal request submitted for admin review.', requestId: result.insertId });
  } catch (error) {
    await connection.rollback();
    console.error('POST /api/wallet/:userId/withdraw-requests failed:', error);
    res.status(500).json({ error: 'Failed to submit withdrawal request' });
  } finally {
    connection.release();
  }
});

router.get('/withdraw-requests', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.user_id, r.amount, r.upi_id, r.status, r.created_at, r.reviewed_at,
              u.username, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.mobile
       FROM wallet_withdraw_requests r INNER JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC, r.id DESC`,
    );
    res.json({ requests: rows.map((row) => ({ id: row.id, userId: row.user_id, amount: Number(row.amount), upiId: row.upi_id, status: row.status, username: row.username, fullName: row.full_name, mobile: row.mobile, createdAt: row.created_at, reviewedAt: row.reviewed_at })) });
  } catch (error) {
    console.error('GET /api/wallet/withdraw-requests failed:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawal requests' });
  }
});

router.post('/withdraw-requests/:id/:action', requireAdminKey, async (req, res) => {
  const requestId = Number(req.params.id);
  const action = req.params.action;
  if (!Number.isInteger(requestId) || requestId <= 0 || !['approve', 'cancel'].includes(action)) return res.status(400).json({ error: 'Invalid withdrawal action' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM wallet_withdraw_requests WHERE id = ? FOR UPDATE', [requestId]);
    const request = rows[0];
    if (!request) { await connection.rollback(); return res.status(404).json({ error: 'Withdrawal request not found' }); }
    if (request.status !== 'pending') { await connection.rollback(); return res.status(409).json({ error: `Request is already ${request.status}.` }); }
    if (action === 'cancel') {
      await connection.query('UPDATE wallets SET coin_balance = coin_balance + ? WHERE user_id = ?', [request.amount, request.user_id]);
      await connection.query(`INSERT INTO wallet_transactions (user_id, transaction_type, amount, description) VALUES (?, 'received', ?, ?)`, [request.user_id, request.amount, `Withdrawal request #${requestId} cancelled and refunded`]);
    }
    await connection.query('UPDATE wallet_withdraw_requests SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?', [action === 'approve' ? 'approved' : 'cancelled', requestId]);
    await connection.commit();
    res.json({ message: action === 'approve' ? 'Withdrawal approved.' : 'Withdrawal cancelled and refunded.' });
  } catch (error) {
    await connection.rollback();
    console.error(`POST /api/wallet/withdraw-requests/:id/${action} failed:`, error);
    res.status(500).json({ error: 'Failed to review withdrawal request' });
  } finally {
    connection.release();
  }
});

router.get('/deposit-requests', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.user_id, r.amount, r.transaction_id, r.status, r.created_at, r.reviewed_at,
              u.username, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.mobile
       FROM wallet_deposit_requests r
       INNER JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC, r.id DESC`,
    );
    res.json({ requests: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      amount: Number(row.amount),
      transactionId: row.transaction_id,
      status: row.status,
      username: row.username,
      fullName: row.full_name,
      mobile: row.mobile,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
    })) });
  } catch (error) {
    console.error('GET /api/wallet/deposit-requests failed:', error);
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

router.post('/deposit-requests/:id/approve', requireAdminKey, async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ error: 'Invalid request id' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM wallet_deposit_requests WHERE id = ? FOR UPDATE', [requestId]);
    const request = rows[0];
    if (!request) { await connection.rollback(); return res.status(404).json({ error: 'Payment request not found' }); }
    if (request.status !== 'pending') { await connection.rollback(); return res.status(409).json({ error: `Request is already ${request.status}.` }); }

    await connection.query(
      `INSERT INTO wallets (user_id, coin_balance, deposit_balance)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         coin_balance = coin_balance + VALUES(coin_balance),
         deposit_balance = deposit_balance + VALUES(deposit_balance)`,
      [request.user_id, request.amount, request.amount],
    );
    await connection.query(
      `INSERT INTO wallet_transactions (user_id, transaction_type, amount, description)
       VALUES (?, 'added', ?, ?)`,
      [request.user_id, request.amount, `Deposit approved (Txn: ${request.transaction_id})`],
    );
    await connection.query(`UPDATE wallet_deposit_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`, [requestId]);
    await connection.commit();
    res.json({ message: 'Payment approved and wallet credited.' });
  } catch (error) {
    await connection.rollback();
    console.error('POST /api/wallet/deposit-requests/:id/approve failed:', error);
    res.status(500).json({ error: 'Failed to approve payment request' });
  } finally {
    connection.release();
  }
});

router.post('/deposit-requests/:id/reject', requireAdminKey, async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ error: 'Invalid request id' });
  try {
    const [result] = await pool.query(
      `UPDATE wallet_deposit_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`,
      [requestId],
    );
    if (!result.affectedRows) return res.status(409).json({ error: 'Request not found or already reviewed.' });
    res.json({ message: 'Payment request rejected.' });
  } catch (error) {
    console.error('POST /api/wallet/deposit-requests/:id/reject failed:', error);
    res.status(500).json({ error: 'Failed to reject payment request' });
  }
});

router.get('/:userId', async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT w.coin_balance, w.updated_at, u.username
              , w.deposit_balance, w.winning_balance, w.bonus_balance
       FROM wallets w
       INNER JOIN users u ON u.id = w.user_id
       WHERE w.user_id = ?`,
      [userId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json({
      wallet: {
        userId,
        username: rows[0].username,
        coinBalance: Number(rows[0].coin_balance),
        deposit: Number(rows[0].deposit_balance),
        winning: Number(rows[0].winning_balance),
        bonus: Number(rows[0].bonus_balance),
        updatedAt: rows[0].updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/wallet/:userId failed:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

router.get('/:userId/transactions', async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, transaction_type, amount, description, created_at
       FROM wallet_transactions
       WHERE user_id = ? AND transaction_type IN ('added', 'received', 'withdraw')
       ORDER BY created_at DESC, id DESC`,
      [userId],
    );

    res.json({
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.transaction_type,
        amount: Number(row.amount),
        description: row.description,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('GET /api/wallet/:userId/transactions failed:', error);
    res.status(500).json({ error: 'Failed to fetch wallet transactions' });
  }
});

module.exports = router;
