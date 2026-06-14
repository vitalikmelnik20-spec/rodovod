require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const fsm = require('./fsm');
const api = require('./api');
const { mainMenu, treeMenu, personMenu, relationTypeMenu, confirmMenu, skipButton, cancelButton } = require('./keyboards');
const { formatPerson, formatDate, parseDate, relTypeLabel } = require('./utils');

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Авторизація ─────────────────────────────────────────────────────────────

async function ensureAuth(ctx) {
  const u = ctx.from;
  if (fsm.getToken(u.id)) return true;
  try {
    const res = await api.auth({
      telegram_id: u.id, first_name: u.first_name,
      last_name: u.last_name || null, username: u.username || null,
    });
    fsm.setToken(u.id, res.access);
    return true;
  } catch {
    await ctx.reply('❌ Помилка авторизації. Спробуйте /start');
    return false;
  }
}

// ─── /start ──────────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  await ensureAuth(ctx);
  fsm.clearState(ctx.from.id);

  // Перевірити чи є deep link (join токен)
  const payload = ctx.match;
  if (payload && payload.startsWith('join_')) {
    const token = payload.replace('join_', '');
    const tree = fsm.getCurrentTree(ctx.from.id);
    // Перенаправляємо на join flow
    ctx.match = token;
    return handleJoin(ctx);
  }

  await ctx.reply(
    `🌳 *Родовідне Дерево*\n\nВітаю, ${ctx.from.first_name}!\n\nПлатформа для спільного ведення родовідного дерева вашої родини.`,
    { parse_mode: 'Markdown', reply_markup: mainMenu(FRONTEND) }
  );
});

// ─── /help ───────────────────────────────────────────────────────────────────

bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 *Команди бота:*\n\n` +
    `/start — Головне меню\n` +
    `/trees — Мої дерева\n` +
    `/tree — Поточне дерево\n` +
    `/add — Додати особу\n` +
    `/search [ім'я] — Пошук\n` +
    `/members — Учасники\n` +
    `/history — Журнал змін\n` +
    `/invite — Запросити учасника\n` +
    `/settings — Налаштування\n` +
    `/web — Відкрити веб-версію\n` +
    `/help — Ця довідка`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /web ────────────────────────────────────────────────────────────────────

bot.command('web', async (ctx) => {
  const tree = fsm.getCurrentTree(ctx.from.id);
  const url = tree.id ? `${FRONTEND}/tree/${tree.id}` : FRONTEND;
  await ctx.reply(`🌐 Відкрийте веб-версію:\n${url}`);
});

// ─── /trees ──────────────────────────────────────────────────────────────────

bot.command('trees', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  await showTrees(ctx);
});

async function showTrees(ctx) {
  const token = fsm.getToken(ctx.from.id);
  try {
    const trees = await api.getTrees(token);
    if (!trees.length) {
      return ctx.reply('У вас ще немає дерев.\nСтворіть перше!',
        { reply_markup: new InlineKeyboard().text('➕ Створити дерево', 'create_tree') });
    }
    const kb = new InlineKeyboard();
    trees.forEach(t => kb.text(`🌳 ${t.name} (${t.persons_count} осіб) [${t.role}]`, `tree:${t.id}`).row());
    kb.text('➕ Створити нове дерево', 'create_tree');
    await ctx.reply('*Ваші родовідні дерева:*', { parse_mode: 'Markdown', reply_markup: kb });
  } catch {
    await ctx.reply('❌ Помилка завантаження');
  }
}

// ─── /tree (поточне) ─────────────────────────────────────────────────────────

bot.command('tree', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  const tree = fsm.getCurrentTree(ctx.from.id);
  if (!tree.id) return ctx.reply('Спочатку оберіть дерево через /trees');
  await ctx.reply(`🌳 *${tree.name}*\nОберіть дію:`,
    { parse_mode: 'Markdown', reply_markup: treeMenu(tree.id, FRONTEND) });
});

// ─── /add ────────────────────────────────────────────────────────────────────

