const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { verifyTelegramInitData, verifyTelegramLoginWidget } = require('../services/telegramAuth');
const { requireAuth } = require('../middleware/auth');

function generateTokens(telegramId) {
  const access = jwt.sign({ telegram_id: telegramId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refresh = jwt.sign({ telegram_id: telegramId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { access, refresh };
}

async function upsertUser(telegramUser) {
  const { rows } = await query(
    `INSERT INTO users (telegram_id, first_name, last_name, username, photo_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (telegram_id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       username = EXCLUDED.username,
       photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
       updated_at = NOW()
     RETURNING *`,
    [telegramUser.id, telegramUser.first_name, telegramUser.last_name || null,
     telegramUser.username || null, telegramUser.photo_url || null]
  );
  return rows[0];
}

// POST /api/auth/telegram — Telegram WebApp initData
router.post('/telegram', async (req, res) => {
  try {
    const { init_data } = req.body;
    if (!init_data) return res.status(400).json({ error: 'init_data required' });

    const telegramUser = verifyTelegramInitData(init_data);
    if (!telegramUser) return res.status(401).json({ error: 'Invalid Telegram data' });

    console.log('[auth] telegramUser:', JSON.stringify(telegramUser));
    const user = await upsertUser(telegramUser);
    const tokens = generateTokens(user.telegram_id);
    res.json({ user, ...tokens });
  } catch (err) {
    console.error('[auth/telegram] error:', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// POST /api/auth/telegram/widget — Telegram Login Widget (callback mode)
router.post('/telegram/widget', async (req, res) => {
  try {
    const telegramUser = verifyTelegramLoginWidget(req.body);
    if (!telegramUser) return res.status(401).json({ error: 'Invalid Telegram data' });

    const user = await upsertUser(telegramUser);
    const tokens = generateTokens(user.telegram_id);
    res.json({ user, ...tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/telegram/widget/redirect — Telegram Login Widget (redirect mode for Telegram browser)
router.get('/telegram/widget/redirect', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || '';
  try {
    const telegramUser = verifyTelegramLoginWidget(req.query);
    if (!telegramUser) {
      return res.redirect(`${frontendUrl}/login?error=invalid`);
    }
    const user = await upsertUser(telegramUser);
    const tokens = generateTokens(user.telegram_id);
    const params = new URLSearchParams({
      access: tokens.access,
      refresh: tokens.refresh,
      user: JSON.stringify(user),
    });
    res.redirect(`${frontendUrl}/login?${params}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${frontendUrl}/login?error=server`);
  }
});

// POST /api/auth/telegram/bot — авторизація напряму з бота (server-to-server)
router.post('/telegram/bot', async (req, res) => {
  try {
    const { telegram_id, first_name, last_name, username } = req.body;
    if (!telegram_id) return res.status(400).json({ error: 'telegram_id required' });
    const user = await upsertUser({ id: telegram_id, first_name, last_name, username });
    const tokens = generateTokens(user.telegram_id);
    res.json({ user, ...tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

    const payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [payload.telegram_id]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    const tokens = generateTokens(rows[0].telegram_id);
    res.json({ user: rows[0], ...tokens });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => res.json({ ok: true }));

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
