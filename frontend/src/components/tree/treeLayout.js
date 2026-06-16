import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

const NODE_W = 160;
const NODE_H = 200;
const GROUP_PAD = 28;
const LABEL_H = 24;

const GROUP_COLORS = [
  { border: '#3B82F6', bg: 'rgba(59,130,246,0.05)' },
  { border: '#8B5CF6', bg: 'rgba(139,92,246,0.05)' },
  { border: '#10B981', bg: 'rgba(16,185,129,0.05)' },
  { border: '#F59E0B', bg: 'rgba(245,158,11,0.05)' },
  { border: '#EF4444', bg: 'rgba(239,68,68,0.05)' },
  { border: '#06B6D4', bg: 'rgba(6,182,212,0.05)' },
];

// USER_DEFINED layering lets us force nodes onto specific layers.
// Persons occupy even layers (0, 2, 4, …); marriage nodes occupy the
// odd layer immediately below their spouses (1, 3, 5, …).
const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.layering.strategy': 'USER_DEFINED',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.spacing.nodeNode': '80',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
};

function spouseKey(a, b) {
  return [a, b].sort().join('__');
}

// Compute ELK layer IDs for persons using even numbers (0, 2, 4, …)
// so marriage connector nodes can sit on the odd layer in between.
// Algorithm:
//  1. Topological sort of parent→child edges to assign initial layers.
//  2. Spouse alignment: both spouses get the same (max) layer.
//  3. Re-propagate children layers after spouse adjustment.
function computePersonLayers(persons, parentChildRels, spouseRels, personIds) {
  const parentsOf = {};
  const childrenOf = {};
  parentChildRels.forEach(r => {
    if (!personIds.has(r.person_a_id) || !personIds.has(r.person_b_id)) return;
    (parentsOf[r.person_b_id] = parentsOf[r.person_b_id] || []).push(r.person_a_id);
    (childrenOf[r.person_a_id] = childrenOf[r.person_a_id] || []).push(r.person_b_id);
  });

  // Kahn's topological sort
  const inDeg = {};
  persons.forEach(p => { inDeg[p.id] = (parentsOf[p.id] || []).length; });
  const topo = [];
  const q = persons.filter(p => inDeg[p.id] === 0).map(p => p.id);
  while (q.length) {
    const id = q.shift();
    topo.push(id);
    (childrenOf[id] || []).forEach(cid => {
      if (--inDeg[cid] === 0) q.push(cid);
    });
  }
  // Catch any cycles (just append remaining)
  persons.forEach(p => { if (!topo.includes(p.id)) topo.push(p.id); });

  // Assign layers; children are 2 levels below their deepest parent
  // (the gap is reserved for the marriage connector node).
  const layer = {};
  const assignLayers = () => {
    topo.forEach(id => {
      const pLayers = (parentsOf[id] || []).map(pid => layer[pid] ?? 0);
      layer[id] = pLayers.length ? Math.max(...pLayers) + 2 : (layer[id] ?? 0);
    });
  };
  assignLayers();

  // Align spouses to the same (max) layer and re-propagate until stable
  let changed = true;
  while (changed) {
    changed = false;
    spouseRels.forEach(r => {
      if (!personIds.has(r.person_a_id) || !personIds.has(r.person_b_id)) return;
      const la = layer[r.person_a_id] ?? 0;
      const lb = layer[r.person_b_id] ?? 0;
      const maxL = Math.max(la, lb);
      if (la < maxL) { layer[r.person_a_id] = maxL; changed = true; }
      if (lb < maxL) { layer[r.person_b_id] = maxL; changed = true; }
    });
    if (changed) assignLayers();
  }

  return layer;
}

