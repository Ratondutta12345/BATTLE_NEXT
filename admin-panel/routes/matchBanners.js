const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads', 'match-banners');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

function mapBanner(row) {
  return { id: row.id, title: row.title, imageUrl: row.image_url, matchSlot: row.match_slot, isActive: Boolean(row.is_active), displayOrder: row.display_order, createdAt: row.created_at, updatedAt: row.updated_at };
}

const selectBanners = 'SELECT * FROM match_banners';

router.get('/', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(`${selectBanners} ORDER BY display_order ASC, created_at DESC`);
    res.json({ banners: rows.map(mapBanner) });
  } catch (error) {
    console.error('GET /api/match-banners failed:', error);
    res.status(500).json({ error: 'Failed to fetch match banners' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const slot = String(req.query.slot || '').trim();
    const [rows] = await pool.query(`${selectBanners} WHERE is_active = 1${slot ? ' AND match_slot = ?' : ''} ORDER BY display_order ASC, created_at DESC`, slot ? [slot] : []);
    res.json({ banners: rows.map(mapBanner) });
  } catch (error) {
    console.error('GET /api/match-banners/active failed:', error);
    res.status(500).json({ error: 'Failed to fetch active match banners' });
  }
});

router.post('/', requireAdminKey, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A JPG, PNG, or WebP image is required' });
  const title = String(req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname))).trim();
  const matchSlot = String(req.body.matchSlot || 'all').trim() || 'all';
  const displayOrder = Number(req.body.displayOrder || 0);
  if (!title) return res.status(400).json({ error: 'Banner title is required' });
  if (!Number.isInteger(displayOrder) || displayOrder < 0) return res.status(400).json({ error: 'Display order must be a non-negative integer' });
  try {
    const [result] = await pool.query('INSERT INTO match_banners (title, image_url, match_slot, is_active, display_order) VALUES (?, ?, ?, ?, ?)', [title, `/uploads/match-banners/${req.file.filename}`, matchSlot, req.body.isActive !== 'false' ? 1 : 0, displayOrder]);
    const [rows] = await pool.query(`${selectBanners} WHERE id = ?`, [result.insertId]);
    res.status(201).json({ banner: mapBanner(rows[0]) });
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    console.error('POST /api/match-banners failed:', error);
    res.status(500).json({ error: 'Failed to create match banner' });
  }
});

router.put('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  const displayOrder = req.body.displayOrder === undefined ? null : Number(req.body.displayOrder);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid match banner id' });
  if (displayOrder !== null && (!Number.isInteger(displayOrder) || displayOrder < 0)) return res.status(400).json({ error: 'Display order must be a non-negative integer' });
  try {
    const [result] = await pool.query('UPDATE match_banners SET title = COALESCE(?, title), match_slot = COALESCE(?, match_slot), is_active = COALESCE(?, is_active), display_order = COALESCE(?, display_order) WHERE id = ?', [req.body.title?.trim() || null, req.body.matchSlot?.trim() || null, req.body.isActive === undefined ? null : (req.body.isActive ? 1 : 0), displayOrder, id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Match banner not found' });
    const [rows] = await pool.query(`${selectBanners} WHERE id = ?`, [id]);
    res.json({ banner: mapBanner(rows[0]) });
  } catch (error) {
    console.error('PUT /api/match-banners/:id failed:', error);
    res.status(500).json({ error: 'Failed to update match banner' });
  }
});

router.delete('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid match banner id' });
  try {
    const [rows] = await pool.query('SELECT image_url FROM match_banners WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Match banner not found' });
    await pool.query('DELETE FROM match_banners WHERE id = ?', [id]);
    if (rows[0].image_url.startsWith('/uploads/')) fs.rmSync(path.join(__dirname, '..', 'public', rows[0].image_url), { force: true });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/match-banners/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete match banner' });
  }
});

module.exports = router;
