import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABELS = { update: '✏️ Зміна', delete: '🗑 Видалення', create: '➕ Створення' };

export default function ProposalsPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [acting, setActing] = useState(null);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/trees/${treeId}/proposals?status=${filter}`);
      setProposals(res.data);
    } catch { }
    setLoading(false);
  }

  async function approve(propId) {
    setActing(propId);
    try {
      await api.put(`/proposals/${propId}/approve`);
      setProposals(prev => prev.filter(p => p.id !== propId));
    } catch { }
    setActing(null);
  }

  async function reject() {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      await api.put(`/proposals/${rejectId}/reject`, { note: rejectNote || null });
      setProposals(prev => prev.filter(p => p.id !== rejectId));
      setRejectId(null);
      setRejectNote('');
    } catch { }
    setActing(null);
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur px-4 pt-10 pb-4 sticky top-0 z-10 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-white text-xl">
            ‹
          </button>
          <h1 className="text-white text-lg font-bold">Пропозиції змін</h1>
        </div>
        <div className="flex gap-1 bg-slate-700/50 rounded-xl p-1">
          {[['pending', 'Очікують'], ['approved', 'Схвалені'], ['rejected', 'Відхилені']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === key ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16 text-4xl animate-pulse">📋</div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-slate-400 text-base font-medium">
              {filter === 'pending' ? 'Немає пропозицій' : 'Список порожній'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {proposals.map(p => {
              const personName = [p.person_last, p.person_first].filter(Boolean).join(' ') || 'Без імені';
              const proposerName = p.username ? `@${p.username}` : [p.first_name, p.last_name].filter(Boolean).join(' ') || '?';
              const diff = typeof p.diff === 'string' ? JSON.parse(p.diff) : p.diff;
              const changes = diff?.changes || {};

              return (
                <div key={p.id} className="bg-slate-800 rounded-2xl p-4">
                  {/* Meta */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${
                        p.action === 'delete' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'
                      }`}>
                        {ACTION_LABELS[p.action] || p.action}
                      </span>
                      <span className="text-white text-sm font-semibold">{personName}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{fmtDate(p.created_at)}</span>
                  </div>

                  <p className="text-slate-400 text-xs mb-3">від {proposerName}</p>

                  {/* Changes */}
                  {Object.keys(changes).length > 0 && (
                    <div className="bg-slate-700/50 rounded-xl p-3 mb-3 flex flex-col gap-1.5">
                      {Object.entries(changes).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="text-slate-400 w-24 flex-shrink-0">{k}:</span>
                          <span className="text-slate-500 line-through mr-1">{diff?.before?.[k] || '—'}</span>
                          <span className="text-green-400">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review note */}
                  {p.review_note && (
                    <p className="text-slate-500 text-xs italic mb-3">Причина: {p.review_note}</p>
                  )}

                  {/* Actions */}
                  {filter === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => approve(p.id)} disabled={acting === p.id}
                        className="flex-1 bg-green-700 active:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-all active:scale-95">
                        {acting === p.id ? '...' : '✅ Схвалити'}
                      </button>
                      <button onClick={() => { setRejectId(p.id); setRejectNote(''); }}
                        disabled={acting === p.id}
                        className="flex-1 bg-red-900/60 active:bg-red-800 text-red-300 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-all active:scale-95">
                        ❌ Відхилити
                      </button>
                    </div>
                  )}

                  {filter !== 'pending' && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        p.status === 'approved' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                      }`}>
                        {p.status === 'approved' ? '✅ Схвалено' : '❌ Відхилено'}
                      </span>
                      {p.reviewed_at && (
                        <span className="text-slate-500 text-xs">{fmtDate(p.reviewed_at)}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setRejectId(null)}>
          <div className="w-full bg-slate-900 rounded-t-3xl p-5 border-t border-slate-700"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-lg mb-2">Причина відхилення</h3>
            <p className="text-slate-400 text-sm mb-4">(необов'язково — буде надіслано автору)</p>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              rows={3} placeholder="Вкажіть причину..."
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-500 resize-none mb-4 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setRejectId(null)}
                className="flex-1 bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-semibold">
                Скасувати
              </button>
              <button onClick={reject} disabled={!!acting}
                className="flex-1 bg-red-700 text-white py-3.5 rounded-2xl font-semibold disabled:opacity-50 active:scale-95 transition-all">
                {acting ? '...' : '❌ Відхилити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
