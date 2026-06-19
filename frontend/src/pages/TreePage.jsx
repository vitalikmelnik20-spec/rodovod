import { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import { io } from 'socket.io-client';
import 'reactflow/dist/style.css';
import PersonNode from '../components/tree/PersonNode';
import MarriageNode from '../components/tree/MarriageNode';
import FamilyGroupNode from '../components/tree/FamilyGroupNode';
import AddPersonModal from '../components/tree/AddPersonModal';
import { buildGraphElements } from '../components/tree/treeLayout';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

const nodeTypes = { personNode: PersonNode, marriageNode: MarriageNode, familyGroup: FamilyGroupNode };

// layoutKey triggers full graph rebuild: count + filter state + highlight
// ── Skeleton loader ──────────────────────────────────────────────────────
function SkeletonCard() {
  const s = { background: 'var(--card-border)', borderRadius: 6, animation: 'skeletonPulse 1.5s ease-in-out infinite' };
  return (
    <div style={{
      width: 160, height: 200,
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 12, padding: 16,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      animation: 'skeletonPulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', ...s }} />
      <div style={{ width: '75%', height: 14, ...s }} />
      <div style={{ width: '55%', height: 12, ...s }} />
    </div>
  );
}

function SkeletonGraph() {
  const line = { background: 'var(--card-border)', animation: 'skeletonPulse 1.5s ease-in-out infinite' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <SkeletonCard /><SkeletonCard />
      </div>
      <div style={{ display: 'flex', gap: 80 }}>
        <div style={{ width: 2, height: 40, ...line }} />
        <div style={{ width: 2, height: 40, ...line }} />
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    </div>
  );
}

const TreeFlow = memo(function TreeFlow({ persons, relationships, layoutKey, theme, toggleTheme, onAddRelative, newPersonIds }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    buildGraphElements(persons, relationships).then(({ nodes: n, edges: e }) => {
      const currentNewIds = newPersonIds.current;
      setNodes(n.map(node => ({
        ...node,
        className: currentNewIds.has(node.id) ? 'node-appear' : undefined,
        style: { ...node.style, transition: 'all 0.4s ease' },
        data: { ...node.data, onAddRelative },
      })));
      setEdges(e);
      setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);

      // Remove animation class after it completes
      if (currentNewIds.size > 0) {
        setTimeout(() => {
          setNodes(prev => prev.map(node =>
            currentNewIds.has(node.id) ? { ...node, className: undefined } : node
          ));
          currentNewIds.clear();
        }, 350);
      }
    });
  }, [layoutKey, onAddRelative]);

  const btn = {
    width: 44, height: 44,
    background: 'var(--controls-bg)',
    border: '1px solid var(--controls-border)',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--controls-icon)',
    fontSize: 18,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    transition: 'opacity 0.15s',
    userSelect: 'none',
  };

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView minZoom={0.1} maxZoom={2}
      panOnScroll={false} panOnDrag={true}
      zoomOnPinch={true} zoomOnScroll={false}
      zoomOnDoubleClick={false} preventScrolling={true}
      nodesDraggable={false} nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--bg-graph)' }}>

      <Background color="var(--graph-dot)" gap={24} size={1} />

      <MiniMap
        style={{
          bottom: 130, left: 12, top: 'auto',
          background: 'var(--minimap-bg)',
          border: '1px solid var(--controls-border)',
        }}
        nodeColor={n => n.data.highlighted ? '#F59E0B' : n.data.is_alive ? 'var(--accent)' : 'var(--line-color)'}
        maskColor="var(--minimap-mask)" />

      {/* Custom nav panel — bottom right (TZ v3 §5.2) */}
      <div style={{ position: 'absolute', bottom: 80, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={toggleTheme} style={btn} title={theme === 'light' ? 'Темна тема' : 'Світла тема'}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button onClick={() => fitView({ padding: 0.15, duration: 400 })} style={btn} title="Показати все">
          ⊞
        </button>
        <button onClick={() => zoomIn({ duration: 200 })} style={btn} title="Збільшити">
          +
        </button>
        <button onClick={() => zoomOut({ duration: 200 })} style={btn} title="Зменшити">
          −
        </button>
      </div>
    </ReactFlow>
  );
});

