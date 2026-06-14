const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');

// GET /api/trees/:id/history
router.get('/:id/history', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ch.*, u.first_name, u.last_name, u.username
       FROM change_history ch
       JOIN users u ON u.telegram_id = ch.changed_by
       WHERE ch.tree_id = $1 ORDER BY ch.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/history/:hid/revert
router.post('/:id/history/:hid/revert', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM change_history WHERE id = $1 AND tree_id = $2',
      [req.params.hid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'History record not found' });
    const record = rows[0];
    const diff = record.diff;

    if (record.entity_type === 'person') {
      const prevState = diff.before;
      if (!prevState) return res.status(400).json({ error: 'Cannot revert creation' });
      await query(
        `UPDATE persons SET first_name=$1, last_name=$2, patronymic=$3, birth_date=$4,
         death_date=$5, birth_place=$6, living_place=$7, biography=$8, is_alive=$9,
         tags=$10, updated_at=NOW() WHERE id=$11`,
        [prevState.first_name, prevState.last_name, prevState.patronymic,
         prevState.birth_date, prevState.death_date, prevState.birth_place,
         prevState.living_place, prevState.biography, prevState.is_alive,
         JSON.stringify(prevState.tags), record.entity_id]
      );
    }
    await query('UPDATE change_history SET reverted_at = NOW() WHERE id = $1', [req.params.hid]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
