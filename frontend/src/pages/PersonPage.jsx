import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const REL_LABELS = {
  parent_child: '👨‍👩‍👧 Батько/Мати', spouse: '💍 Чоловік/Дружина',
  adoption: '👶 Усиновлення', other: '🔗 Інший',
};
const REL_COLORS = {
  parent_child: 'bg-blue-900/40 text-blue-300', spouse: 'bg-red-900/40 text-red-300',
  adoption: 'bg-green-900/40 text-green-300', other: 'bg-slate-700 text-slate-400',
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PersonPage() {
  const { id: treeId, pid } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [related, setRelated] = useState([]);
  const [allPersons, setAllPersons] = useState([]);
  const [rels, setRels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRelModal, setShowRelModal] = useState(false);
  const [relType, setRelType] = useState('parent_child');
  const [relSearch, setRelSearch] = useState('');
  const [addingRel, setAddingRel] = useState(false);

  useEffect(() => { loadAll(); }, [pid]);

  async function loadAll() {
    try {
      const [personRes, personsRes, relsRes] = await Promise.all([
        api.get(`/trees/${treeId}/persons/${pid}`),
        api.get(`/trees/${treeId}/persons`),
        api.get(`/trees/${treeId}/relationships`),
      ]);
      setPerson(personRes.data);
      setAllPersons(personsRes.data);
      setRels(relsRes.data);

      const myRels = relsRes.data.filter(r => r.person_a_id === pid || r.person_b_id === pid);
      const relatedIds = myRels.map(r => r.person_a_id === pid ? r.person_b_id : r.person_a_id);
      const relatedPersons = personsRes.data
        .filter(p => relatedIds.includes(p.id))
        .map(p => ({ ...p, relType: myRels.find(r => r.person_a_id === p.id || r.person_b_id === p.id)?.relation_type }));
      setRelated(relatedPersons);
    } catch { }
    setLoading(false);
  }

  async function saveField() {
    setSaving(true);
    try {
      const val = editField === 'birth_date' || editField === 'death_date'
        ? (editValue || null) : editValue;
      const res = await api.put(`/trees/${treeId}/persons/${pid}`, { [editField]: val });
      setPerson(res.data);
      setEditField(null);
    } catch { }
    setSaving(false);
  }

  async function addRelationship(targetId) {
    setAddingRel(true);
    try {
      await api.post(`/trees/${treeId}/relationships`, {
        person_a_id: pid, person_b_id: targetId, relation_type: relType,
      });
      setShowRelModal(false);
      await loadAll();
    } catch { }
    setAddingRel(false);
  }

  async function deletePerson() {
    if (!window.confirm?.('Видалити цю особу?')) {
      try {
        await api.delete(`/trees/${treeId}/persons/${pid}`);
        navigate(`/tree/${treeId}`);
      } catch { }
      return;
    }
    try {
      await api.delete(`/trees/${treeId}/persons/${pid}`);
      navigate(`/tree/${treeId}`);
    } catch { }
  }

  if (loading || !person) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="text-4xl animate-pulse">👤</div>
    </div>
  );

  const name = [person.last_name, person.first_name, person.patronymic].filter(Boolean).join(' ') || 'Без імені';
  const initials = [person.first_name, person.last_name].filter(Boolean).map(s => s[0]).join('') || '?';

  const filteredPersons = allPersons.filter(p =>
    p.id !== pid &&
    [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase().includes(relSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header з фото */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center">
          {person.avatar_url ? (
            <img src={person.avatar_url} alt="" className="h-full w-full object-cover opacity-60" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-700 flex items-center justify-center text-4xl font-bold text-white">
              {initials}
            </div>
          )}
        </div>

        {/* Back button */}
        <button onClick={() => navigate(-1)}
          className="absolute top-3 left-3 w-9 h-9 bg-black/40 backdrop-blur rounded-xl flex items-center justify-center text-white">
          ‹
        </button>

        {/* Delete button */}
        <button onClick={deletePerson}
          className="absolute top-3 right-3 w-9 h-9 bg-black/40 backdrop-blur rounded-xl flex items-center justify-center text-lg">
          🗑
        </button>

        {/* Ім'я */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-slate-900">
          <h1 className="text-white text-xl font-bold">{name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${person.is_alive ? 'bg-green-900/60 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              {person.is_alive ? '🟢 Живий/а' : '⚫️ Помер/ла'}
            </span>
          </div>
        </div>
      </div>

      {/* Таби */}
      <div className="flex gap-1 px-4 mt-4 mb-4 bg-slate-800 mx-4 rounded-2xl p-1">
        {[['info', 'Інфо'], ['family', 'Родина'], ['bio', 'Біографія']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${tab === key ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-4">
        {/* Таб Інфо */}
        {tab === 'info' && (
          <div className="flex flex-col gap-2">
            {[
              { field: 'last_name', label: 'Прізвище', value: person.last_name },
              { field: 'first_name', label: "Ім'я", value: person.first_name },
              { field: 'patronymic', label: 'По батькові', value: person.patronymic },
              { field: 'birth_date', label: 'Народження', value: fmtDate(person.birth_date), raw: person.birth_date, type: 'date' },
              { field: 'death_date', label: 'Смерть', value: fmtDate(person.death_date), raw: person.death_date, type: 'date' },
              { field: 'birth_place', label: 'Місце нар.', value: person.birth_place },
              { field: 'living_place', label: 'Місце прож.', value: person.living_place },
            ].map(({ field, label, value, raw, type }) => (
              <div key={field} className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between"
                onClick={() => { setEditField(field); setEditValue(raw || value || ''); }}>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                  <p className="text-white text-sm truncate">{value || <span className="text-slate-600">—</span>}</p>
                </div>
                <span className="text-slate-600 ml-2">✏️</span>
              </div>
            ))}
          </div>
        )}

        {/* Таб Родина */}
        {tab === 'family' && (
          <div>
            <button onClick={() => setShowRelModal(true)}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-2xl mb-4 active:scale-95 transition-all">
              ➕ Додати зв'язок
            </button>
            {related.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Немає зв'язків</div>
            ) : related.map(p => {
              const n = [p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені';
              return (
                <div key={p.id} onClick={() => navigate(`/tree/${treeId}/person/${p.id}`)}
                  className="flex items-center gap-3 bg-slate-800 rounded-2xl p-3 mb-2 active:scale-95 transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {[p.first_name, p.last_name].filter(Boolean).map(s => s[0]).join('') || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{n}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${REL_COLORS[p.relType] || 'bg-slate-700 text-slate-400'}`}>
                      {REL_LABELS[p.relType] || p.relType}
                    </span>
                  </div>
                  <span className="text-slate-600">›</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Таб Біографія */}
        {tab === 'bio' && (
          <div>
            {editField === 'biography' ? (
              <div>
                <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8}
                  className="w-full bg-slate-800 text-white rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditField(null)} className="flex-1 bg-slate-700 text-white py-3 rounded-2xl">Скасувати</button>
                  <button onClick={saveField} disabled={saving} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl">Зберегти</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setEditField('biography'); setEditValue(person.biography || ''); }}
                className="bg-slate-800 rounded-2xl p-4 min-h-32 cursor-pointer">
                {person.biography
                  ? <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{person.biography}</p>
                  : <p className="text-slate-600 text-sm">Натисніть щоб додати біографію...</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модалка редагування поля */}
      {editField && editField !== 'biography' && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={e => e.target === e.currentTarget && setEditField(null)}>
          <div className="w-full bg-slate-900 rounded-t-3xl p-5 border-t border-slate-700"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
            <p className="text-slate-400 text-sm mb-2">Редагування</p>
            <input value={editValue} onChange={e => setEditValue(e.target.value)}
              type={editField.includes('date') ? 'date' : 'text'} autoFocus
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 text-base mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setEditField(null)} className="flex-1 bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-semibold">Скасувати</button>
              <button onClick={saveField} disabled={saving} className="flex-1 bg-blue-600 text-white py-3.5 rounded-2xl font-semibold">
                {saving ? '...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка зв'язку */}
      {showRelModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={e => e.target === e.currentTarget && setShowRelModal(false)}>
          <div className="w-full bg-slate-900 rounded-t-3xl p-5 border-t border-slate-700 max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-lg mb-4">Тип зв'язку</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(REL_LABELS).map(([key, label]) => (
                <button key={key} onClick={() => setRelType(key)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${relType === key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {label}
                </button>
              ))}
            </div>
            <input value={relSearch} onChange={e => setRelSearch(e.target.value)}
              placeholder="Пошук особи..." autoFocus
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 mb-3" />
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {filteredPersons.slice(0, 20).map(p => {
                const n = [p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені';
                return (
                  <button key={p.id} onClick={() => addRelationship(p.id)} disabled={addingRel}
                    className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 text-left active:scale-95 transition-all">
                    <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {[p.first_name, p.last_name].filter(Boolean).map(s => s[0]).join('') || '?'}
                    </div>
                    <span className="text-white text-sm font-medium">{n}</span>
                  </button>
                );
              })}
              {filteredPersons.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Нікого не знайдено</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