bot.command('add', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  const tree = fsm.getCurrentTree(ctx.from.id);
  if (!tree.id) return ctx.reply('Спочатку оберіть дерево через /trees');
  await startAddPerson(ctx, tree.id);
});

async function startAddPerson(ctx, treeId) {
  fsm.setState(ctx.from.id, 'add_person:last_name', { treeId, person: {} });
  await ctx.reply(
    `➕ *Додавання нової особи*\n\nКрок 1/7: Введіть *прізвище* (або пропустіть):`,
    { parse_mode: 'Markdown', reply_markup: skipButton }
  );
}

// ─── /search ─────────────────────────────────────────────────────────────────

bot.command('search', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  const tree = fsm.getCurrentTree(ctx.from.id);
  if (!tree.id) return ctx.reply('Спочатку оберіть дерево через /trees');

  const q = ctx.match?.trim();
  if (q) return doSearch(ctx, tree.id, q);

  fsm.setState(ctx.from.id, 'search', { treeId: tree.id });
  await ctx.reply('🔍 Введіть ім\'я для пошуку:', { reply_markup: cancelButton });
});

async function doSearch(ctx, treeId, q) {
  const token = fsm.getToken(ctx.from.id);
  try {
    const results = await api.searchPersons(treeId, q, token);
    if (!results.length) return ctx.reply(`Нічого не знайдено за запитом: *${q}*`, { parse_mode: 'Markdown' });

    const kb = new InlineKeyboard();
    results.forEach(p => {
      const name = [p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені';
      const year = p.birth_date ? ` (${new Date(p.birth_date).getFullYear()})` : '';
      kb.text(`${p.is_alive ? '🟢' : '⚫️'} ${name}${year}`, `person:${treeId}:${p.id}`).row();
    });
    await ctx.reply(`🔍 Знайдено: ${results.length}`, { reply_markup: kb });
  } catch {
    await ctx.reply('❌ Помилка пошуку');
  }
}

// ─── /members ────────────────────────────────────────────────────────────────

bot.command('members', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  const tree = fsm.getCurrentTree(ctx.from.id);
  if (!tree.id) return ctx.reply('Спочатку оберіть дерево через /trees');

  const token = fsm.getToken(ctx.from.id);
  try {
    const members = await api.getMembers(tree.id, token);
    const roleIcon = { admin: '👑', editor: '✏️', viewer: '👁' };
    const text = members.map(m => {
      const name = [m.first_name, m.last_name].filter(Boolean).join(' ');
      const tg = m.username ? ` @${m.username}` : '';
      return `${roleIcon[m.role] || '👤'} ${name}${tg} — ${m.role}`;
    }).join('\n');

    await ctx.reply(`👥 *Учасники дерева "${tree.name}":*\n\n${text}`,
      { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Помилка завантаження учасників');
  }
});

// ─── /history ────────────────────────────────────────────────────────────────

bot.command('history', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  const tree = fsm.getCurrentTree(ctx.from.id);
  if (!tree.id) return ctx.reply('Спочатку оберіть дерево через /trees');

  const token = fsm.getToken(ctx.from.id);
  try {
    const history = await api.getHistory(tree.id, token);
    if (!history.length) return ctx.reply('📋 Журнал змін порожній');

    const actionIcon = { create: '➕', update: '✏️', delete: '🗑' };
    const text = history.slice(0, 15).map(h => {
      const who = h.username ? `@${h.username}` : h.first_name;
      const when = formatDate(h.created_at);
      return `${actionIcon[h.action] || '•'} ${h.entity_type} | ${who} | ${when}`;
    }).join('\n');

    await ctx.reply(`📋 *Останні зміни в "${tree.name}":*\n\n${text}`, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Помилка завантаження журналу');
  }
});

// ─── /invite ─────────────────────────────────────────────────────────────────

bot.command('invite', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  const tree = fsm.getCurrentTree(ctx.from.id);
  if (!tree.id) return ctx.reply('Спочатку оберіть дерево через /trees');

  const token = fsm.getToken(ctx.from.id);
  try {
    const { link } = await api.invite(tree.id, token);
    const botLink = `https://t.me/${ctx.me.username}?start=join_${link.split('/').pop()}`;
    await ctx.reply(
      `🔗 *Запрошення до "${tree.name}"*\n\nПосилання (діє 7 днів):\n${link}\n\nАбо через бота:\n${botLink}`,
      { parse_mode: 'Markdown' }
    );
  } catch {
    await ctx.reply('❌ Помилка генерації запрошення. Можливо, у вас недостатньо прав.');
  }
});

// ─── /settings ───────────────────────────────────────────────────────────────

bot.command('settings', async (ctx) => {
  const kb = new InlineKeyboard()
    .text('🔔 Всі сповіщення', 'notif:all').row()
    .text('🔕 Тільки важливі', 'notif:important').row()
    .text('🚫 Вимкнути сповіщення', 'notif:none');
  await ctx.reply('⚙️ *Налаштування сповіщень:*', { parse_mode: 'Markdown', reply_markup: kb });
});

// ─── Callback: JOIN ──────────────────────────────────────────────────────────

async function handleJoin(ctx) {
  // Реалізується через веб-лінк
  await ctx.reply(`🔗 Для приєднання перейдіть за посиланням:\n${FRONTEND}/join/${ctx.match}`);
}

// ─── Callback: tree list ─────────────────────────────────────────────────────

bot.callbackQuery('my_trees', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  await showTrees(ctx);
});

