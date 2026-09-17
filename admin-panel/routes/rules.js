const express = require('express');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');

const router = express.Router();

function mapRule(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    matchSlot: row.match_slot,
    isActive: Boolean(row.is_active),
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rules ORDER BY display_order ASC, created_at DESC');
    res.json({ rules: rows.map(mapRule) });
  } catch (error) {
    console.error('GET /api/rules failed:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const slot = String(req.query.slot || '').trim();
    const [rows] = await pool.query(`SELECT * FROM rules WHERE is_active = 1${slot ? ' AND match_slot = ?' : ''} ORDER BY display_order ASC, created_at DESC`, slot ? [slot] : []);
    res.json({ rules: rows.map(mapRule) });
  } catch (error) {
    console.error('GET /api/rules/active failed:', error);
    res.status(500).json({ error: 'Failed to fetch active rules' });
  }
});

router.post('/', requireAdminKey, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const content = String(req.body.content || '').trim();
  const matchSlot = String(req.body.matchSlot || 'all').trim() || 'all';
  const displayOrder = Number(req.body.displayOrder || 0);
  if (!title || !content) return res.status(400).json({ error: 'Rule title and content are required' });
  if (!Number.isInteger(displayOrder) || displayOrder < 0) return res.status(400).json({ error: 'Display order must be a non-negative integer' });

  try {
    const [result] = await pool.query('INSERT INTO rules (title, content, match_slot, is_active, display_order) VALUES (?, ?, ?, ?, ?)', [title, content, matchSlot, req.body.isActive !== false, displayOrder]);
    const [rows] = await pool.query('SELECT * FROM rules WHERE id = ?', [result.insertId]);
    res.status(201).json({ rule: mapRule(rows[0]) });
  } catch (error) {
    console.error('POST /api/rules failed:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.put('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  const displayOrder = req.body.displayOrder === undefined ? null : Number(req.body.displayOrder);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid rule id' });
  if (displayOrder !== null && (!Number.isInteger(displayOrder) || displayOrder < 0)) return res.status(400).json({ error: 'Display order must be a non-negative integer' });

  try {
    const [result] = await pool.query(
      `UPDATE rules SET title = COALESCE(?, title), content = COALESCE(?, content), match_slot = COALESCE(?, match_slot),
       is_active = COALESCE(?, is_active), display_order = COALESCE(?, display_order) WHERE id = ?`,
      [req.body.title?.trim() || null, req.body.content?.trim() || null, req.body.matchSlot?.trim() || null, req.body.isActive === undefined ? null : (req.body.isActive ? 1 : 0), displayOrder, id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Rule not found' });
    const [rows] = await pool.query('SELECT * FROM rules WHERE id = ?', [id]);
    res.json({ rule: mapRule(rows[0]) });
  } catch (error) {
    console.error('PUT /api/rules/:id failed:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

router.delete('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid rule id' });
  try {
    const [result] = await pool.query('DELETE FROM rules WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Rule not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/rules/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

module.exports = router;
