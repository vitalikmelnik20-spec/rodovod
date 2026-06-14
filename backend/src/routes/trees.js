const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// GET /api/trees — список дерев користувача
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.*, tm.role, tm.joined_at,
        (SELECT COUNT(*) FROM persons WHERE tree_id = t.id) AS persons_count,
        (SELECT COUNT(*) FROM tree_members WHERE tree_id = t.id AND status = 'active') AS members_count
       FROM trees t
       JOIN tree_members tm ON tm.tree_id = t.id
       WHERE tm.telegram_user_id = $1 AND tm.status = 'active'
       ORDER BY tm.joined_at DESC`,
      [req.user.telegram_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees — створити нове дерево
router.post('/', requireAuth, async (req, res) => {
  const { name, description, is_public = false } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const client = await require('../config/db').getClient();
  try {
    await client.query('BEGIN');
    const treeId = uuidv4();
    const { rows } = await client.query(
      `INSERT INTO trees (id, name, description, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [treeId, name, description || null, is_public, req.user.telegram_id]
    );
    await client.query(
      `INSERT INTO tree_members (tree_id, telegram_user_id, role, status)
       VALUES ($1, $2, 'admin', 'active')`,
      [treeId, req.user.telegram_id]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/trees/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.*, tm.role FROM trees t
       JOIN tree_members tm ON tm.tree_id = t.id
       WHERE t.id = $1 AND tm.telegram_user_id = $2 AND tm.status = 'active'`,
      [req.params.id, req.user.telegram_id]
    );
    if (!rows.length) {
      const pub = await query('SELECT * FROM trees WHERE id = $1 AND is_public = true', [req.params.id]);
      if (!pub.rows.length) return res.status(404).json({ error: 'Tree not found' });
      return res.json({ ...pub.rows[0], role: 'viewer' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/trees/:id
router.put('/:id', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  const { name, description, is_public, settings } = req.body;
  try {
    const { rows } = await query(
      `UPDATE trees SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         is_public = COALESCE($3, is_public),
         settings = COALESCE($4, settings),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, description, is_public, settings ? JSON.stringify(settings) : null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/trees/:id
router.delete('/:id', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  try {
    await query('DELETE FROM trees WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trees/:id/members
router.get('/:id/members', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT tm.*, u.first_name, u.last_name, u.username, u.photo_url
       FROM tree_members tm
       JOIN users u ON u.telegram_id = tm.telegram_user_id
       WHERE tm.tree_id = $1
       ORDER BY tm.joined_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/invite — генерувати посилання-запрошення
router.post('/:id/invite', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const { rows } = await query(
      `INSERT INTO invite_links (tree_id, token, created_by, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days') RETURNING *`,
      [req.params.id, token, req.user.telegram_id]
    );
    const link = `${process.env.FRONTEND_URL}/join/${token}`;
    res.json({ token, link, expires_at: rows[0].expires_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/join/:token — прийняти запрошення
router.post('/:id/join/:token', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM invite_links
       WHERE token = $1 AND tree_id = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
      [req.params.token, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired invite' });

    await query(
      `INSERT INTO tree_members (tree_id, telegram_user_id, role, status, invited_by)
       VALUES ($1, $2, 'editor', 'active', $3)
       ON CONFLICT (tree_id, telegram_user_id) DO NOTHING`,
      [req.params.id, req.user.telegram_id, rows[0].created_by]
    );
    await query('UPDATE invite_links SET used_count = used_count + 1 WHERE id = $1', [rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/trees/:id/members/:uid — змінити роль
router.put('/:id/members/:uid', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    await query(
      'UPDATE tree_members SET role = $1 WHERE tree_id = $2 AND telegram_user_id = $3',
      [role, req.params.id, req.params.uid]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/trees/:id/members/:uid
router.delete('/:id/members/:uid', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  try {
    await query(
      'DELETE FROM tree_members WHERE tree_id = $1 AND telegram_user_id = $2',
      [req.params.id, req.params.uid]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
