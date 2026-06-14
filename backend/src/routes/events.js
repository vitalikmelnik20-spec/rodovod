const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');

// GET /api/trees/:id/events
router.get('/:id/events', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT e.*, p.first_name, p.last_name FROM events e
       LEFT JOIN persons p ON p.id = e.person_id
       WHERE e.tree_id = $1 ORDER BY e.event_date ASC NULLS LAST`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/events
router.post('/:id/events', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  const { person_id, event_type, title, description, event_date, media_ids = [] } = req.body;
  if (!title || !event_type) return res.status(400).json({ error: 'title and event_type required' });
  try {
    const { rows } = await query(
      `INSERT INTO events (tree_id, person_id, event_type, title, description, event_date, media_ids, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, person_id || null, event_type, title,
       description || null, event_date || null, JSON.stringify(media_ids), req.user.telegram_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
