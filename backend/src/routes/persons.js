const router = require('express').Router();
const { query, getClient } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// GET /api/trees/:id/persons
router.get('/:id/persons', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM persons WHERE tree_id = $1 ORDER BY last_name, first_name',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trees/:id/persons/search?q=
router.get('/:id/persons/search', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  const q = req.query.q || '';
  try {
    const { rows } = await query(
      `SELECT * FROM persons WHERE tree_id = $1 AND (
        first_name ILIKE $2 OR last_name ILIKE $2 OR patronymic ILIKE $2 OR
        birth_place ILIKE $2 OR living_place ILIKE $2 OR biography ILIKE $2 OR
        tags::text ILIKE $2
      ) ORDER BY last_name, first_name LIMIT 50`,
      [req.params.id, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trees/:id/persons/:pid
router.get('/:id/persons/:pid', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM persons WHERE id = $1 AND tree_id = $2',
      [req.params.pid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Person not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trees/:id/persons/:pid/relationships — 4.6 bidirectional
// Returns all relationships where this person is person_a OR person_b
router.get('/:id/persons/:pid/relationships', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.*,
        pa.id AS pa_id, pa.first_name AS pa_first, pa.last_name AS pa_last, pa.gender AS pa_gender, pa.avatar_url AS pa_avatar, pa.is_alive AS pa_alive,
        pb.id AS pb_id, pb.first_name AS pb_first, pb.last_name AS pb_last, pb.gender AS pb_gender, pb.avatar_url AS pb_avatar, pb.is_alive AS pb_alive
       FROM relationships r
       JOIN persons pa ON pa.id = r.person_a_id
       JOIN persons pb ON pb.id = r.person_b_id
       WHERE r.tree_id = $1 AND (r.person_a_id = $2 OR r.person_b_id = $2)`,
      [req.params.id, req.params.pid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/persons
router.post('/:id/persons', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  const { first_name, last_name, patronymic, birth_date, death_date,
    birth_place, living_place, biography, is_alive = true, tags = [], gender } = req.body;

  if (!first_name && !last_name) {
    return res.status(400).json({ error: 'first_name or last_name required' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const personId = uuidv4();
    const { rows } = await client.query(
      `INSERT INTO persons (id, tree_id, first_name, last_name, patronymic, birth_date,
        death_date, birth_place, living_place, biography, is_alive, tags, gender, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [personId, req.params.id, first_name, last_name, patronymic,
       birth_date || null, death_date || null, birth_place, living_place,
       biography, is_alive, JSON.stringify(tags), gender || null, req.user.telegram_id]
    );
    await client.query(
      `INSERT INTO change_history (tree_id, entity_type, entity_id, action, changed_by, diff)
       VALUES ($1, 'person', $2, 'create', $3, $4)`,
      [req.params.id, personId, req.user.telegram_id, JSON.stringify({ after: rows[0] })]
    );
    await client.query('COMMIT');

    req.app.get('io')?.to(`tree:${req.params.id}`).emit('person:created', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/trees/:id/persons/:pid — тільки адмін, редактор використовує /propose
router.put('/:id/persons/:pid', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  if (req.userRole === 'editor') {
    return res.status(403).json({
      error: 'Editors must use /propose endpoint',
      code: 'USE_PROPOSE',
    });
  }
  const { first_name, last_name, patronymic, birth_date, death_date,
    birth_place, living_place, biography, is_alive, tags, gender } = req.body;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const before = await client.query('SELECT * FROM persons WHERE id = $1 AND tree_id = $2', [req.params.pid, req.params.id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Person not found' });

    const { rows } = await client.query(
      `UPDATE persons SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         patronymic = COALESCE($3, patronymic),
         birth_date = COALESCE($4, birth_date),
         death_date = COALESCE($5, death_date),
         birth_place = COALESCE($6, birth_place),
         living_place = COALESCE($7, living_place),
         biography = COALESCE($8, biography),
         is_alive = COALESCE($9, is_alive),
         tags = COALESCE($10, tags),
         gender = COALESCE($11, gender),
         updated_at = NOW()
       WHERE id = $12 AND tree_id = $13 RETURNING *`,
      [first_name, last_name, patronymic, birth_date || null, death_date || null,
       birth_place, living_place, biography, is_alive,
       tags ? JSON.stringify(tags) : null, gender || null, req.params.pid, req.params.id]
    );
    await client.query(
      `INSERT INTO change_history (tree_id, entity_type, entity_id, action, changed_by, diff)
       VALUES ($1, 'person', $2, 'update', $3, $4)`,
      [req.params.id, req.params.pid, req.user.telegram_id,
       JSON.stringify({ before: before.rows[0], after: rows[0] })]
    );
    await client.query('COMMIT');

    req.app.get('io')?.to(`tree:${req.params.id}`).emit('person:updated', rows[0]);
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/trees/:id/persons/:pid — тільки адмін
router.delete('/:id/persons/:pid', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM persons WHERE id = $1 AND tree_id = $2', [req.params.pid, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Person not found' });

    await client.query('DELETE FROM persons WHERE id = $1', [req.params.pid]);
    await client.query(
      `INSERT INTO change_history (tree_id, entity_type, entity_id, action, changed_by, diff)
       VALUES ($1, 'person', $2, 'delete', $3, $4)`,
      [req.params.id, req.params.pid, req.user.telegram_id, JSON.stringify({ before: rows[0] })]
    );
    await client.query('COMMIT');

    req.app.get('io')?.to(`tree:${req.params.id}`).emit('person:deleted', { id: req.params.pid });
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/trees/:id/persons/:pid/claim — прив'язати Telegram до вузла
router.post('/:id/persons/:pid/claim', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  try {
    await query(
      'UPDATE persons SET telegram_user_id = $1, updated_at = NOW() WHERE id = $2 AND tree_id = $3',
      [req.user.telegram_id, req.params.pid, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
