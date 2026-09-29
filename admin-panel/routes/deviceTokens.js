const express = require('express');
const pool = require('../lib/db');

const router = express.Router();

router.post('/register-device', async (req, res) => {
  const userId = Number(req.body.userId);
  const token = String(req.body.token || '').trim();
  const platform = String(req.body.platform || '').trim();
  const provider = String(req.body.provider || 'fcm').trim();
  const validToken = provider === 'expo'
    ? /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token)
    : provider === 'fcm' && platform === 'android' && token.length >= 20 && token.length <= 4096 && !/\s/.test(token);
  if (!Number.isInteger(userId) || userId <= 0 || !validToken) {
    return res.status(400).json({ error: 'A valid user ID and push token for the selected provider are required.' });
  }
  try {
    const [users] = await pool.query('SELECT id FROM users WHERE id = ? AND is_blocked = 0', [userId]);
    if (!users[0]) return res.status(404).json({ error: 'User not found or blocked.' });
    await pool.query(
      `INSERT INTO user_push_tokens (user_id, token, platform, provider) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform), provider = VALUES(provider)`,
      [userId, token, ['ios', 'android'].includes(platform) ? platform : 'unknown', provider],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/notifications/register-device failed:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

router.post('/unregister-device', async (req, res) => {
  const userId = Number(req.body.userId);
  const token = String(req.body.token || '').trim();
  if (!Number.isInteger(userId) || userId <= 0 || !token) return res.status(400).json({ error: 'A user ID and push token are required.' });
  try {
    await pool.query('DELETE FROM user_push_tokens WHERE user_id = ? AND token = ?', [userId, token]);
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/notifications/unregister-device failed:', error);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

module.exports = router;
