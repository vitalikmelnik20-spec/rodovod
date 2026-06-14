function formatPerson(p) {
  const name = [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');
  const born = p.birth_date ? `📅 ${formatDate(p.birth_date)}` : '';
  const died = p.death_date ? ` — ${formatDate(p.death_date)}` : '';
  const place = p.birth_place ? `\n📍 ${p.birth_place}` : '';
  const status = p.is_alive ? '🟢 Живий/а' : '⚫️ Помер/ла';
  const tg = p.username ? `\n👤 @${p.username}` : '';
  return `👤 *${name || 'Без імені'}*\n${status}${born ? `\n${born}${died}` : ''}${place}${tg}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.split(/[.\-\/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    return `${d}-${m.padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
  }
  if (parts.length === 1 && /^\d{4}$/.test(str)) return `${str}-01-01`;
  return null;
}

function relTypeLabel(type) {
  return {
    parent_child: '👨‍👩‍👧 Батько/Мати → Дитина',
    spouse: '💍 Шлюб',
    adoption: '👶 Усиновлення',
    other: '🔗 Інший',
  }[type] || type;
}

module.exports = { formatPerson, formatDate, parseDate, relTypeLabel };
