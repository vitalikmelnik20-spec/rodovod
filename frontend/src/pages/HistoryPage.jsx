import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const ACTION_LABELS = { create: 'Створено', update: 'Оновлено', delete: 'Видалено' };
const ACTION_COLORS = {
  create: 'bg-green-900/50 text-green-300',
  update: 'bg-blue-900/50 text-blue-300',
  delete: 'bg-red-900/50 text-red-300',
};
const ENTITY_LABELS = { person: 'Особу', relationship: "Зв'язок", event: 'Подію', media: 'Фото' };

function formatDate(d) {
  return new Date(d).toLocaleString('uk-UA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [reverting, setReverting] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [histRes, treeRes] = await Promise.all([
          api.get(`/trees/${treeId}/history`),
          api.get(`/trees/${treeId}`),
        ]);
        setHistory(histRes.data);
        setRole(treeRes.data.role);
      } catch {}
      setLoading(false);
    }
    load();
  }, [treeId]);

  async function revert(hid) {
    setReverting(hid);
    try {
      await api.post(`/trees/${treeId}/history/${hid}/revert`);
      setHistory(h => h.map(r => r.id === hid ? { ...r, reverted_at: new Date().toISOString() } : r));
    } catch {}
    setReverting(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-slate-400">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-slate-800/80 backdrop-blur px-4 pt-10 pb-4 sticky top-0 z-10 border-b border-slate-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 text-2xl leading-none">‹</button>
        <h1 className="text-white font-bold text-lg">🕓 Історія змін</h1>
        <span className="ml-auto text-slate-500 text-sm">{history.length}</span>
      </div>

      <div className="px-4 pt-4">
        {history.length === 0 ? (
          <div className="text-center text-slate-500 py-20">
            <div className="text-5xl mb-4">📋</div>
            <p>Змін ще не було</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map(r => {
              const authorName = [r.first_name, r.last_name].filter(Boolean).join(' ')
                || r.username || `ID ${r.changed_by}`;
              const action = ACTION_LABELS[r.action_type] || r.action_type;
              const entity = ENTITY_LABELS[r.entity_type] || r.entity_type;
              const colorClass = ACTION_COLORS[r.action_type] || 'bg-slate-700 text-slate-300';

              return (
                <div
                  key={r.id}
                  className={`bg-slate-800 rounded-2xl px-4 py-3.5 transition-opacity ${r.reverted_at ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
                          {action}
                        </span>
                        <span className="text-white text-sm">{entity}</span>
                        {r.reverted_at && (
                          <span className="text-yellow-500 text-xs">↩ скасовано</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-1.5">
                        {authorName} · {formatDate(r.created_at)}
                      </p>
                    </div>

                    {role === 'admin' && !r.reverted_at && r.action_type === 'update' && (
                      <button
                        onClick={() => revert(r.id)}
                        disabled={reverting === r.id}
                        className="flex-shrink-0 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-300 rounded-xl transition-all disabled:opacity-50"
                      >
                        {reverting === r.id ? '...' : '↩'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
