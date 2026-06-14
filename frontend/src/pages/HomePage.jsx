import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function HomePage() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadTrees(); }, []);

  async function loadTrees() {
    try {
      const res = await api.get('/trees');
      setTrees(res.data);
    } catch { }
    setLoading(false);
  }

  async function createTree() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/trees', { name: newName.trim() });
      setTrees(prev => [res.data, ...prev]);
      setNewName('');
      setShowCreate(false);
      navigate(`/tree/${res.data.id}`);
    } catch { }
    setCreating(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-5xl animate-pulse">🌳</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 px-4 pt-8 pb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-slate-400 text-sm">Вітаю,</p>
            <h1 className="text-xl font-bold text-white">{user?.first_name} {user?.last_name || ''}</h1>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white">
            {user?.first_name?.[0] || '?'}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-2">
        {/* Створити дерево */}
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all mb-5 shadow-lg shadow-blue-900/40">
            <span className="text-xl">➕</span> Створити нове дерево
          </button>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-4 mb-5 border border-slate-700">
            <p className="text-white font-semibold mb-3">Назва дерева</p>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTree()}
              placeholder="Напр. Родина Ковалів..." autoFocus
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 mb-3" />
            <div className="flex gap-2">
              <button onClick={createTree} disabled={creating || !newName.trim()}
                className="flex-1 bg-blue-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all active:scale-95">
                {creating ? '...' : '✅ Створити'}
              </button>
              <button onClick={() => { setShowCreate(false); setNewName(''); }}
                className="flex-1 bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl">
                Скасувати
              </button>
            </div>
          </div>
        )}

        {/* Список дерев */}
        {trees.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🌱</div>
            <p className="text-slate-400 text-lg font-medium">Немає дерев</p>
            <p className="text-slate-600 text-sm mt-1">Створіть перше родовідне дерево</p>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-sm font-medium mb-3 uppercase tracking-wider">Мої дерева</p>
            <div className="flex flex-col gap-3">
              {trees.map(tree => (
                <button key={tree.id} onClick={() => navigate(`/tree/${tree.id}`)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left active:scale-95 transition-all hover:border-blue-500/50 hover:bg-slate-750">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-800 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      🌳
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-base truncate">{tree.name}</h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-slate-400 text-sm">👥 {tree.persons_count || 0} осіб</span>
                        <span className="text-slate-600">•</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          tree.role === 'admin' ? 'bg-yellow-900/50 text-yellow-400' :
                          tree.role === 'editor' ? 'bg-blue-900/50 text-blue-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>{tree.role}</span>
                      </div>
                    </div>
                    <span className="text-slate-600 text-lg">›</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
