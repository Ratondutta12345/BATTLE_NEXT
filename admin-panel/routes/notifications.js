const express = require('express');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');

const router = express.Router();

function mapNotification(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    isActive: Boolean(row.is_active),
    isRead: row.is_read === undefined ? undefined : Boolean(row.is_read),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'A valid userId is required' });

  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.message, n.is_active, n.created_at, n.updated_at,
              CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END AS is_read
       FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
       WHERE n.is_active = 1
       ORDER BY n.created_at DESC`,
      [userId],
    );
    res.json({ notifications: rows.map(mapNotification), unreadCount: rows.filter((row) => !row.is_read).length });
  } catch (error) {
    console.error('GET /api/notifications failed:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/read-all', async (req, res) => {
  const userId = Number(req.body.userId);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'A valid userId is required' });

  try {
    await pool.query(
      `INSERT IGNORE INTO notification_reads (notification_id, user_id)
       SELECT id, ? FROM notifications WHERE is_active = 1`,
      [userId],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/notifications/read-all failed:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.get('/admin', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, message, is_active, created_at, updated_at
       FROM notifications ORDER BY created_at DESC`,
    );
    res.json({ notifications: rows.map(mapNotification) });
  } catch (error) {
    console.error('GET /api/notifications/admin failed:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/', requireAdminKey, async (req, res) => {
  const { title, message, isActive = true } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Notification message is required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (title, message, is_active) VALUES (?, ?, ?)`,
      [title?.trim() || null, message.trim(), isActive ? 1 : 0],
    );
    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    res.status(201).json({ notification: mapNotification(rows[0]) });
  } catch (error) {
    console.error('POST /api/notifications failed:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

router.put('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  const { title, message, isActive } = req.body;
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid notification id' });
  if (message !== undefined && !String(message).trim()) return res.status(400).json({ error: 'Notification message cannot be empty' });

  try {
    const [existing] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'Notification not found' });
    const current = existing[0];
    await pool.query(
      `UPDATE notifications SET title = ?, message = ?, is_active = ? WHERE id = ?`,
      [title !== undefined ? title?.trim() || null : current.title, message !== undefined ? String(message).trim() : current.message, isActive !== undefined ? (isActive ? 1 : 0) : current.is_active, id],
    );
    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    res.json({ notification: mapNotification(rows[0]) });
  } catch (error) {
    console.error('PUT /api/notifications/:id failed:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.delete('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid notification id' });
  try {
    const [result] = await pool.query('DELETE FROM notifications WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/notifications/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;