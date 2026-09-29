const express = require('express');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');
const {
  amountToPaise,
  createOrderId,
  formatAmount,
  isVerifiedCompletedOrder,
  normalizeProviderStatus,
  postForm,
  verifyWebhookSignature,
} = require('../lib/zapupi');

const router = express.Router();
function getZapupiConfig() {
  const userToken = String(process.env.ZAPUPI_USER_TOKEN || '').trim();
  const secretKey = String(process.env.ZAPUPI_SECRET_KEY || '').trim();
  const redirectUrl = String(process.env.ZAPUPI_REDIRECT_URL || '').trim();
  if (!userToken || !secretKey || !redirectUrl) return null;

  try {
    if (new URL(redirectUrl).protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return { userToken, secretKey, redirectUrl };
}

async function findZapupiOrder(orderId) {
  const [rows] = await pool.query(
    'SELECT * FROM zapupi_orders WHERE order_id = ? OR provider_order_id = ? LIMIT 1',
    [orderId, orderId],
  );
  return rows[0] || null;
}

async function confirmZapupiOrder(order, providerPayload) {
  if (!isVerifiedCompletedOrder(order, providerPayload)) return false;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM zapupi_orders WHERE id = ? FOR UPDATE', [order.id]);
    const currentOrder = rows[0];
    if (!currentOrder) {
      await connection.rollback();
      return false;
    }
    if (currentOrder.status === 'COMPLETED') {
      await connection.commit();
      return true;
    }
    if (currentOrder.status !== 'PENDING' || !isVerifiedCompletedOrder(currentOrder, providerPayload)) {
      await connection.rollback();
      return false;
    }

    const amount = formatAmount(Number(currentOrder.amount_paise));
    const [walletResult] = await connection.query(
      `UPDATE wallets
       SET coin_balance = coin_balance + ?, deposit_balance = deposit_balance + ?
       WHERE user_id = ?`,
      [amount, amount, currentOrder.user_id],
    );
    if (!walletResult.affectedRows) throw new Error(`Wallet missing for ZapUPI order ${currentOrder.order_id}`);

    await connection.query(
      `INSERT INTO wallet_transactions (user_id, gateway_order_id, transaction_type, amount, description)
       VALUES (?, ?, 'added', ?, ?)`,
      [currentOrder.user_id, currentOrder.order_id, amount, `ZapUPI wallet deposit (${currentOrder.order_id})`],
    );
    await connection.query(
      `UPDATE zapupi_orders SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [currentOrder.id],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getZapupiOrderStatus(order) {
  const config = getZapupiConfig();
  if (!config) throw new Error('ZapUPI is not configured');

  const payload = await postForm('check-order-status', {
    user_token: config.userToken,
    order_id: order.order_id,
  });
  const status = normalizeProviderStatus(payload);

  if (status === 'COMPLETED') {
    if (!isVerifiedCompletedOrder(order, payload)) {
      throw new Error(`ZapUPI status did not match order ${order.order_id}`);
    }
    await confirmZapupiOrder(order, payload);
    return 'COMPLETED';
  }

  if (status === 'FAILED') {
    await pool.query(
      `UPDATE zapupi_orders SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'`,
      [order.id],
    );
    return 'FAILED';
  }

  return 'PENDING';
}

router.post('/create-zapupi-order', async (req, res) => {
  const userId = Number(req.body?.userId);
  const amountPaise = amountToPaise(req.body?.amount);
  const config = getZapupiConfig();
  let orderId;
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
  if (amountPaise === null) return res.status(400).json({ error: 'Enter a valid amount of at least ₹10 with up to two decimal places.' });
  if (!config) return res.status(503).json({ error: 'ZapUPI payment is not configured on the server.' });

  try {
    const [users] = await pool.query('SELECT mobile FROM users WHERE id = ?', [userId]);
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    const customerMobile = String(users[0].mobile || '').replace(/\D/g, '').slice(-10);
    if (!/^\d{10}$/.test(customerMobile)) {
      return res.status(400).json({ error: 'Add a valid 10-digit mobile number to your account before paying.' });
    }

    orderId = createOrderId();
    const amount = formatAmount(amountPaise);
    await pool.query(
      `INSERT INTO zapupi_orders (order_id, provider_order_id, user_id, amount_paise, payment_url)
       VALUES (?, ?, ?, ?, '')`,
      [orderId, orderId, userId, amountPaise],
    );

    const providerPayload = await postForm('create-order', {
      customer_mobile: customerMobile,
      user_token: config.userToken,
      amount,
      order_id: orderId,
      redirect_url: config.redirectUrl,
      remark1: 'Wallet deposit',
      remark2: `User ${userId}`,
    });
    const paymentUrl = String(providerPayload?.result?.payment_url || '');
    const providerOrderId = String(providerPayload?.result?.orderId || orderId);
    let parsedPaymentUrl;
    try {
      parsedPaymentUrl = new URL(paymentUrl);
    } catch {
      parsedPaymentUrl = null;
    }

    if (providerPayload?.status !== true || !parsedPaymentUrl || parsedPaymentUrl.protocol !== 'https:' || providerOrderId.length > 100) {
      await pool.query(`UPDATE zapupi_orders SET status = 'FAILED' WHERE order_id = ? AND status = 'PENDING'`, [orderId]);
      return res.status(502).json({ error: providerPayload?.message || 'ZapUPI did not return a valid checkout URL.' });
    }

    await pool.query(
      'UPDATE zapupi_orders SET provider_order_id = ?, payment_url = ? WHERE order_id = ?',
      [providerOrderId, paymentUrl, orderId],
    );
    res.status(201).json({ orderId, amount, paymentUrl, qrValue: paymentUrl, status: 'PENDING' });
  } catch (error) {
    if (orderId) {
      await pool.query(`UPDATE zapupi_orders SET status = 'FAILED' WHERE order_id = ? AND status = 'PENDING'`, [orderId]).catch(() => {});
    }
    console.error('POST /api/wallet/create-zapupi-order failed:', error);
    res.status(502).json({ error: 'Could not create a ZapUPI checkout. Please try again.' });
  }
});

router.get('/check-status', async (req, res) => {
  const orderId = String(req.query.orderId || '').trim();
  const userId = Number(req.query.userId);
  if (!orderId || orderId.length > 100 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'A valid order id and user id are required.' });
  }

  try {
    const order = await findZapupiOrder(orderId);
    if (!order || Number(order.user_id) !== userId) return res.status(404).json({ error: 'Payment order not found.' });
    const status = order.status === 'PENDING' ? await getZapupiOrderStatus(order) : order.status;
    res.json({ orderId: order.order_id, status });
  } catch (error) {
    console.error('GET /api/wallet/check-status failed:', error.message);
    res.status(502).json({ error: 'Could not confirm payment status. Please retry shortly.' });
  }
});

