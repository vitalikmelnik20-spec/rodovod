import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const EVENT_ICONS = {
  birth: '👶', death: '🕯', wedding: '💍', migration: '✈️',
  military: '⚔️', education: '🎓', award: '🏅', other: '📌',
};
const EVENT_LABELS = {
  birth: 'Народження', death: 'Смерть', wedding: 'Весілля',
  migration: 'Міграція', military: 'Військова служба',
  education: 'Освіта', award: 'Нагорода', other: 'Інше',
};

function fmtDate(d) {
  if (!d) return 'Невідома дата';
  return new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildTimeline(events, persons) {
  const items = [...events.map(e => ({ ...e, _type: 'event' }))];

  persons.forEach(p => {
    if (p.birth_date) items.push({
      _type: 'person_birth', id: `pb_${p.id}`, event_date: p.birth_date,
      event_type: 'birth', title: `Народження: ${[p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені'}`,
      person_id: p.id, first_name: p.first_name, last_name: p.last_name,
    });
    if (p.death_date) items.push({
      _type: 'person_death', id: `pd_${p.id}`, event_date: p.death_date,
      event_type: 'death', title: `Смерть: ${[p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені'}`,
      person_id: p.id, first_name: p.first_name, last_name: p.last_name,
    });
  });

  return items
    .filter(i => i.event_date)
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
}

export default function TimelinePage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [persons, setPersons] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ event_type: 'other', title: '', description: '', event_date: '', person_id: '' });
  const [adding, setAdding] = useState(false);
  const [personSearch, setPersonSearch] = useState('');

  useEffect(() => { loadAll(); }, [treeId]);

  async function loadAll() {
    try {
      const [eventsRes, personsRes, treeRes] = await Promise.all([
        api.get(`/trees/${treeId}/events`),
        api.get(`/trees/${treeId}/persons`),
        api.get(`/trees/${treeId}`),
      ]);
      setEvents(eventsRes.data);
      setPersons(personsRes.data);
      setRole(treeRes.data.role);
    } catch { }
    setLoading(false);
  }

  async function addEvent() {
    if (!form.title.trim() || !form.event_type) return;
    setAdding(true);
    try {
      const res = await api.post(`/trees/${treeId}/events`, {
        event_type: form.event_type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        event_date: form.event_date || undefined,
        person_id: form.person_id || undefined,
      });
      setEvents(prev => [...prev, res.data].sort((a, b) => new Date(a.event_date || 0) - new Date(b.event_date || 0)));
      setShowAdd(false);
      setForm({ event_type: 'other', title: '', description: '', event_date: '', person_id: '' });
    } catch { }
    setAdding(false);
  }

  const timeline = buildTimeline(events, persons);
  const canEdit = role === 'admin' || role === 'editor';

  const filteredPersons = persons.filter(p =>
    [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase().includes(personSearch.toLowerCase())
  );

  let lastYear = null;

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="text-5xl animate-pulse">⏳</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur px-4 pt-10 pb-4 sticky top-0 z-10 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0">
            ‹
          </button>
          <h1 className="text-white font-bold text-lg flex-1">⏳ Таймлайн</h1>
          {canEdit && (
            <button onClick={() => setShowAdd(true)}
              className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl active:scale-90 transition-all">
              +
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-6">
        {timeline.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-3">📅</div>
            <p className="text-slate-400 font-medium">Немає подій</p>
            <p className="text-slate-600 text-sm mt-1">
              {canEdit ? 'Натисніть + щоб додати подію' : 'Адміністратор ще не додав подій'}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-700" />

            {timeline.map((item, idx) => {
              const year = item.event_date ? new Date(item.event_date).getFullYear() : null;
              const showYear = year && year !== lastYear;
              lastYear = year;
              const icon = EVENT_ICONS[item.event_type] || '📌';
              const isPersonEvent = item._type === 'person_birth' || item._type === 'person_death';

              return (
                <div key={item.id || idx}>
                  {showYear && (
                    <div className="flex items-center gap-3 mb-4 mt-2">
                      <div className="w-10 h-10 rounded-full bg-slate-600 border-2 border-slate-500 flex items-center justify-center text-slate-300 text-xs font-bold z-10 flex-shrink-0">
                        {year}
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex gap-4 mb-4 ${item.person_id ? 'cursor-pointer' : ''}`}
                    onClick={() => item.person_id && navigate(`/tree/${treeId}/person/${item.person_id}`)}>
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl z-10 flex-shrink-0 border-2 ${
                      isPersonEvent ? 'bg-slate-700 border-slate-500' : 'bg-blue-900/60 border-blue-700'
                    }`}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 rounded-2xl p-3.5 mb-1 ${
                      isPersonEvent ? 'bg-slate-800/60' : 'bg-slate-800'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm">{item.title}</p>
                          {(item.first_name || item.last_name) && !isPersonEvent && (
                            <p className="text-blue-400 text-xs mt-0.5">
                              👤 {[item.last_name, item.first_name].filter(Boolean).join(' ')}
                            </p>
                          )}
                          {item.description && (
                            <p className="text-slate-400 text-xs mt-1 leading-relaxed">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-slate-500 text-xs">{fmtDate(item.event_date)}</p>
                          <span className="text-xs text-slate-600">{EVENT_LABELS[item.event_type] || item.event_type}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add event modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="w-full bg-slate-900 rounded-t-3xl border-t border-slate-700 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="sticky top-0 bg-slate-900 px-5 pt-4 pb-3 border-b border-slate-800">
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
              <h3 className="text-white font-bold text-lg">➕ Нова подія</h3>
            </div>
            <div className="px-5 pt-4 flex flex-col gap-3">
              {/* Type */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(EVENT_ICONS).map(([key, icon]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, event_type: key }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all ${
                      form.event_type === key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                    <span>{icon}</span> <span>{EVENT_LABELS[key]}</span>
                  </button>
                ))}
              </div>

              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Назва події *" autoFocus
                className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" />

              <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" />

              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Опис (необов'язково)" rows={2}
                className="bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 resize-none text-sm" />

              {/* Person link */}
              <div>
                <p className="text-slate-400 text-xs mb-2">Прив'язати до особи (необов'язково)</p>
                <input value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                  placeholder="Пошук особи..."
                  className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-sm mb-2" />
                {personSearch && (
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                    {filteredPersons.slice(0, 8).map(p => {
                      const n = [p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені';
                      return (
                        <button key={p.id}
                          onClick={() => { setForm(f => ({ ...f, person_id: p.id })); setPersonSearch(n); }}
                          className={`text-left px-3 py-2 rounded-xl text-sm transition-all ${
                            form.person_id === p.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white active:scale-95'
                          }`}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                )}
                {form.person_id && (
                  <button onClick={() => { setForm(f => ({ ...f, person_id: '' })); setPersonSearch(''); }}
                    className="text-slate-500 text-xs mt-1">✕ Прибрати прив'язку</button>
                )}
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-semibold">
                  Скасувати
                </button>
                <button onClick={addEvent} disabled={adding || !form.title.trim()}
                  className="flex-1 bg-blue-600 disabled:opacity-50 text-white py-3.5 rounded-2xl font-semibold active:scale-95 transition-all">
                  {adding ? '...' : 'Додати'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
