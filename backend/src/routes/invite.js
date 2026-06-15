const router = require('express').Router();
const { query } = require('../config/db');

// GET /api/invite/:code — public, no auth required
router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const { rows: trees } = await query(
      'SELECT * FROM trees WHERE invite_code = $1',
      [code]
    );
    if (!trees.length) return res.status(404).json({ error: 'Дерево не знайдено. Перевірте код.' });

    const tree = trees[0];
    const { rows: persons } = await query(
      'SELECT id, first_name, last_name, birth_date, death_date, gender, is_alive, avatar_url, bio FROM persons WHERE tree_id = $1 ORDER BY created_at',
      [tree.id]
    );
    const { rows: relationships } = await query(
      'SELECT * FROM relationships WHERE tree_id = $1',
      [tree.id]
    );

    res.json({ tree: { id: tree.id, name: tree.name, description: tree.description }, persons, relationships });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
