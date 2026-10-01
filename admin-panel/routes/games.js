const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');
const { getUploadDirectory, resolveUploadUrl } = require('../lib/uploads');

const router = express.Router();
const uploadDirectory = getUploadDirectory('games');

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

function mapGame(row) {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    isActive: Boolean(row.is_active),
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function makeSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
  return `${base || 'game'}-${Date.now()}`;
}

function makeKeyName(name) {
  return `${makeSlug(name)}-${crypto.randomBytes(4).toString('hex')}`.slice(0, 180);
}

const selectGames = 'SELECT id, name, image_url, is_active, display_order, created_at, updated_at FROM games';

router.get('/active', async (_req, res) => {
  try {
    const [rows] = await pool.query(`${selectGames} WHERE is_active = 1 ORDER BY display_order ASC, created_at DESC`);
    res.json({ games: rows.map(mapGame) });
  } catch (error) {
    console.error('GET /api/games/active failed:', error);
    res.status(500).json({ error: 'Failed to fetch active games' });
  }
});

router.get('/', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(`${selectGames} ORDER BY display_order ASC, created_at DESC`);
    res.json({ games: rows.map(mapGame) });
  } catch (error) {
    console.error('GET /api/games failed:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid game id' });
  try {
    const [rows] = await pool.query(`${selectGames} WHERE id = ? AND is_active = 1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Game not found' });
    res.json({ game: mapGame(rows[0]) });
  } catch (error) {
    console.error('GET /api/games/:id failed:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

router.post('/', requireAdminKey, upload.single('image'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const displayOrder = Number(req.body.displayOrder ?? 0);
  if (!name || name.length > 150) return res.status(400).json({ error: 'Game name is required and must be 150 characters or fewer' });
  if (!req.file) return res.status(400).json({ error: 'A JPG, PNG, or WebP game image is required' });
  if (!Number.isInteger(displayOrder) || displayOrder < 0) return res.status(400).json({ error: 'Display order must be a non-negative integer' });
  try {
    const [result] = await pool.query(
      'INSERT INTO games (key_name, title, name, slug, image_url, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [makeKeyName(name), name, name, makeSlug(name), `/uploads/games/${req.file.filename}`, req.body.isActive !== 'false' ? 1 : 0, displayOrder],
    );
    const [rows] = await pool.query(`${selectGames} WHERE id = ?`, [result.insertId]);
    res.status(201).json({ game: mapGame(rows[0]) });
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    console.error('POST /api/games failed:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

router.put('/:id', requireAdminKey, upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  const displayOrder = req.body.displayOrder === undefined ? undefined : Number(req.body.displayOrder);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid game id' });
  if (name !== undefined && (!name || name.length > 150)) return res.status(400).json({ error: 'Game name is required and must be 150 characters or fewer' });
  if (displayOrder !== undefined && (!Number.isInteger(displayOrder) || displayOrder < 0)) return res.status(400).json({ error: 'Display order must be a non-negative integer' });
  try {
    const [existing] = await pool.query('SELECT image_url FROM games WHERE id = ?', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'Game not found' });
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (name !== undefined) { fields.push('slug = ?'); values.push(makeSlug(name)); }
    if (req.body.isActive !== undefined) { fields.push('is_active = ?'); values.push(req.body.isActive ? 1 : 0); }
    if (displayOrder !== undefined) { fields.push('display_order = ?'); values.push(displayOrder); }
    if (req.file) { fields.push('image_url = ?'); values.push(`/uploads/games/${req.file.filename}`); }
    if (fields.length) { values.push(id); await pool.query(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`, values); }
    const [rows] = await pool.query(`${selectGames} WHERE id = ?`, [id]);
    if (req.file && existing[0].image_url.startsWith('/uploads/')) {
      const imagePath = resolveUploadUrl(existing[0].image_url);
      if (imagePath) fs.rmSync(imagePath, { force: true });
    }
    res.json({ game: mapGame(rows[0]) });
  } catch (error) {
    console.error('PUT /api/games/:id failed:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

router.delete('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid game id' });
  try {
    const [rows] = await pool.query('SELECT image_url FROM games WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Game not found' });
    await pool.query('DELETE FROM games WHERE id = ?', [id]);
    const imagePath = resolveUploadUrl(rows[0].image_url);
    if (imagePath) fs.rmSync(imagePath, { force: true });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/games/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

module.exports = router;