require('dotenv').config();
const { Bot, InlineKeyboard, session } = require('grammy');
const axios = require('axios');

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const API = process.env.API_URL || 'http://localhost:3000/api';

const userSessions = new Map();

async function apiRequest(method, path, data, token) {
  try {
    const res = await axios({ method, url: `${API}${path}`, data,
      headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return res.data;
  } catch (err) {
    throw err.response?.data || { error: 'API error' };
  }
}

function getSession(telegramId) {
  if (!userSessions.has(telegramId)) userSessions.set(telegramId, {});
  return userSessions.get(telegramId);
}

// /start
bot.command('start', async (ctx) => {
  const user = ctx.from;
  const session = getSession(user.id);

  try {
    const initData = `user=${JSON.stringify({
      id: user.id, first_name: user.first_name,
      last_name: user.last_name, username: user.username,
    })}&auth_date=${Math.floor(Date.now()/1000)}&hash=bot_auth`;

    const res = await apiRequest('POST', '/auth/telegram/bot', {
      telegram_id: user.id,
      first_name: user.first_name,
      last_name: user.last_name || null,
      username: user.username || null,
    });
    session.token = res.access;
    session.user = res.user;
  } catch {}

  const keyboard = new InlineKeyboard()
    .text('🌳 Мої дерева', 'my_trees').row()
    .text('➕ Створити дерево', 'create_tree').row()
    .url('🌐 Відкрити веб-версію', process.env.FRONTEND_URL || 'http://localhost:5173');

  await ctx.reply(
    `🌳 *Родовідне Дерево*\n\nВітаю, ${user.first_name}!\n\nЦе платформа для спільного ведення родовідного дерева вашої родини.\n\nОберіть дію:`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
});

// /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 *Доступні команди:*\n\n` +
    `/start — Головне меню\n` +
    `/trees — Мої дерева\n` +
    `/add — Додати людину\n` +
    `/search [ім'я] — Пошук по дереву\n` +
    `/history — Журнал змін\n` +
    `/export — Експорт дерева\n` +
    `/members — Учасники дерева\n` +
    `/invite — Запросити учасника\n` +
    `/settings — Налаштування\n` +
    `/web — Посилання на веб-версію\n` +
    `/help — Ця довідка`,
    { parse_mode: 'Markdown' }
  );
});

// /trees
bot.command('trees', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session.token) return ctx.reply('Спочатку запустіть /start');

  try {
    const trees = await apiRequest('GET', '/trees', null, session.token);
    if (!trees.length) {
      return ctx.reply('У вас ще немає дерев. Створіть перше!',
        { reply_markup: new InlineKeyboard().text('➕ Створити дерево', 'create_tree') });
    }
    const keyboard = new InlineKeyboard();
    trees.forEach(t => keyboard.text(`🌳 ${t.name} (${t.persons_count} осіб)`, `tree_${t.id}`).row());

    await ctx.reply('*Ваші родовідні дерева:*', { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    ctx.reply('Помилка завантаження дерев');
  }
});

// /web
bot.command('web', async (ctx) => {
  const url = process.env.FRONTEND_URL || 'http://localhost:5173';
  await ctx.reply(`🌐 Відкрийте веб-версію:\n${url}`);
});

// /invite
bot.command('invite', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session.token || !session.currentTreeId) {
    return ctx.reply('Спочатку оберіть дерево командою /trees');
  }
  try {
    const { link } = await apiRequest('POST', `/trees/${session.currentTreeId}/invite`, {}, session.token);
    await ctx.reply(`🔗 Посилання-запрошення (діє 7 днів):\n${link}`);
  } catch {
    ctx.reply('Помилка генерації запрошення');
  }
});

// Callback queries
bot.callbackQuery('my_trees', async (ctx) => {
  await ctx.answerCallbackQuery();
  await bot.api.sendMessage(ctx.from.id, '/trees');
});

bot.callbackQuery('create_tree', async (ctx) => {
  await ctx.answerCallbackQuery();
  getSession(ctx.from.id).waitingFor = 'tree_name';
  await ctx.reply('Введіть назву нового дерева:');
});

bot.callbackQuery(/^tree_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const treeId = ctx.match[1];
  const session = getSession(ctx.from.id);
  session.currentTreeId = treeId;

  const keyboard = new InlineKeyboard()
    .text('👥 Учасники', `members_${treeId}`).text('➕ Додати особу', `add_person_${treeId}`).row()
    .text('🔗 Запросити', `invite_${treeId}`).text('📋 Журнал', `history_${treeId}`).row()
    .url('🌐 Переглянути граф', `${process.env.FRONTEND_URL}/tree/${treeId}`);

  await ctx.reply(`🌳 *Дерево обрано*\n\nОберіть дію:`, { parse_mode: 'Markdown', reply_markup: keyboard });
});

// Text handler для введення назви дерева
bot.on('message:text', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session.token) return;

  if (session.waitingFor === 'tree_name') {
    session.waitingFor = null;
    try {
      const tree = await apiRequest('POST', '/trees', { name: ctx.message.text }, session.token);
      session.currentTreeId = tree.id;
      await ctx.reply(`✅ Дерево *${tree.name}* створено!\n\nТепер можна додавати людей.`,
        { parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('➕ Додати першу особу', `add_person_${tree.id}`) });
    } catch {
      ctx.reply('Помилка створення дерева');
    }
  }
});

bot.catch(err => console.error('Bot error:', err));

bot.start({ onStart: () => console.log('Telegram bot started') });