function detectFamilyGroups(persons, parentChildRels, spouseRels, personIds) {
  const childrenOf = {};
  parentChildRels.forEach(r => {
    if (!childrenOf[r.person_a_id]) childrenOf[r.person_a_id] = [];
    childrenOf[r.person_a_id].push(r.person_b_id);
  });

  const hasParent = new Set(
    parentChildRels.map(r => r.person_b_id).filter(id => personIds.has(id))
  );

  const roots = persons.filter(p => !hasParent.has(p.id));
  if (roots.length === 0) return [];

  const spouseOf = {};
  spouseRels.forEach(r => {
    (spouseOf[r.person_a_id] = spouseOf[r.person_a_id] || []).push(r.person_b_id);
    (spouseOf[r.person_b_id] = spouseOf[r.person_b_id] || []).push(r.person_a_id);
  });

  const rootGroups = [];
  const assignedRoots = new Set();
  roots.forEach(root => {
    if (assignedRoots.has(root.id)) return;
    assignedRoots.add(root.id);
    const group = [root.id];
    (spouseOf[root.id] || []).forEach(sid => {
      if (roots.some(r => r.id === sid) && !assignedRoots.has(sid)) {
        assignedRoots.add(sid);
        group.push(sid);
      }
    });
    rootGroups.push(group);
  });

  const personToGroup = {};
  return rootGroups.map((rootIds, i) => {
    const members = new Set(rootIds);
    const queue = [...rootIds];
    rootIds.forEach(id => { personToGroup[id] = i; });

    while (queue.length) {
      const pid = queue.shift();
      (childrenOf[pid] || []).forEach(childId => {
        if (!members.has(childId) && personIds.has(childId)) {
          members.add(childId);
          if (personToGroup[childId] === undefined) personToGroup[childId] = i;
          queue.push(childId);
        }
      });
    }

    const rootPersons = persons.filter(p => rootIds.includes(p.id));
    const label = rootPersons.find(p => p.last_name)?.last_name
      || rootPersons[0]?.first_name
      || 'Родина';

    return { id: `family_group_${i}`, members: [...members], label, colorIndex: i };
  });
}

