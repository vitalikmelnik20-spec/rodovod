const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const uploadDir = process.env.MEDIA_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

function getMediaType(mimetype) {
  if (mimetype.startsWith('image/')) return 'photo';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

// POST /api/trees/:id/persons/:pid/media
router.post('/:id/persons/:pid/media', requireAuth, requireTreeRole(['admin', 'editor']),
  upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const { title, description, is_avatar = false } = req.body;
    const url = `/uploads/${req.file.filename}`;
    const type = getMediaType(req.file.mimetype);

    try {
      if (is_avatar === 'true' || is_avatar === true) {
        await query('UPDATE media SET is_avatar = false WHERE person_id = $1', [req.params.pid]);
      }
      const { rows } = await query(
        `INSERT INTO media (person_id, tree_id, type, url, title, description, is_avatar, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.params.pid, req.params.id, type, url, title || null,
         description || null, is_avatar === 'true', req.user.telegram_id]
      );
      if (is_avatar === 'true') {
        await query('UPDATE persons SET avatar_url = $1 WHERE id = $2', [url, req.params.pid]);
      }
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/trees/:id/persons/:pid/media
router.get('/:id/persons/:pid/media', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM media WHERE person_id = $1 AND tree_id = $2 ORDER BY created_at DESC',
      [req.params.pid, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/media/:mid
router.delete('/media/:mid', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM media WHERE id = $1', [req.params.mid]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    await query('DELETE FROM media WHERE id = $1', [req.params.mid]);
    const filePath = path.join(uploadDir, path.basename(rows[0].url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/media/:mid/avatar
router.put('/media/:mid/avatar', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM media WHERE id = $1', [req.params.mid]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    await query('UPDATE media SET is_avatar = false WHERE person_id = $1', [rows[0].person_id]);
    await query('UPDATE media SET is_avatar = true WHERE id = $1', [req.params.mid]);
    await query('UPDATE persons SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
      [rows[0].url, rows[0].person_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
