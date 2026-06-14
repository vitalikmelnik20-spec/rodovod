const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');

// GET /api/trees/:id/chat
router.get('/:id/chat', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before;
  try {
    const { rows } = await query(
      `SELECT fc.*, u.first_name, u.last_name, u.username, u.photo_url
       FROM family_chat fc
       JOIN users u ON u.telegram_id = fc.sender_id
       WHERE fc.tree_id = $1 ${before ? 'AND fc.created_at < $3' : ''}
       ORDER BY fc.created_at DESC LIMIT $2`,
      before ? [req.params.id, limit, before] : [req.params.id, limit]
    );
    res.json(rows.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/chat
router.post('/:id/chat', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  const { message, media_id } = req.body;
  if (!message && !media_id) return res.status(400).json({ error: 'message or media_id required' });
  try {
    const { rows } = await query(
      `INSERT INTO family_chat (tree_id, sender_id, message, media_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.user.telegram_id, message || null, media_id || null]
    );
    const full = await query(
      `SELECT fc.*, u.first_name, u.last_name, u.username, u.photo_url
       FROM family_chat fc JOIN users u ON u.telegram_id = fc.sender_id WHERE fc.id = $1`,
      [rows[0].id]
    );
    req.app.get('io')?.to(`tree:${req.params.id}`).emit('chat:message', full.rows[0]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
