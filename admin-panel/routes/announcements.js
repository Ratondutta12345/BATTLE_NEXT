const express = require('express');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');

const router = express.Router();

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/active', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, message, is_active, created_at, updated_at
       FROM announcements
       WHERE is_active = 1
       ORDER BY created_at DESC`,
    );
    res.json({ announcements: rows.map(mapAnnouncement) });
  } catch (error) {
    console.error('GET /api/announcements/active failed:', error);
    res.status(500).json({ error: 'Failed to fetch active announcements' });
  }
});

router.get('/', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, message, is_active, created_at, updated_at
       FROM announcements
       ORDER BY created_at DESC`,
    );
    res.json({ announcements: rows.map(mapAnnouncement) });
  } catch (error) {
    console.error('GET /api/announcements failed:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/', requireAdminKey, async (req, res) => {
  const { title, message, isActive = true } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Announcement message is required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO announcements (title, message, is_active)
       VALUES (?, ?, ?)`,
      [title?.trim() || null, message.trim(), isActive ? 1 : 0],
    );

    const [rows] = await pool.query('SELECT * FROM announcements WHERE id = ?', [result.insertId]);
    res.status(201).json({ announcement: mapAnnouncement(rows[0]) });
  } catch (error) {
    console.error('POST /api/announcements failed:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.put('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  const { title, message, isActive } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }

  if (message !== undefined && !String(message).trim()) {
    return res.status(400).json({ error: 'Announcement message cannot be empty' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM announcements WHERE id = ?', [id]);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const current = existing[0];
    await pool.query(
      `UPDATE announcements
       SET title = ?, message = ?, is_active = ?
       WHERE id = ?`,
      [
        title !== undefined ? title?.trim() || null : current.title,
        message !== undefined ? String(message).trim() : current.message,
        isActive !== undefined ? (isActive ? 1 : 0) : current.is_active,
        id,
      ],
    );

    const [rows] = await pool.query('SELECT * FROM announcements WHERE id = ?', [id]);
    res.json({ announcement: mapAnnouncement(rows[0]) });
  } catch (error) {
    console.error('PUT /api/announcements/:id failed:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

router.delete('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }

  try {
    const [result] = await pool.query('DELETE FROM announcements WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/announcements/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

module.exports = router;
