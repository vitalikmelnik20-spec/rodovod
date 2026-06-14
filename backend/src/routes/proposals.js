const router = require('express').Router();
const { query, getClient } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Відправити сповіщення адмінам через бота (fire-and-forget)
async function notifyAdmins(treeId, message, keyboard) {
  try {
    const { rows: admins } = await query(
      `SELECT u.telegram_id FROM tree_members tm
       JOIN users u ON u.telegram_id = tm.telegram_user_id
       WHERE tm.tree_id = $1 AND tm.role = 'admin' AND tm.status = 'active'`,
      [treeId]
    );
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !admins.length) return;

    const body = { text: message, parse_mode: 'Markdown' };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);

    await Promise.all(admins.map(a =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: a.telegram_id, ...body }),
      }).catch(() => null)
    ));
  } catch (e) {
    console.error('notifyAdmins error:', e.message);
  }
}

// GET /api/trees/:id/proposals — список (для адміна)
router.get('/:id/proposals', requireAuth, requireTreeRole(['admin']), async (req, res) => {
  const { status = 'pending' } = req.query;
  try {
    const { rows } = await query(
      `SELECT cp.*, u.first_name, u.last_name, u.username,
        p.first_name AS person_first, p.last_name AS person_last
       FROM change_proposals cp
       JOIN users u ON u.telegram_id = cp.proposed_by
       LEFT JOIN persons p ON p.id = cp.entity_id::uuid
       WHERE cp.tree_id = $1 AND cp.status = $2
       ORDER BY cp.created_at DESC`,
      [req.params.id, status]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/persons/:pid/propose — редактор пропонує зміни
router.post('/:id/persons/:pid/propose', requireAuth, requireTreeRole(['admin', 'editor']), async (req, res) => {
  // Адмін редагує напряму, редактор пропонує
  if (req.userRole === 'admin') {
    return res.status(400).json({ error: 'Admins can edit directly. Use PUT endpoint.' });
  }

  const changes = req.body;
  if (!Object.keys(changes).length) {
    return res.status(400).json({ error: 'No changes provided' });
  }

  try {
    const { rows: [person] } = await query(
      'SELECT * FROM persons WHERE id = $1 AND tree_id = $2',
      [req.params.pid, req.params.id]
    );
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const { rows: [tree] } = await query('SELECT name FROM trees WHERE id = $1', [req.params.id]);
    const { rows: [proposer] } = await query('SELECT * FROM users WHERE telegram_id = $1', [req.user.telegram_id]);

    const proposalId = uuidv4();
    const { rows: [proposal] } = await query(
      `INSERT INTO change_proposals (id, tree_id, entity_type, entity_id, action, proposed_by, diff)
       VALUES ($1, $2, 'person', $3, 'update', $4, $5) RETURNING *`,
      [proposalId, req.params.id, req.params.pid, req.user.telegram_id, JSON.stringify({ before: person, changes })]
    );

    // Будуємо зрозумілий текст змін
    const changeLines = Object.entries(changes)
      .map(([k, v]) => `• *${k}*: ${person[k] || '—'} → ${v}`)
      .join('\n');

    const personName = [person.last_name, person.first_name].filter(Boolean).join(' ') || 'Без імені';
    const proposerName = proposer.username ? `@${proposer.username}` : proposer.first_name;

    const message = `📝 *Запит на редагування*\n\nДерево: *${tree.name}*\nОсоба: *${personName}*\nВід: ${proposerName}\n\nЗміни:\n${changeLines}`;
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Схвалити', callback_data: `approve:${proposalId}` },
        { text: '❌ Відхилити', callback_data: `reject:${proposalId}` },
      ]],
    };

    await notifyAdmins(req.params.id, message, keyboard);

    // Socket: оновити бейдж для адмінів
    req.app.get('io')?.to(`tree:${req.params.id}`).emit('proposal:created', proposal);

    res.status(201).json(proposal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trees/:id/persons/:pid/propose-delete — редактор пропонує видалення
router.post('/:id/persons/:pid/propose-delete', requireAuth, requireTreeRole(['editor']), async (req, res) => {
  try {
    const { rows: [person] } = await query(
      'SELECT * FROM persons WHERE id = $1 AND tree_id = $2',
      [req.params.pid, req.params.id]
    );
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const { rows: [tree] } = await query('SELECT name FROM trees WHERE id = $1', [req.params.id]);
    const { rows: [proposer] } = await query('SELECT * FROM users WHERE telegram_id = $1', [req.user.telegram_id]);

    const proposalId = uuidv4();
    const { rows: [proposal] } = await query(
      `INSERT INTO change_proposals (id, tree_id, entity_type, entity_id, action, proposed_by, diff)
       VALUES ($1, $2, 'person', $3, 'delete', $4, $5) RETURNING *`,
      [proposalId, req.params.id, req.params.pid, req.user.telegram_id, JSON.stringify({ person })]
    );

    const personName = [person.last_name, person.first_name].filter(Boolean).join(' ') || 'Без імені';
    const proposerName = proposer.username ? `@${proposer.username}` : proposer.first_name;

    const message = `🗑 *Запит на видалення особи*\n\nДерево: *${tree.name}*\nОсоба: *${personName}*\nВід: ${proposerName}`;
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Підтвердити видалення', callback_data: `approve:${proposalId}` },
        { text: '❌ Скасувати', callback_data: `reject:${proposalId}` },
      ]],
    };

    await notifyAdmins(req.params.id, message, keyboard);
    req.app.get('io')?.to(`tree:${req.params.id}`).emit('proposal:created', proposal);
    res.status(201).json(proposal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/proposals/:propId/approve
router.put('/proposals/:propId/approve', requireAuth, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: [proposal] } = await client.query(
      `SELECT cp.*, tm.role FROM change_proposals cp
       JOIN tree_members tm ON tm.tree_id = cp.tree_id AND tm.telegram_user_id = $2 AND tm.status = 'active'
       WHERE cp.id = $1 AND cp.status = 'pending'`,
      [req.params.propId, req.user.telegram_id]
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found or not pending' });
    if (proposal.role !== 'admin') return res.status(403).json({ error: 'Only admins can approve' });

    if (proposal.entity_type === 'person') {
      if (proposal.action === 'update') {
        const { changes } = proposal.diff;
        const sets = Object.entries(changes).map(([k], i) => `${k} = $${i + 2}`).join(', ');
        const vals = Object.values(changes);
        await client.query(
          `UPDATE persons SET ${sets}, updated_at = NOW() WHERE id = $1`,
          [proposal.entity_id, ...vals]
        );
      } else if (proposal.action === 'delete') {
        await client.query('DELETE FROM persons WHERE id = $1', [proposal.entity_id]);
      }
    }

    await client.query(
      `UPDATE change_proposals SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2`,
      [req.user.telegram_id, req.params.propId]
    );

    await client.query(
      `INSERT INTO change_history (tree_id, entity_type, entity_id, action, changed_by, diff)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [proposal.tree_id, proposal.entity_type, proposal.entity_id,
       proposal.action, req.user.telegram_id, JSON.stringify(proposal.diff)]
    );

    await client.query('COMMIT');

    req.app.get('io')?.to(`tree:${proposal.tree_id}`).emit('proposal:approved', {
      proposalId: req.params.propId, entityId: proposal.entity_id, action: proposal.action,
    });

    // Сповістити того хто запропонував
    await notifyProposer(proposal.proposed_by, '✅ Ваші зміни *схвалено* адміністратором!');

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/proposals/:propId/reject
router.put('/proposals/:propId/reject', requireAuth, async (req, res) => {
  try {
    const { rows: [proposal] } = await query(
      `SELECT cp.*, tm.role FROM change_proposals cp
       JOIN tree_members tm ON tm.tree_id = cp.tree_id AND tm.telegram_user_id = $2 AND tm.status = 'active'
       WHERE cp.id = $1 AND cp.status = 'pending'`,
      [req.params.propId, req.user.telegram_id]
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.role !== 'admin') return res.status(403).json({ error: 'Only admins can reject' });

    const note = req.body.note || null;
    await query(
      `UPDATE change_proposals SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
       WHERE id = $3`,
      [req.user.telegram_id, note, req.params.propId]
    );

    req.app.get('io')?.to(`tree:${proposal.tree_id}`).emit('proposal:rejected', { proposalId: req.params.propId });

    const noteText = note ? `\n\nПричина: _${note}_` : '';
    await notifyProposer(proposal.proposed_by, `❌ Ваші зміни *відхилено* адміністратором.${noteText}`);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function notifyProposer(telegramId, message) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: 'Markdown' }),
    });
  } catch { }
}

module.exports = router;