bot.callbackQuery('create_tree', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  fsm.setState(ctx.from.id, 'create_tree', {});
  await ctx.reply('🌳 Введіть *назву* нового дерева:', { parse_mode: 'Markdown', reply_markup: cancelButton });
});

// ─── Callback: tree:ID ───────────────────────────────────────────────────────

bot.callbackQuery(/^tree:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  const treeId = ctx.match[1];
  const token = fsm.getToken(ctx.from.id);
  try {
    const tree = await api.getTree(treeId, token);
    fsm.setCurrentTree(ctx.from.id, treeId, tree.name);
    await ctx.reply(
      `🌳 *${tree.name}*\n👥 Учасників: ${tree.members_count || '—'} | Роль: ${tree.role}\n\nОберіть дію:`,
      { parse_mode: 'Markdown', reply_markup: treeMenu(treeId, FRONTEND) }
    );
  } catch {
    await ctx.reply('❌ Дерево не знайдено');
  }
});

// ─── Callback: add_person:TREE_ID ────────────────────────────────────────────

bot.callbackQuery(/^add_person:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  await startAddPerson(ctx, ctx.match[1]);
});

// ─── Callback: person:TREE_ID:PERSON_ID ──────────────────────────────────────

bot.callbackQuery(/^person:([^:]+):([^:]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, treeId, personId] = ctx.match;
  const token = fsm.getToken(ctx.from.id);
  try {
    const p = await api.getPerson(treeId, personId, token);
    await ctx.reply(formatPerson(p) + (p.biography ? `\n\n📝 ${p.biography.slice(0, 300)}` : ''),
      { parse_mode: 'Markdown', reply_markup: personMenu(treeId, personId) });
  } catch {
    await ctx.reply('❌ Особу не знайдено');
  }
});

// ─── Callback: search:TREE_ID ────────────────────────────────────────────────

bot.callbackQuery(/^search:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  const treeId = ctx.match[1];
  fsm.setState(ctx.from.id, 'search', { treeId });
  await ctx.reply('🔍 Введіть ім\'я для пошуку:', { reply_markup: cancelButton });
});

// ─── Callback: members:TREE_ID ───────────────────────────────────────────────