export async function buildGraphElements(persons, relationships) {
  if (!persons.length) return { nodes: [], edges: [] };

  const personIds = new Set(persons.map(p => p.id));

  const spouseRels      = relationships.filter(r => r.relation_type === 'spouse' && personIds.has(r.person_a_id) && personIds.has(r.person_b_id));
  const parentChildRels = relationships.filter(r => (r.relation_type === 'parent_child' || r.relation_type === 'adoption') && personIds.has(r.person_a_id) && personIds.has(r.person_b_id));
  const siblingRels     = relationships.filter(r => r.relation_type === 'sibling' && personIds.has(r.person_a_id) && personIds.has(r.person_b_id));
  const otherRels       = relationships.filter(r => r.relation_type === 'other' && personIds.has(r.person_a_id) && personIds.has(r.person_b_id));

  // ── Pre-compute layer IDs ───────────────────────────────────────────────
  const personLayer = computePersonLayers(persons, parentChildRels, spouseRels, personIds);

  // ── Marriage nodes ──────────────────────────────────────────────────────
  const spousePairToMarriage = {};
  const marriageDefs = [];

  spouseRels.forEach(rel => {
    const key = spouseKey(rel.person_a_id, rel.person_b_id);
    if (!spousePairToMarriage[key]) {
      const mId = `marriage_${rel.id}`;
      spousePairToMarriage[key] = mId;
      marriageDefs.push({ id: mId, personA: rel.person_a_id, personB: rel.person_b_id });
    }
  });

  // ── Child → parents map ─────────────────────────────────────────────────
  const childParents = {};
  parentChildRels.forEach(r => {
    childParents[r.person_b_id] = childParents[r.person_b_id] || [];
    if (!childParents[r.person_b_id].includes(r.person_a_id)) {
      childParents[r.person_b_id].push(r.person_a_id);
    }
  });

  // ── Parent→child ELK edges (route via marriage node if possible) ────────
  const pcEdges = [];
  const routedViaMarriage = new Set();

  parentChildRels.forEach(rel => {
    const parentId = rel.person_a_id;
    const childId  = rel.person_b_id;
    const coParents = (childParents[childId] || []).filter(p => p !== parentId);

    let routed = false;
    for (const coParent of coParents) {
      const mId = spousePairToMarriage[spouseKey(parentId, coParent)];
      if (mId) {
        const mk = `${mId}__${childId}`;
        if (!routedViaMarriage.has(mk)) {
          routedViaMarriage.add(mk);
          pcEdges.push({ id: `pc_${mId}_${childId}`, source: mId, target: childId, relType: rel.relation_type });
        }
        routed = true;
        break;
      }
    }
    if (!routed) {
      pcEdges.push({ id: `pc_${rel.id}`, source: parentId, target: childId, relType: rel.relation_type });
    }
  });

  // ── Build ELK graph ─────────────────────────────────────────────────────
  const elkGraph = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: [
      ...persons.map(p => ({
        id: p.id,
        width: NODE_W,
        height: NODE_H,
        properties: { 'elk.layered.layering.layerId': personLayer[p.id] ?? 0 },
      })),
      ...marriageDefs.map(m => ({
        id: m.id,
        width: 1,
        height: 1,
        // Marriage connector sits one layer below its spouses
        properties: { 'elk.layered.layering.layerId': (personLayer[m.personA] ?? 0) + 1 },
      })),
    ],
    edges: [
      ...marriageDefs.flatMap(m => ([
        { id: `ms_${m.id}_a`, sources: [m.personA], targets: [m.id] },
        { id: `ms_${m.id}_b`, sources: [m.personB], targets: [m.id] },
      ])),
      ...pcEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    ],
  };

  // ── Run ELK layout ──────────────────────────────────────────────────────
  const positions = {};
  try {
    const layouted = await elk.layout(elkGraph);
    layouted.children.forEach(n => {
      positions[n.id] = { x: n.x ?? 0, y: n.y ?? 0 };
    });
  } catch (err) {
    console.warn('[treeLayout] ELK failed, using grid fallback:', err.message);
    persons.forEach((p, i) => {
      positions[p.id] = { x: (i % 5) * 150, y: Math.floor(i / 5) * 180 };
    });
    marriageDefs.forEach(m => {
      const a = positions[m.personA] || { x: 0, y: 0 };
      const b = positions[m.personB] || { x: 0, y: 0 };
      positions[m.id] = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 60 };
    });
  }

  // ── Family group background nodes ───────────────────────────────────────
  const familyGroups = detectFamilyGroups(persons, parentChildRels, spouseRels, personIds);

  const groupNodes = familyGroups.length >= 2
    ? familyGroups.map(g => {
        const memberPos = g.members.map(id => positions[id]).filter(Boolean);
        if (!memberPos.length) return null;

        const minX = Math.min(...memberPos.map(p => p.x));
        const minY = Math.min(...memberPos.map(p => p.y));
        const maxX = Math.max(...memberPos.map(p => p.x));
        const maxY = Math.max(...memberPos.map(p => p.y));

        const color = GROUP_COLORS[g.colorIndex % GROUP_COLORS.length];
        return {
          id: g.id,
          type: 'familyGroup',
          position: { x: minX - GROUP_PAD, y: minY - GROUP_PAD - LABEL_H },
          style: {
            width: maxX - minX + NODE_W + GROUP_PAD * 2,
            height: maxY - minY + NODE_H + GROUP_PAD * 2 + LABEL_H,
          },
          data: { label: g.label, color: color.border, bg: color.bg },
          zIndex: -1,
          selectable: false,
          draggable: false,
        };
      }).filter(Boolean)
    : [];

  // ── React Flow nodes ────────────────────────────────────────────────────
  const nodes = [
    ...groupNodes,
    ...persons.map(p => ({
      id: p.id,
      type: 'personNode',
      position: positions[p.id] || { x: 0, y: 0 },
      data: { ...p },
    })),
    ...marriageDefs.map(m => ({
      id: m.id,
      type: 'marriageNode',
      position: positions[m.id] || { x: 0, y: 0 },
      data: {},
      style: { width: 1, height: 1 },
    })),
  ];

  // ── React Flow edges ────────────────────────────────────────────────────
  const edges = [];

  marriageDefs.forEach(m => {
    edges.push(
      { id: `rfe_${m.id}_a`, source: m.personA, target: m.id, type: 'smoothstep', style: { stroke: '#EF4444', strokeWidth: 2 } },
      { id: `rfe_${m.id}_b`, source: m.personB, target: m.id, type: 'smoothstep', style: { stroke: '#EF4444', strokeWidth: 2 } },
    );
  });

  pcEdges.forEach(e => {
    const isAdoption = e.relType === 'adoption';
    edges.push({
      id: `rfe_${e.id}`,
      source: e.source,
      target: e.target,
      type: isAdoption ? 'step' : 'smoothstep',
      style: {
        stroke: isAdoption ? '#22C55E' : '#3B82F6',
        strokeWidth: 2,
        strokeDasharray: isAdoption ? '5,5' : undefined,
      },
      markerEnd: { type: 'arrowclosed', color: isAdoption ? '#22C55E' : '#3B82F6' },
    });
  });

  siblingRels.forEach(r => {
    const posA = positions[r.person_a_id];
    const posB = positions[r.person_b_id];
    const aIsLeft = !posA || !posB || posA.x <= posB.x;
    edges.push({
      id: r.id,
      source: r.person_a_id,
      target: r.person_b_id,
      sourceHandle: aIsLeft ? 'right' : 'left',
      targetHandle: aIsLeft ? 'left' : 'right',
      type: 'smoothstep',
      style: { stroke: '#A855F7', strokeWidth: 2 },
    });
  });

  otherRels.forEach(r => {
    edges.push({
      id: r.id,
      source: r.person_a_id,
      target: r.person_b_id,
      type: 'smoothstep',
      style: { stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '3,3' },
    });
  });

  return { nodes, edges };
}
