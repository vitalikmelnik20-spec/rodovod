const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');

// GET /api/trees/:id/relationships
router.get('/:id/relationships', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM relationships WHERE tree_id = $1',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/relationships
router.post('/:id/relationships', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  const { person_a_id, person_b_id, relation_type, marriage_date, divorce_date, notes } = req.body;
  if (!person_a_id || !person_b_id || !relation_type) {
    return res.status(400).json({ error: 'person_a_id, person_b_id, relation_type required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO relationships (tree_id, person_a_id, person_b_id, relation_type, marriage_date, divorce_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, person_a_id, person_b_id, relation_type,
       marriage_date || null, divorce_date || null, notes || null]
    );
    req.app.get('io')?.to(`tree:${req.params.id}`).emit('relationship:created', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/trees/:id/relationships/:rid
router.put('/:id/relationships/:rid', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  const { relation_type, marriage_date, divorce_date, notes } = req.body;
  try {
    const { rows } = await query(
      `UPDATE relationships SET
         relation_type = COALESCE($1, relation_type),
         marriage_date = COALESCE($2, marriage_date),
         divorce_date = COALESCE($3, divorce_date),
         notes = COALESCE($4, notes)
       WHERE id = $5 AND tree_id = $6 RETURNING *`,
      [relation_type, marriage_date || null, divorce_date || null, notes, req.params.rid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Relationship not found' });
    req.app.get('io')?.to(`tree:${req.params.id}`).emit('relationship:updated', rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/trees/:id/relationships/:rid
router.delete('/:id/relationships/:rid', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  try {
    await query('DELETE FROM relationships WHERE id = $1 AND tree_id = $2', [req.params.rid, req.params.id]);
    req.app.get('io')?.to(`tree:${req.params.id}`).emit('relationship:deleted', { id: req.params.rid });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
