import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).getFullYear();
}

export default function SearchPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query.trim()), 350);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  async function search(q) {
    setLoading(true);
    try {
      const res = await api.get(`/trees/${treeId}/persons/search?q=${encodeURIComponent(q)}`);
      setResults(res.data);
      setSearched(true);
    } catch { }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur px-4 pt-10 pb-4 sticky top-0 z-10 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0">
            ‹
          </button>
          <h1 className="text-white font-bold text-lg">🔍 Пошук</h1>
        </div>
        <div className="relative">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ім'я, прізвище, місто, тег..."
            autoFocus
            className="w-full bg-slate-700 text-white rounded-2xl px-4 py-3.5 pl-11 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-sm"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">×</button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading && (
          <div className="flex justify-center py-12 text-3xl animate-pulse">🔍</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🤷</div>
            <p className="text-slate-400 font-medium">Нічого не знайдено</p>
            <p className="text-slate-600 text-sm mt-1">Спробуйте інший запит</p>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-slate-500 text-sm">Введіть ім'я, прізвище, місто або тег</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-3">
              Знайдено: {results.length}
            </p>
            <div className="flex flex-col gap-2">
              {results.map(p => {
                const name = [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ') || 'Без імені';
                const initials = [p.first_name, p.last_name].filter(Boolean).map(s => s[0]).join('') || '?';
                const years = [fmtDate(p.birth_date), fmtDate(p.death_date)].filter(Boolean).join(' – ');
                const tags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : []);

                return (
                  <button key={p.id}
                    onClick={() => navigate(`/tree/${treeId}/person/${p.id}`)}
                    className="flex items-center gap-3 bg-slate-800 rounded-2xl p-3.5 text-left active:scale-95 transition-all border border-transparent hover:border-blue-500/30">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${p.is_alive ? 'bg-blue-700' : 'bg-slate-600'}`}>
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {years && <span className="text-slate-400 text-xs">{years}</span>}
                        {p.birth_place && <span className="text-slate-500 text-xs truncate">📍 {p.birth_place}</span>}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-slate-600">›</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
