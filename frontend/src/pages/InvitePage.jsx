import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import PersonNode from '../components/tree/PersonNode';
import MarriageNode from '../components/tree/MarriageNode';
import { buildGraphElements } from '../components/tree/treeLayout';

const nodeTypes = { personNode: PersonNode, marriageNode: MarriageNode };

function TreeFlow({ persons, relationships, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    buildGraphElements(persons, relationships).then(({ nodes: n, edges: e }) => {
      setNodes(n);
      setEdges(e);
      setTimeout(() => fitView({ padding: 0.3, duration: 500 }), 100);
    });
  }, [persons.length, relationships.length]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView minZoom={0.1} maxZoom={2}
      className="bg-slate-900"
    >
      <Background color="#334155" gap={24} />
      <Controls className="bg-slate-800 border-slate-700" />
      <MiniMap className="bg-slate-800" nodeColor="#3B82F6" maskColor="rgba(15,23,42,0.7)" />
    </ReactFlow>
  );
}

function PersonModal({ person, onClose }) {
  if (!person) return null;
  const year = person.birth_date ? new Date(person.birth_date).getFullYear() : null;
  const deathYear = person.death_date ? new Date(person.death_date).getFullYear() : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-4">
          {person.avatar_url ? (
            <img src={person.avatar_url} className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-700 text-2xl font-bold text-white">
              {[person.first_name, person.last_name].filter(Boolean).map(s => s[0]).join('') || '?'}
            </div>
          )}
          <div>
            <p className="text-white font-bold text-lg">{[person.first_name, person.last_name].filter(Boolean).join(' ') || 'Без імені'}</p>
            {year && <p className="text-slate-400 text-sm">{year}{deathYear ? ` — ${deathYear}` : ''}</p>}
            <p className="text-slate-500 text-xs">{person.gender === 'male' ? 'Чоловік' : person.gender === 'female' ? 'Жінка' : ''}</p>
          </div>
        </div>
        {person.bio && <p className="text-slate-300 text-sm">{person.bio}</p>}
        <button onClick={onClose} className="mt-4 w-full bg-slate-700 text-white rounded-2xl py-2.5 text-sm font-medium">Закрити</button>
      </div>
    </div>
  );
}

export default function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Помилка мережі'))
      .finally(() => setLoading(false));
  }, [code]);

  const onNodeClick = useCallback((_, node) => {
    const person = data?.persons.find(p => p.id === node.id);
    if (person) setSelectedPerson(person);
  }, [data]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-6xl animate-pulse">🌳</div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 px-6">
      <div className="text-6xl mb-4">❌</div>
      <p className="text-white text-xl font-bold mb-2">Дерево не знайдено</p>
      <p className="text-slate-400 text-sm mb-6">{error}</p>
      <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-medium">
        На головну
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/90 border-b border-slate-700 backdrop-blur">
        <span className="text-xl">🌳</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold truncate">{data.tree.name}</p>
          <p className="text-slate-400 text-xs">{data.persons.length} осіб · перегляд</p>
        </div>
        <span className="text-slate-500 text-xs bg-slate-700 px-2 py-1 rounded-lg font-mono">{code.toUpperCase()}</span>
      </div>

      {/* Tree */}
      <div className="flex-1">
        <ReactFlowProvider>
          <TreeFlow
            persons={data.persons}
            relationships={data.relationships}
            onNodeClick={onNodeClick}
          />
        </ReactFlowProvider>
      </div>

      <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
    </div>
  );
}