bot.callbackQuery(/^members:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  const treeId = ctx.match[1];
  const token = fsm.getToken(ctx.from.id);
  try {
    const members = await api.getMembers(treeId, token);
    const roleIcon = { admin: '👑', editor: '✏️', viewer: '👁' };
    const text = members.map(m => {
      const name = [m.first_name, m.last_name].filter(Boolean).join(' ');
      const tg = m.username ? ` @${m.username}` : '';
      return `${roleIcon[m.role] || '👤'} ${name}${tg} — ${m.role}`;
    }).join('\n');
    await ctx.reply(`👥 *Учасники:*\n\n${text || 'Немає учасників'}`, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Помилка');
  }
});

// ─── Callback: history:TREE_ID ───────────────────────────────────────────────

bot.callbackQuery(/^history:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  const treeId = ctx.match[1];
  const token = fsm.getToken(ctx.from.id);
  try {
    const history = await api.getHistory(treeId, token);
    if (!history.length) return ctx.reply('📋 Журнал порожній');
    const actionIcon = { create: '➕', update: '✏️', delete: '🗑' };
    const text = history.slice(0, 10).map(h => {
      const who = h.username ? `@${h.username}` : h.first_name;
      return `${actionIcon[h.action] || '•'} ${h.entity_type} — ${who}`;
    }).join('\n');
    await ctx.reply(`📋 *Останні зміни:*\n\n${text}`, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Помилка');
  }
});

// ─── Callback: invite:TREE_ID ────────────────────────────────────────────────

bot.callbackQuery(/^invite:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!await ensureAuth(ctx)) return;
  const treeId = ctx.match[1];
  const token = fsm.getToken(ctx.from.id);
  try {
    const { link } = await api.invite(treeId, token);
    await ctx.reply(`🔗 Посилання-запрошення (7 днів):\n${link}`, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Недостатньо прав або помилка');
  }
});

// ─── Callback: edit_person ───────────────────────────────────────────────────

bot.callbackQuery(/^edit_person:([^:]+):([^:]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, treeId, personId] = ctx.match;
  fsm.setState(ctx.from.id, 'edit_person:field', { treeId, personId });
  const kb = new InlineKeyboard()
    .text('Прізвище', `edit_field:last_name`).text("Ім'я", `edit_field:first_name`).row()
    .text('По батькові', `edit_field:patronymic`).text('Дата нар.', `edit_field:birth_date`).row()
    .text('Місце нар.', `edit_field:birth_place`).text('Біографія', `edit_field:biography`).row()
    .text('❌ Скасувати', 'cancel');
  await ctx.reply('✏️ *Що редагуємо?*', { parse_mode: 'Markdown', reply_markup: kb });
});

bot.callbackQuery(/^edit_field:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const field = ctx.match[1];
  const data = fsm.getData(ctx.from.id);
  fsm.setState(ctx.from.id, `edit_person:value:${field}`, data);
  const labels = {
    last_name: 'прізвище', first_name: "ім'я", patronymic: 'по батькові',
    birth_date: 'дату народження (дд.мм.рррр)', birth_place: 'місце народження',
    biography: 'біографію',
  };
  await ctx.reply(`✏️ Введіть нове ${labels[field] || field}:`, { reply_markup: cancelButton });
});

// ─── Callback: del_person ────────────────────────────────────────────────────

bot.callbackQuery(/^del_person:([^:]+):([^:]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, treeId, personId] = ctx.match;
  fsm.setState(ctx.from.id, 'confirm_delete', { treeId, personId });
  await ctx.reply('⚠️ *Видалити цю особу?* Дія незворотна!',
    { parse_mode: 'Markdown', reply_markup: confirmMenu('confirm_delete_yes', 'cancel') });
});

bot.callbackQuery('confirm_delete_yes', async (ctx) => {
  await ctx.answerCallbackQuery();
  const { treeId, personId } = fsm.getData(ctx.from.id);
  const token = fsm.getToken(ctx.from.id);
  fsm.clearState(ctx.from.id);
  try {
    await api.deletePerson(treeId, personId, token);
    await ctx.reply('✅ Особу видалено');
  } catch {
    await ctx.reply('❌ Помилка видалення. Перевірте права доступу.');
  }
});

