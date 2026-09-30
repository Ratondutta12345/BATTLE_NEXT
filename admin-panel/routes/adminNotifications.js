const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');
const { sendPushNotification } = require('../lib/firebasePush');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads', 'notifications');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

function optionalUrl(value, { allowAppScheme = false } = {}) {
  const url = String(value || '').trim();
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url.slice(0, 1000);
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || (allowAppScheme && parsed.protocol === 'myapp:')) {
      return url.slice(0, 1000);
    }
  } catch {}
  return undefined;
}

router.post('/upload-icon', requireAdminKey, (req, res) => {
  upload.single('icon')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Notification image must be 5 MB or smaller.'
        : 'Choose one JPG, PNG, or WebP image.';
      return res.status(status).json({ error: message });
    }
    if (error) {
      console.error('POST /api/admin/notifications/upload-icon failed:', error);
      return res.status(500).json({ error: 'Could not store the notification image.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG, or WebP image up to 5 MB.' });
    return res.status(201).json({ iconUrl: `/uploads/notifications/${req.file.filename}` });
  });
});

router.post('/send', requireAdminKey, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  const link = optionalUrl(req.body.link, { allowAppScheme: true });
  let iconUrl = optionalUrl(req.body.icon ?? req.body.iconUrl);
  if (typeof iconUrl === 'string' && iconUrl.startsWith('/uploads/notifications/')) {
    const baseUrl = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    iconUrl = `${baseUrl}${iconUrl}`;
  }

  if (!title || title.length > 255) return res.status(400).json({ error: 'A title of 1 to 255 characters is required.' });
  if (!message || message.length > 2000) return res.status(400).json({ error: 'Message is required and must be at most 2000 characters.' });
  if (link === undefined) return res.status(400).json({ error: 'Link must be an http(s) URL, app deep link, or in-app path.' });
  if (iconUrl === undefined) return res.status(400).json({ error: 'Icon image must be an http(s) URL.' });

  let notificationSaved = false;
  try {
    const [tokenRows] = await pool.query(
      `SELECT upt.token FROM user_push_tokens upt
       INNER JOIN users u ON u.id = upt.user_id
       WHERE u.is_blocked = 0`,
    );
    if (!tokenRows.length) {
      return res.status(409).json({
        error: 'No registered devices. Install the built app, allow notifications, and sign in on at least one device before sending.',
      });
    }
    const [notificationResult] = await pool.query(
      `INSERT INTO notifications (title, message, link, icon_url, is_active) VALUES (?, ?, ?, ?, 1)`,
      [title, message, link, iconUrl],
    );
    notificationSaved = true;
    const delivery = await sendPushNotification({
      title,
      message,
      link,
      icon: iconUrl,
      targetTokens: tokenRows.map((row) => row.token),
    });
    if (delivery.invalidTokens.length) {
      await pool.query('DELETE FROM user_push_tokens WHERE token IN (?)', [delivery.invalidTokens]);
    }
    res.json({ ok: true, notificationId: notificationResult.insertId, devices: tokenRows.length, ...delivery });
  } catch (error) {
    console.error('POST /api/admin/notifications/send failed:', error);
    const message = notificationSaved
      ? 'The notification was saved in the app, but push delivery failed. Check Firebase/Expo credentials.'
      : 'Push delivery failed. Check Firebase/Expo credentials and try again.';
    res.status(502).json({ error: message });
  }
});

module.exports = router;