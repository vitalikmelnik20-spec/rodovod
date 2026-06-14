const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');

// GET /api/trees/:id/persons/:pid/memory
router.get('/:id/persons/:pid/memory', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT mb.*, u.first_name, u.last_name, u.username, u.photo_url
       FROM memory_board mb
       JOIN users u ON u.telegram_id = mb.author_id
       WHERE mb.person_id = $1 ORDER BY mb.created_at DESC`,
      [req.params.pid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/persons/:pid/memory
router.post('/:id/persons/:pid/memory', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  const { content, media_id } = req.body;
  if (!content && !media_id) return res.status(400).json({ error: 'content or media_id required' });

  try {
    const person = await query('SELECT is_alive FROM persons WHERE id = $1 AND tree_id = $2', [req.params.pid, req.params.id]);
    if (!person.rows.length) return res.status(404).json({ error: 'Person not found' });
    if (person.rows[0].is_alive) return res.status(400).json({ error: 'Memory board is only for deceased persons' });

    const { rows } = await query(
      `INSERT INTO memory_board (person_id, author_id, content, media_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.pid, req.user.telegram_id, content || null, media_id || null]
    );
    req.app.get('io')?.to(`tree:${req.params.id}`).emit('memory:created', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
