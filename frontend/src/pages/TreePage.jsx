import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
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
import { buildGraphElements } from '../components/tree/treeLayout';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

const nodeTypes = { personNode: PersonNode, marriageNode: MarriageNode, familyGroup: FamilyGroupNode };

const TreeFlow = memo(function TreeFlow({ persons, relationships, onAddPerson }) {
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
  }, [persons.length, relationships.length]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView minZoom={0.1} maxZoom={2}
      // BUG-03: правильна обробка touch-подій на мобільному
      panOnScroll={false}
      panOnDrag={true}
      zoomOnPinch={true}
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      preventScrolling={true}
      // BUG-06: вимкнути непотрібні features
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      style={{ background: '#0F172A' }}>
      <Background color="#1e293b" gap={24} size={1} />
      <Controls style={{ bottom: 130, right: 12, top: 'auto' }} showInteractive={false} />
      <MiniMap
        style={{ bottom: 130, left: 12, top: 'auto', background: '#1e293b', border: '1px solid #334155' }}
        nodeColor={n => n.data.is_alive ? '#3B82F6' : '#475569'}
        maskColor="rgba(15,23,42,0.7)" />
      {/* 4.4 — кнопка "Показати все" */}
      <div style={{ position: 'absolute', bottom: 80, right: 12, zIndex: 10 }}>
        <button
          onClick={() => fitView({ padding: 0.15, duration: 400 })}
          className="w-11 h-11 bg-slate-800 border border-slate-600 rounded-xl flex items-center justify-center text-slate-300 active:scale-90 transition-all shadow-lg"
          title="Показати все"
        >
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
  const [tree, setTree] = useState(null);
  const [persons, setPersons] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', gender: '' });
  const [adding, setAdding] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => { loadAll(); }, [id]);

  useEffect(() => {
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join-tree', id);

    socket.on('person:created', (p) => setPersons(prev => [...prev, p]));
    socket.on('person:updated', (p) => setPersons(prev => prev.map(x => x.id === p.id ? p : x)));
    socket.on('person:deleted', ({ id: pid }) => setPersons(prev => prev.filter(x => x.id !== pid)));

    return () => {
      socket.emit('leave-tree', id);
      socket.disconnect();
    };
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

  async function addPerson() {
    if (!addForm.first_name && !addForm.last_name) return;
    setAdding(true);
    try {
      const res = await api.post(`/trees/${id}/persons`, addForm);
      setPersons(prev => [...prev, res.data]);
      setAddForm({ first_name: '', last_name: '', gender: '' });
      setShowAddModal(false);
    } catch { }
    setAdding(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="text-5xl animate-pulse">🌳</div>
    </div>
  );

  return (
    <div className="relative h-screen bg-slate-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-3 pt-3 pb-2"
        style={{ background: 'linear-gradient(to bottom, rgba(15,23,42,0.95) 70%, transparent)' }}>
        <button onClick={() => navigate('/')}
          className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-white active:scale-90 transition-all">
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-base truncate">{tree?.name}</h1>
          <p className="text-slate-400 text-xs">{persons.length} осіб • {relationships.length} зв'язків</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl active:scale-90 transition-all shadow-lg shadow-blue-900/50">
          +
        </button>
      </div>

      {/* Граф */}
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
        ) : (
          <ReactFlowProvider>
            <TreeFlow persons={persons} relationships={relationships} />
          </ReactFlowProvider>
        )}
      </div>

      {/* Модалка додавання */}
      {showAddModal && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/60" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="w-full bg-slate-900 rounded-t-3xl p-5 border-t border-slate-700"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-lg mb-4">➕ Нова особа</h3>
            <div className="flex flex-col gap-3 mb-4">
              <input value={addForm.last_name} onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Прізвище" autoFocus
                className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base" />
              <input value={addForm.first_name} onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="Ім'я"
                className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base" />
              <div className="flex gap-2">
                {[{ v: 'male', label: '♂ Чоловік' }, { v: 'female', label: '♀ Жінка' }, { v: '', label: '— Не вказано' }].map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => setAddForm(f => ({ ...f, gender: opt.v }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      addForm.gender === opt.v
                        ? opt.v === 'male' ? 'bg-blue-600 text-white' : opt.v === 'female' ? 'bg-pink-600 text-white' : 'bg-slate-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 bg-slate-800 text-slate-300 font-semibold py-3.5 rounded-2xl">
                Скасувати
              </button>
              <button onClick={addPerson} disabled={adding || (!addForm.first_name && !addForm.last_name)}
                className="flex-1 bg-blue-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl active:scale-95 transition-all">
                {adding ? '...' : 'Додати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