// ─── Callback: add_rel ───────────────────────────────────────────────────────

bot.callbackQuery(/^add_rel:([^:]+):([^:]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, treeId, personAId] = ctx.match;
  await ctx.reply('🔗 *Тип зв\'язку:*', { parse_mode: 'Markdown', reply_markup: relationTypeMenu(treeId, personAId) });
});

bot.callbackQuery(/^rel_type:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, relType, treeId, personAId] = ctx.match;
  fsm.setState(ctx.from.id, 'add_rel:search_b', { treeId, personAId, relType });
  await ctx.reply(
    `🔗 Тип: *${relTypeLabel(relType)}*\n\nВведіть ім\'я другої особи (пошук):`,
    { parse_mode: 'Markdown', reply_markup: cancelButton }
  );
});

// ─── Callback: select person B for relationship ──────────────────────────────

bot.callbackQuery(/^rel_b:([^:]+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const personBId = ctx.match[1];
  const data = fsm.getData(ctx.from.id);
  const token = fsm.getToken(ctx.from.id);
  fsm.clearState(ctx.from.id);
  try {
    await api.createRelationship(data.treeId, {
      person_a_id: data.personAId, person_b_id: personBId, relation_type: data.relType,
    }, token);
    await ctx.reply(`✅ Зв\'язок *${relTypeLabel(data.relType)}* додано!`, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('❌ Помилка додавання зв\'язку');
  }
});

// ─── Callback: notifications settings ───────────────────────────────────────

bot.callbackQuery(/^notif:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery('Налаштування збережено ✅');
  const type = ctx.match[1];
  const labels = { all: 'всі сповіщення', important: 'тільки важливі', none: 'вимкнуто' };
  await ctx.reply(`⚙️ Сповіщення: *${labels[type] || type}*`, { parse_mode: 'Markdown' });
});

// ─── Callback: cancel / skip ─────────────────────────────────────────────────

bot.callbackQuery('cancel', async (ctx) => {
  await ctx.answerCallbackQuery('Скасовано');
  fsm.clearState(ctx.from.id);
  await ctx.reply('❌ Дію скасовано', { reply_markup: mainMenu(FRONTEND) });
});

bot.callbackQuery('skip', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleTextFSM(ctx, null);
});

// ─── Обробник тексту (FSM) ───────────────────────────────────────────────────

bot.on('message:text', async (ctx) => {
  if (!await ensureAuth(ctx)) return;
  await handleTextFSM(ctx, ctx.message.text.trim());
});

