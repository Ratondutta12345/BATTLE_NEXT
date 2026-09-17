const express = require('express');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');

const router = express.Router();

router.get('/support', async (_req, res) => {
  try {
    const [contactRows] = await pool.query(
      `SELECT id, contact_type, label, contact_value
       FROM contact_options
       WHERE is_active = 1
       ORDER BY display_order ASC, id ASC`,
    );
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key IN ('support_email', 'support_phone', 'support_message')`,
    );

    const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
    res.json({
      support: {
        email: settings.support_email || null,
        phone: settings.support_phone || null,
        message: settings.support_message || null,
        options: contactRows.map((row) => ({ id: row.id, type: row.contact_type, label: row.label, value: row.contact_value })),
      },
    });
  } catch (error) {
    console.error('GET /api/settings/support failed:', error);
    res.status(500).json({ error: 'Failed to fetch support details' });
  }
});

function mapContact(row) {
  return { id: row.id, type: row.contact_type, label: row.label, value: row.contact_value, isActive: Boolean(row.is_active), displayOrder: row.display_order };
}

router.get('/contacts', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM contact_options ORDER BY display_order ASC, id ASC');
    res.json({ contacts: rows.map(mapContact) });
  } catch (error) {
    console.error('GET /api/settings/contacts failed:', error);
    res.status(500).json({ error: 'Failed to fetch contact options' });
  }
});

router.post('/contacts', requireAdminKey, async (req, res) => {
  const type = String(req.body.type || '').trim().toLowerCase();
  const label = String(req.body.label || type).trim();
  const value = String(req.body.value || '').trim();
  if (!['phone', 'telegram', 'email'].includes(type) || !value) return res.status(400).json({ error: 'Contact type and value are required.' });
  try {
    const [result] = await pool.query(
      'INSERT INTO contact_options (contact_type, label, contact_value, display_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [type, label, value, Number(req.body.displayOrder || 0), req.body.isActive === false ? 0 : 1],
    );
    const [rows] = await pool.query('SELECT * FROM contact_options WHERE id = ?', [result.insertId]);
    res.status(201).json({ contact: mapContact(rows[0]) });
  } catch (error) {
    console.error('POST /api/settings/contacts failed:', error);
    res.status(500).json({ error: 'Failed to create contact option' });
  }
});

router.put('/contacts/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid contact id' });
  try {
    const [existing] = await pool.query('SELECT * FROM contact_options WHERE id = ?', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'Contact option not found' });
    const current = existing[0];
    const type = req.body.type ? String(req.body.type).trim().toLowerCase() : current.contact_type;
    if (!['phone', 'telegram', 'email'].includes(type)) return res.status(400).json({ error: 'Invalid contact type' });
    await pool.query(
      'UPDATE contact_options SET contact_type = ?, label = ?, contact_value = ?, display_order = ?, is_active = ? WHERE id = ?',
      [type, req.body.label !== undefined ? String(req.body.label).trim() : current.label, req.body.value !== undefined ? String(req.body.value).trim() : current.contact_value, req.body.displayOrder !== undefined ? Number(req.body.displayOrder) : current.display_order, req.body.isActive !== undefined ? (req.body.isActive ? 1 : 0) : current.is_active, id],
    );
    const [rows] = await pool.query('SELECT * FROM contact_options WHERE id = ?', [id]);
    res.json({ contact: mapContact(rows[0]) });
  } catch (error) {
    console.error('PUT /api/settings/contacts/:id failed:', error);
    res.status(500).json({ error: 'Failed to update contact option' });
  }
});

router.delete('/contacts/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid contact id' });
  try {
    const [result] = await pool.query('DELETE FROM contact_options WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Contact option not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/settings/contacts/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete contact option' });
  }
});

module.exports = router;