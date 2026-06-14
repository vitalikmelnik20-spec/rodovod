const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [payload.telegram_id]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireTreeRole(roles) {
  return async (req, res, next) => {
    const treeId = req.params.id || req.params.treeId;
    const { rows } = await query(
      'SELECT role FROM tree_members WHERE tree_id = $1 AND telegram_user_id = $2 AND status = $3',
      [treeId, req.user.telegram_id, 'active']
    );
    if (!rows.length) return res.status(403).json({ error: 'Access denied' });
    if (!roles.includes(rows[0].role)) return res.status(403).json({ error: 'Insufficient permissions' });
    req.userRole = rows[0].role;
    next();
  };
}

module.exports = { requireAuth, requireTreeRole };
