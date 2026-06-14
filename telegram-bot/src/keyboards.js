const { InlineKeyboard } = require('grammy');

// web_app відкриває Mini App прямо в Telegram
const webApp = (label, url) => ({ text: label, web_app: { url } });

const mainMenu = (frontendUrl) => {
  const url = frontendUrl || 'http://localhost:5173';
  return new InlineKeyboard()
    .add(webApp('🌳 Відкрити додаток', url)).row()
    .text('📋 Мої дерева', 'my_trees').row()
    .text('➕ Створити дерево', 'create_tree');
};

const treeMenu = (treeId, frontendUrl) => {
  const url = frontendUrl || 'http://localhost:5173';
  return new InlineKeyboard()
    .add(webApp('🌳 Відкрити дерево', `${url}/tree/${treeId}`)).row()
    .text('👤 Додати особу', `add_person:${treeId}`).text('🔍 Пошук', `search:${treeId}`).row()
    .text('👥 Учасники', `members:${treeId}`).text('📋 Журнал', `history:${treeId}`).row()
    .text('🔗 Запросити', `invite:${treeId}`);
};

const personMenu = (treeId, personId, frontendUrl) => {
  const url = frontendUrl || 'http://localhost:5173';
  return new InlineKeyboard()
    .add(webApp('👤 Відкрити профіль', `${url}/tree/${treeId}/person/${personId}`)).row()
    .text('✏️ Редагувати', `edit_person:${treeId}:${personId}`).row()
    .text('🔗 Додати зв\'язок', `add_rel:${treeId}:${personId}`).row()
    .text('🗑 Видалити', `del_person:${treeId}:${personId}`).row()
    .text('◀️ Назад до дерева', `tree:${treeId}`);
};

const relationTypeMenu = (treeId, personAId) => new InlineKeyboard()
  .text('👨‍👩‍👧 Батько/Мати → Дитина', `rel_type:parent_child:${treeId}:${personAId}`).row()
  .text('💍 Чоловік/Дружина', `rel_type:spouse:${treeId}:${personAId}`).row()
  .text('👶 Усиновлення', `rel_type:adoption:${treeId}:${personAId}`).row()
  .text('🔗 Інший зв\'язок', `rel_type:other:${treeId}:${personAId}`);

const confirmMenu = (yesCallback, noCallback) => new InlineKeyboard()
  .text('✅ Так', yesCallback).text('❌ Ні', noCallback);

const skipButton = new InlineKeyboard().text('⏭ Пропустити', 'skip');
const cancelButton = new InlineKeyboard().text('❌ Скасувати', 'cancel');

module.exports = { mainMenu, treeMenu, personMenu, relationTypeMenu, confirmMenu, skipButton, cancelButton };