async function handleTextFSM(ctx, text) {
  const userId = ctx.from?.id || ctx.callbackQuery?.from.id;
  const state = fsm.getState(userId);
  const data = fsm.getData(userId);
  const token = fsm.getToken(userId);

  if (!state) return;

  // ── Створення дерева ──────────────────────────────────────────────────────
  if (state === 'create_tree') {
    if (!text) return ctx.reply('Назва не може бути порожньою');
    fsm.clearState(userId);
    try {
      const tree = await api.createTree(text, token);
      fsm.setCurrentTree(userId, tree.id, tree.name);
      await ctx.reply(`✅ Дерево *${tree.name}* створено!\n\nТепер додайте першу особу:`,
        { parse_mode: 'Markdown', reply_markup: treeMenu(tree.id, FRONTEND) });
    } catch {
      await ctx.reply('❌ Помилка створення дерева');
    }
    return;
  }

  // ── Пошук ─────────────────────────────────────────────────────────────────
  if (state === 'search') {
    fsm.clearState(userId);
    if (!text) return ctx.reply('Введіть запит для пошуку');
    await doSearch(ctx, data.treeId, text);
    return;
  }

  // ── Пошук особи B для зв'язку ─────────────────────────────────────────────
  if (state === 'add_rel:search_b') {
    if (!text) return ctx.reply('Введіть ім\'я для пошуку');
    try {
      const results = await api.searchPersons(data.treeId, text, token);
      if (!results.length) return ctx.reply('Нікого не знайдено. Спробуйте інший запит.');
      const kb = new InlineKeyboard();
      results.slice(0, 8).forEach(p => {
        const name = [p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені';
        kb.text(name, `rel_b:${p.id}`).row();
      });
      kb.text('❌ Скасувати', 'cancel');
      await ctx.reply('Оберіть особу:', { reply_markup: kb });
    } catch {
      await ctx.reply('❌ Помилка пошуку');
    }
    return;
  }

  // ── Редагування поля особи ────────────────────────────────────────────────
  const editMatch = state.match(/^edit_person:value:(.+)$/);
  if (editMatch) {
    const field = editMatch[1];
    const { treeId, personId } = data;
    fsm.clearState(userId);
    const value = field === 'birth_date' ? parseDate(text) : text;
    try {
      await api.updatePerson(treeId, personId, { [field]: value }, token);
      await ctx.reply(`✅ Оновлено!`);
    } catch {
      await ctx.reply('❌ Помилка оновлення. Перевірте права доступу.');
    }
    return;
  }

  // ── FSM додавання особи ───────────────────────────────────────────────────
  await handleAddPersonFSM(ctx, userId, state, data, text, token);
}

// ─── FSM: додавання особи (7 кроків) ────────────────────────────────────────

const ADD_PERSON_STEPS = [
  { state: 'add_person:last_name',    field: 'last_name',    label: "ім'я",           step: 2, total: 7 },
  { state: 'add_person:first_name',   field: 'first_name',   label: 'по батькові',    step: 3, total: 7 },
  { state: 'add_person:patronymic',   field: 'patronymic',   label: 'дату народження (дд.мм.рррр або рік)', step: 4, total: 7 },
  { state: 'add_person:birth_date',   field: 'birth_date',   label: 'місце народження', step: 5, total: 7 },
  { state: 'add_person:birth_place',  field: 'birth_place',  label: 'місце проживання', step: 6, total: 7 },
  { state: 'add_person:living_place', field: 'living_place', label: 'біографію',       step: 7, total: 7 },
  { state: 'add_person:biography',    field: 'biography',    label: null },
];

async function handleAddPersonFSM(ctx, userId, state, data, text, token) {
  const stepIndex = ADD_PERSON_STEPS.findIndex(s => s.state === state);
  if (stepIndex === -1) return;

  const step = ADD_PERSON_STEPS[stepIndex];
  let value = text;

  if (step.field === 'birth_date') value = parseDate(text);

  if (value !== null && value !== undefined && value !== '') {
    data.person[step.field] = value;
  }

  // Останній крок — зберігаємо
  if (!step.label) {
    fsm.clearState(userId);
    try {
      const person = await api.createPerson(data.treeId, data.person, token);
      const name = [person.last_name, person.first_name].filter(Boolean).join(' ') || 'Без імені';
      await ctx.reply(
        `✅ *${name}* додано до дерева!\n\nЩо робимо далі?`,
        { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
          .text('🔗 Додати зв\'язок', `add_rel:${data.treeId}:${person.id}`).row()
          .text('➕ Додати ще особу', `add_person:${data.treeId}`).row()
          .text('🌳 До дерева', `tree:${data.treeId}`)
        }
      );
    } catch (err) {
      await ctx.reply(`❌ Помилка: ${err.error || 'перевірте права'}`);
    }
    return;
  }

  // Наступний крок
  const nextStep = ADD_PERSON_STEPS[stepIndex + 1];
  fsm.setState(userId, nextStep.state, data);
  await ctx.reply(
    `Крок ${nextStep.step}/${nextStep.total}: Введіть *${step.label}* (або пропустіть):`,
    { parse_mode: 'Markdown', reply_markup: skipButton }
  );
}

// ─── Запуск ──────────────────────────────────────────────────────────────────

bot.catch(err => console.error('Bot error:', err.message));
bot.start({ onStart: (info) => console.log(`Bot @${info.username} started`) });
