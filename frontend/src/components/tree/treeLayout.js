// Простий алгоритм вертикального layout без зовнішніх залежностей
// Пращури зверху, нащадки знизу

const NODE_W = 110;
const NODE_H = 130;
const H_GAP = 30;
const V_GAP = 80;

export function buildGraphElements(persons, relationships) {
  if (!persons.length) return { nodes: [], edges: [] };

  // Будуємо граф суміжності
  const children = {}; // personId -> [childId]
  const parents = {};  // personId -> [parentId]
  const spouses = {};  // personId -> [spouseId]

  persons.forEach(p => {
    children[p.id] = [];
    parents[p.id] = [];
    spouses[p.id] = [];
  });

  relationships.forEach(r => {
    if (r.relation_type === 'parent_child') {
      children[r.person_a_id]?.push(r.person_b_id);
      parents[r.person_b_id]?.push(r.person_a_id);
    } else if (r.relation_type === 'spouse') {
      spouses[r.person_a_id]?.push(r.person_b_id);
      spouses[r.person_b_id]?.push(r.person_a_id);
    } else if (r.relation_type === 'adoption') {
      children[r.person_a_id]?.push(r.person_b_id);
      parents[r.person_b_id]?.push(r.person_a_id);
    }
  });

  // BFS по рівнях (від кореневих вузлів)
  const roots = persons.filter(p => parents[p.id].length === 0).map(p => p.id);
  const levels = {};
  const visited = new Set();
  const queue = roots.map(id => ({ id, level: 0 }));

  if (!queue.length && persons.length) queue.push({ id: persons[0].id, level: 0 });

  while (queue.length) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    levels[id] = level;
    children[id]?.forEach(cid => {
      if (!visited.has(cid)) queue.push({ id: cid, level: level + 1 });
    });
    // Не відвідані ще (острови)
    persons.forEach(p => {
      if (!visited.has(p.id)) queue.push({ id: p.id, level: 0 });
    });
  }

  // Групуємо по рівнях
  const byLevel = {};
  Object.entries(levels).forEach(([id, lvl]) => {
    byLevel[lvl] = byLevel[lvl] || [];
    byLevel[lvl].push(id);
  });

  // Позиції вузлів
  const positions = {};
  Object.entries(byLevel).forEach(([lvl, ids]) => {
    const totalW = ids.length * NODE_W + (ids.length - 1) * H_GAP;
    ids.forEach((id, i) => {
      positions[id] = {
        x: i * (NODE_W + H_GAP) - totalW / 2,
        y: parseInt(lvl) * (NODE_H + V_GAP),
      };
    });
  });

  // Вузли React Flow
  const nodes = persons.map(p => ({
    id: p.id,
    type: 'personNode',
    position: positions[p.id] || { x: 0, y: 0 },
    data: { ...p },
  }));

  // Ребра
  const edgeColors = {
    parent_child: '#3B82F6',
    spouse: '#EF4444',
    adoption: '#22C55E',
    other: '#9CA3AF',
  };

  const edges = relationships.map(r => ({
    id: r.id,
    source: r.person_a_id,
    target: r.person_b_id,
    type: r.relation_type === 'adoption' ? 'step' : 'smoothstep',
    animated: r.relation_type === 'spouse',
    style: {
      stroke: edgeColors[r.relation_type] || '#9CA3AF',
      strokeWidth: 2,
      strokeDasharray: r.relation_type === 'adoption' ? '5,5' : undefined,
    },
    markerEnd: r.relation_type !== 'spouse' ? {
      type: 'arrowclosed',
      color: edgeColors[r.relation_type],
    } : undefined,
  }));

  return { nodes, edges };
}
