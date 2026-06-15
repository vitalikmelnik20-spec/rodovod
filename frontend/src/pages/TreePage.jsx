import { useEffect, useRef, useState, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background, Controls, MiniMap,
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
const TreeFlow = memo(function TreeFlow({ persons, relationships, layoutKey, theme, toggleTheme }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    buildGraphElements(persons, relationships).then(({ nodes: n, edges: e }) => {
      setNodes(n.map(node => ({
        ...node,
        style: { ...node.style, transition: 'all 0.35s ease' },
      })));
      setEdges(e);
      setTimeout(() => fitView({ padding: 0.3, duration: 500 }), 100);
    });
  }, [layoutKey]);

  const btnStyle = {
    width: 44, height: 44,
    background: 'var(--controls-bg)',
    border: '1px solid var(--controls-border)',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--controls-icon)',
    fontSize: 18,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'all 0.15s',
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
      <Controls style={{ bottom: 130, right: 12, top: 'auto' }} showInteractive={false} />
      <MiniMap
        style={{
          bottom: 130, left: 12, top: 'auto',
          background: 'var(--minimap-bg)',
          border: '1px solid var(--controls-border)',
        }}
        nodeColor={n => n.data.highlighted ? '#F59E0B' : n.data.is_alive ? 'var(--accent)' : 'var(--line-color)'}
        maskColor="var(--minimap-mask)" />

      {/* Navigation buttons — bottom right */}
      <div style={{ position: 'absolute', bottom: 80, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={toggleTheme}
          style={btnStyle}
          title={theme === 'light' ? 'Темна тема' : 'Світла тема'}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          onClick={() => fitView({ padding: 0.15, duration: 400 })}
          style={btnStyle}
          title="Показати все">
          ⊞
        </button>
      </div>
    </ReactFlow>
  );
});

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
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  // Filters: 'all' | 'alive' | 'deceased'
  const [statusFilter, setStatusFilter] = useState('all');
  const [highlightTag, setHighlightTag] = useState('');
  const socketRef = useRef(null);

  useEffect(() => { loadAll(); }, [id]);

  useEffect(() => {
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join-tree', id);
    socket.on('person:created', (p) => setPersons(prev => [...prev, p]));
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

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="text-5xl animate-pulse">🌳</div>
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
            <TreeFlow persons={filteredPersons} relationships={relationships} layoutKey={layoutKey} theme={theme} toggleTheme={toggleTheme} />
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

      {/* Full-screen add person form (5.1) */}
      {showAddModal && (
        <AddPersonModal
          treeId={id}
          allPersons={persons}
          onClose={() => setShowAddModal(false)}
          onCreated={(p) => { setPersons(prev => [...prev, p]); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}
