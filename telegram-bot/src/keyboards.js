const { InlineKeyboard } = require('grammy');

const mainMenu = (frontendUrl) => new InlineKeyboard()
  .text('🌳 Мої дерева', 'my_trees').row()
  .text('➕ Створити дерево', 'create_tree').row()
  .url('🌐 Веб-версія', frontendUrl || 'http://localhost:5173');

const treeMenu = (treeId, frontendUrl) => new InlineKeyboard()
  .text('👤 Додати особу', `add_person:${treeId}`).text('🔍 Пошук', `search:${treeId}`).row()
  .text('👥 Учасники', `members:${treeId}`).text('📋 Журнал', `history:${treeId}`).row()
  .text('🔗 Запросити', `invite:${treeId}`).row()
  .url('🌐 Відкрити граф', `${frontendUrl || 'http://localhost:5173'}/tree/${treeId}`);

const personMenu = (treeId, personId) => new InlineKeyboard()
  .text('✏️ Редагувати', `edit_person:${treeId}:${personId}`).row()
  .text('🔗 Додати зв\'язок', `add_rel:${treeId}:${personId}`).row()
  .text('🗑 Видалити', `del_person:${treeId}:${personId}`).row()
  .text('◀️ Назад до дерева', `tree:${treeId}`);

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