router.post('/zapupi-webhook', async (req, res) => {
  const config = getZapupiConfig();
  if (!config) return res.status(503).json({ error: 'ZapUPI webhook is not configured.' });
  const signature = req.get('x-zapupi-signature') || req.get('x-zaprupee-signature');
  if (!verifyWebhookSignature(req.rawBody, signature, config.secretKey)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  const orderId = String(req.body?.order_id || req.body?.orderId || req.body?.result?.orderId || '').trim();
  if (!orderId || orderId.length > 100) return res.status(400).json({ error: 'Webhook order id is required.' });

  try {
    const order = await findZapupiOrder(orderId);
    if (!order) return res.status(404).json({ error: 'Payment order not found.' });
    const status = order.status === 'PENDING' ? await getZapupiOrderStatus(order) : order.status;
    res.json({ received: true, orderId: order.order_id, status });
  } catch (error) {
    console.error('POST /api/wallet/zapupi-webhook failed:', error.message);
    res.status(502).json({ error: 'Could not reconcile the payment notification.' });
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

router.get('/zapupi-orders', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.order_id, o.provider_order_id, o.user_id, o.amount_paise, o.status,
              o.created_at, o.completed_at, u.username, u.first_name, u.last_name,
              u.mobile, u.country_code
       FROM zapupi_orders o
       INNER JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC, o.id DESC`,
    );
    res.json({ transactions: rows.map((row) => ({
      orderId: row.order_id,
      providerOrderId: row.provider_order_id,
      userId: Number(row.user_id),
      username: row.username,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      mobile: `${row.country_code} ${row.mobile}`.trim(),
      amount: Number(row.amount_paise) / 100,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    })) });
  } catch (error) {
    console.error('GET /api/wallet/zapupi-orders failed:', error);
    res.status(500).json({ error: 'Failed to fetch ZapUPI transactions' });
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
