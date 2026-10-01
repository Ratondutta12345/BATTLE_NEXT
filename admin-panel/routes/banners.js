const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const pool = require('../lib/db');
const { requireAdminKey } = require('../lib/adminAuth');
const { getUploadDirectory, resolveUploadUrl } = require('../lib/uploads');

const router = express.Router();
const uploadDirectory = getUploadDirectory('banners');

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
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

function mapBanner(row) {
  return {
    id: row.id,
    imageUrl: row.image_url,
    targetUrl: row.target_url,
    isActive: Boolean(row.is_active),
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const selectBanners = `SELECT id, image_url, target_url, is_active, display_order, created_at, updated_at FROM banners`;

function normalizeTargetUrl(value) {
  const targetUrl = String(value ?? '').trim();
  if (!targetUrl) return null;
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function makeKeyName(fileName) {
  const base = path.basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return `${base || 'banner'}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function makeTitle(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 255) || 'BATTLE-NEXT Banner';
}

router.get('/active', async (_req, res) => {
  try {
    const [rows] = await pool.query(`${selectBanners} WHERE is_active = 1 ORDER BY display_order ASC, created_at DESC`);
    res.json({ banners: rows.map(mapBanner) });
  } catch (error) {
    console.error('GET /api/banners/active failed:', error);
    res.status(500).json({ error: 'Failed to fetch active banners' });
  }
});

router.get('/', requireAdminKey, async (_req, res) => {
  try {
    const [rows] = await pool.query(`${selectBanners} ORDER BY display_order ASC, created_at DESC`);
    res.json({ banners: rows.map(mapBanner) });
  } catch (error) {
    console.error('GET /api/banners failed:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

router.post('/', requireAdminKey, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A JPG, PNG, or WebP banner image is required' });
  const displayOrder = Number(req.body.displayOrder ?? 0);
  if (!Number.isInteger(displayOrder) || displayOrder < 0) return res.status(400).json({ error: 'Display order must be a non-negative integer' });
  const targetUrl = normalizeTargetUrl(req.body.targetUrl);
  if (req.body.targetUrl?.trim() && !targetUrl) return res.status(400).json({ error: 'Banner link must be a valid http or https URL' });

  try {
    const [result] = await pool.query(
      'INSERT INTO banners (key_name, title, image_url, target_url, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [makeKeyName(req.file.originalname), makeTitle(req.file.originalname), `/uploads/banners/${req.file.filename}`, targetUrl, req.body.isActive !== 'false' ? 1 : 0, displayOrder],
    );
    const [rows] = await pool.query(`${selectBanners} WHERE id = ?`, [result.insertId]);
    res.status(201).json({ banner: mapBanner(rows[0]) });
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    console.error('POST /api/banners failed:', error);
    res.status(500).json({ error: 'Failed to create banner' });
  }
});

router.put('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  const displayOrder = req.body.displayOrder === undefined ? undefined : Number(req.body.displayOrder);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid banner id' });
  if (displayOrder !== undefined && (!Number.isInteger(displayOrder) || displayOrder < 0)) return res.status(400).json({ error: 'Display order must be a non-negative integer' });
  const targetUrl = req.body.targetUrl === undefined ? undefined : normalizeTargetUrl(req.body.targetUrl);
  if (req.body.targetUrl !== undefined && String(req.body.targetUrl).trim() && !targetUrl) return res.status(400).json({ error: 'Banner link must be a valid http or https URL' });

  try {
    const targetUrlClause = targetUrl === undefined ? 'target_url' : '?';
    const [result] = await pool.query(
      `UPDATE banners SET target_url = ${targetUrlClause}, is_active = COALESCE(?, is_active), display_order = COALESCE(?, display_order) WHERE id = ?`,
      [
        ...(targetUrl === undefined ? [] : [targetUrl]),
        req.body.isActive === undefined ? null : (req.body.isActive ? 1 : 0),
        displayOrder ?? null,
        id,
      ],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Banner not found' });
    const [rows] = await pool.query(`${selectBanners} WHERE id = ?`, [id]);
    res.json({ banner: mapBanner(rows[0]) });
  } catch (error) {
    console.error('PUT /api/banners/:id failed:', error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

router.delete('/:id', requireAdminKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid banner id' });
  try {
    const [rows] = await pool.query('SELECT image_url FROM banners WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Banner not found' });
    await pool.query('DELETE FROM banners WHERE id = ?', [id]);
    const imagePath = resolveUploadUrl(rows[0].image_url);
    if (imagePath) fs.rmSync(imagePath, { force: true });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/banners/:id failed:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

module.exports = router;