// Relationship options shown in the context sheet
const REL_OPTIONS = [
  { label: '👨 Батько',           relType: 'parent_child', isReversed: false, gender: 'male'   },
  { label: '👩 Мати',             relType: 'parent_child', isReversed: false, gender: 'female' },
  { label: '👶 Дитина',           relType: 'parent_child', isReversed: true,  gender: ''       },
  { label: '💍 Чоловік / Дружина', relType: 'spouse',       isReversed: false, gender: ''       },
];

export default function TreePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore(s => s.accessToken);
  const { theme, toggleTheme } = useTheme();
  const [tree, setTree] = useState(null);
  const [persons, setPersons] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalPrefill, setAddModalPrefill] = useState(null);   // { person, relType, isReversed }
  const [addRelativePersonId, setAddRelativePersonId] = useState(null); // personId for context sheet
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  // Filters: 'all' | 'alive' | 'deceased'
  const [statusFilter, setStatusFilter] = useState('all');
  const [highlightTag, setHighlightTag] = useState('');
  const socketRef = useRef(null);
  const newPersonIdsRef = useRef(new Set());

  useEffect(() => { loadAll(); }, [id]);

  useEffect(() => {
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join-tree', id);
    socket.on('person:created', (p) => {
      newPersonIdsRef.current.add(p.id);
      setPersons(prev => [...prev, p]);
    });
    socket.on('person:updated', (p) => setPersons(prev => prev.map(x => x.id === p.id ? p : x)));
    socket.on('person:deleted', ({ id: pid }) => setPersons(prev => prev.filter(x => x.id !== pid)));
    return () => { socket.emit('leave-tree', id); socket.disconnect(); };
  }, [id]);

  async function loadAll() {
    try {
      const [treeRes, personsRes, relsRes] = await Promise.all([
        api.get(`/trees/${id}`),
        api.get(`/trees/${id}/persons`),
        api.get(`/trees/${id}/relationships`),
      ]);
      setTree(treeRes.data);
      setPersons(personsRes.data);
      setRelationships(relsRes.data);
    } catch { }
    setLoading(false);
  }

  // All unique tags from all persons
  const allTags = useMemo(() => {
    const tags = new Set();
    persons.forEach(p => {
      const t = Array.isArray(p.tags) ? p.tags
        : (typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : []);
      t.forEach(tag => tags.add(tag));
    });
    return [...tags].sort();
  }, [persons]);

  // Apply filters and highlighted flag
  const filteredPersons = useMemo(() => {
    return persons
      .filter(p => statusFilter === 'all' || (statusFilter === 'alive' ? p.is_alive : !p.is_alive))
      .map(p => {
        if (!highlightTag) return p;
        const tags = Array.isArray(p.tags) ? p.tags
          : (typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : []);
        return { ...p, highlighted: tags.includes(highlightTag) };
      });
  }, [persons, statusFilter, highlightTag]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (highlightTag ? 1 : 0);

  // Stable key for TreeFlow: rebuilds layout only when necessary
  const layoutKey = `${filteredPersons.length}:${relationships.length}:${statusFilter}:${highlightTag}`;

  function resetFilters() {
    setStatusFilter('all');
    setHighlightTag('');
  }

  // «+» button callback — stable reference so nodes don't re-render
  const handleAddRelative = useCallback((personId) => {
    setAddRelativePersonId(personId);
  }, []);

  function openAddWithContext(opt) {
    const person = persons.find(p => p.id === addRelativePersonId);
    if (!person) return;
    setAddRelativePersonId(null);
    setAddModalPrefill({ person, relType: opt.relType, isReversed: opt.isReversed });
    setShowAddModal(true);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen"
      style={{ background: 'var(--bg-graph)' }}>
      <SkeletonGraph />
    </div>
  );

  return (
    <div className="relative h-screen bg-slate-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 pt-3 pb-2"
        style={{ background: 'linear-gradient(to bottom, rgba(15,23,42,0.95) 70%, transparent)' }}>
        <button onClick={() => navigate('/')}
          className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-white active:scale-90 transition-all">
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-base truncate">{tree?.name}</h1>
          <p className="text-slate-400 text-xs">
            {filteredPersons.length}{filteredPersons.length !== persons.length ? `/${persons.length}` : ''} осіб • {relationships.length} зв'язків
          </p>
        </div>
        {/* Filter button */}
        <button onClick={() => setShowFilterSheet(true)}
          className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-all ${
            activeFilterCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
          ⚙
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button onClick={() => setShowAddModal(true)}
          className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl active:scale-90 transition-all shadow-lg shadow-blue-900/50">
          +
        </button>
      </div>

      {/* Graph */}
      <div className="w-full h-full">
        {persons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-6xl mb-4">👤</div>
            <p className="text-slate-400 text-lg font-medium">Дерево порожнє</p>
            <p className="text-slate-600 text-sm mt-1 mb-6">Додайте першу особу</p>
            <button onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-all">
              ➕ Додати особу
            </button>
          </div>
        ) : filteredPersons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-slate-400 text-lg font-medium">Нікого не знайдено</p>
            <p className="text-slate-600 text-sm mt-1 mb-6">Спробуйте змінити фільтри</p>
            <button onClick={resetFilters}
              className="bg-slate-700 text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition-all">
              Скинути фільтри
            </button>
          </div>
        ) : (
          <ReactFlowProvider>
            <TreeFlow persons={filteredPersons} relationships={relationships} layoutKey={layoutKey} theme={theme} toggleTheme={toggleTheme} onAddRelative={handleAddRelative} newPersonIds={newPersonIdsRef} />
          </ReactFlowProvider>
        )}
      </div>

      {/* ── Filter bottom sheet (4.6.3) ─────────────────────────────── */}
      {showFilterSheet && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setShowFilterSheet(false)}>
          <div className="w-full bg-slate-900 rounded-t-3xl border-t border-slate-700"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            <div className="px-5 pt-4 pb-5">
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />

              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">Фільтри</h3>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="text-amber-400 text-sm font-medium active:opacity-60">
                    Скинути
                  </button>
                )}
              </div>

              {/* Status filter */}
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider">Статус</p>
              <div className="flex gap-2 mb-5">
                {[
                  { v: 'all',      label: 'Всі' },
                  { v: 'alive',    label: '🟢 Живі' },
                  { v: 'deceased', label: '⚫ Померлі' },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setStatusFilter(opt.v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      statusFilter === opt.v
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Tag highlight */}
              {allTags.length > 0 && (
                <>
                  <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider">Підсвітити по тегу</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                      <button key={tag}
                        onClick={() => setHighlightTag(t => t === tag ? '' : tag)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                          highlightTag === tag
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {allTags.length === 0 && (
                <p className="text-slate-600 text-xs">Теги не задані — додайте теги до осіб у їх профілях</p>
              )}

              <button onClick={() => setShowFilterSheet(false)}
                className="w-full mt-5 bg-blue-600 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all">
                Застосувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Context sheet: choose relationship type for «+» button ─────── */}
      {addRelativePersonId && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setAddRelativePersonId(null)}>
          <div className="w-full bg-slate-900 rounded-t-3xl border-t border-slate-700"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            <div className="px-5 pt-4 pb-5">
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
              <h3 className="text-white font-bold text-lg mb-1">Додати родича</h3>
              <p className="text-slate-400 text-xs mb-5">
                Ким є нова людина для&nbsp;
                <span className="text-white font-medium">
                  {persons.find(p => p.id === addRelativePersonId)?.first_name || 'цієї особи'}
                </span>?
              </p>
              <div className="flex flex-col gap-2">
                {REL_OPTIONS.map(opt => (
                  <button key={opt.label} onClick={() => openAddWithContext(opt)}
                    className="flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3.5 text-white text-sm font-medium active:scale-95 transition-all text-left">
                    <span className="text-xl">{opt.label.split(' ')[0]}</span>
                    <span>{opt.label.split(' ').slice(1).join(' ')}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setAddRelativePersonId(null)}
                className="w-full mt-4 text-slate-500 text-sm py-2 active:opacity-60">
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen add person form */}
      {showAddModal && (
        <AddPersonModal
          treeId={id}
          allPersons={persons}
          prefillRel={addModalPrefill}
          onClose={() => { setShowAddModal(false); setAddModalPrefill(null); }}
          onCreated={(p) => {
            newPersonIdsRef.current.add(p.id);
            setPersons(prev => [...prev, p]);
            setShowAddModal(false);
            setAddModalPrefill(null);
          }}
        />
      )}
    </div>
  );
}
