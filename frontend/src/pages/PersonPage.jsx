import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

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
  const [role, setRole] = useState(null);
  const [related, setRelated] = useState([]);
  const [allPersons, setAllPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');

  // Edit/propose
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [proposeSuccess, setProposeSuccess] = useState(false);

  // Relationship modal
  const [showRelModal, setShowRelModal] = useState(false);
  const [relType, setRelType] = useState('parent_child');
  const [relSearch, setRelSearch] = useState('');
  const [addingRel, setAddingRel] = useState(false);

  // Media
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Memory board
  const [memories, setMemories] = useState([]);
  const [memText, setMemText] = useState('');
  const [addingMem, setAddingMem] = useState(false);

  useEffect(() => { loadAll(); }, [pid]);

  async function loadAll() {
    try {
      const [personRes, personsRes, relsRes, treeRes, mediaRes] = await Promise.all([
        api.get(`/trees/${treeId}/persons/${pid}`),
        api.get(`/trees/${treeId}/persons`),
        api.get(`/trees/${treeId}/relationships`),
        api.get(`/trees/${treeId}`),
        api.get(`/trees/${treeId}/persons/${pid}/media`),
      ]);
      const p = personRes.data;
      setPerson(p);
      setRole(treeRes.data.role);
      setAllPersons(personsRes.data);
      setMedia(mediaRes.data);

      if (!p.is_alive) {
        const memRes = await api.get(`/trees/${treeId}/persons/${pid}/memory`);
        setMemories(memRes.data);
      }

      const myRels = relsRes.data.filter(r => r.person_a_id === pid || r.person_b_id === pid);
      const relatedIds = myRels.map(r => r.person_a_id === pid ? r.person_b_id : r.person_a_id);
      setRelated(
        personsRes.data
          .filter(p => relatedIds.includes(p.id))
          .map(p => ({ ...p, relType: myRels.find(r => r.person_a_id === p.id || r.person_b_id === p.id)?.relation_type }))
      );
    } catch { }
    setLoading(false);
  }

  function openField(field, raw, value) {
    setEditField(field); setEditValue(raw ?? value ?? ''); setProposeSuccess(false);
  }

  async function saveField() {
    setSaving(true);
    const val = editField === 'birth_date' || editField === 'death_date' ? (editValue || null) : editValue;
    try {
      if (role === 'admin') {
        const res = await api.put(`/trees/${treeId}/persons/${pid}`, { [editField]: val });
        setPerson(res.data);
        setEditField(null);
      } else {
        await api.post(`/trees/${treeId}/persons/${pid}/propose`, { [editField]: val });
        setProposeSuccess(true);
        setTimeout(() => { setEditField(null); setProposeSuccess(false); }, 1500);
      }
    } catch { }
    setSaving(false);
  }

  async function saveBio() {
    setSaving(true);
    try {
      if (role === 'admin') {
        const res = await api.put(`/trees/${treeId}/persons/${pid}`, { biography: editValue });
        setPerson(res.data); setEditField(null);
      } else {
        await api.post(`/trees/${treeId}/persons/${pid}/propose`, { biography: editValue });
        setProposeSuccess(true);
        setTimeout(() => { setEditField(null); setProposeSuccess(false); }, 1500);
      }
    } catch { }
    setSaving(false);
  }

  async function handleDelete() {
    if (role === 'editor') {
      try { await api.post(`/trees/${treeId}/persons/${pid}/propose-delete`); navigate(`/tree/${treeId}`); } catch { }
      return;
    }
    try { await api.delete(`/trees/${treeId}/persons/${pid}`); navigate(`/tree/${treeId}`); } catch { }
  }

  async function addRelationship(targetId) {
    setAddingRel(true);
    try {
      await api.post(`/trees/${treeId}/relationships`, { person_a_id: pid, person_b_id: targetId, relation_type: relType });
      setShowRelModal(false); await loadAll();
    } catch { }
    setAddingRel(false);
  }

  async function uploadPhoto(e, isAvatar = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    if (isAvatar) form.append('is_avatar', 'true');
    try {
      const res = await api.post(`/trees/${treeId}/persons/${pid}/media`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMedia(prev => [res.data, ...prev]);
      if (isAvatar) setPerson(prev => ({ ...prev, avatar_url: res.data.url }));
    } catch { }
    setUploading(false);
    e.target.value = '';
  }

  async function setAsAvatar(mediaId, url) {
    try {
      await api.put(`/media/${mediaId}/avatar`);
      setPerson(prev => ({ ...prev, avatar_url: url }));
      setMedia(prev => prev.map(m => ({ ...m, is_avatar: m.id === mediaId })));
    } catch { }
  }

  async function addMemory() {
    if (!memText.trim()) return;
    setAddingMem(true);
    try {
      const res = await api.post(`/trees/${treeId}/persons/${pid}/memory`, { content: memText.trim() });
      setMemories(prev => [res.data, ...prev]);
      setMemText('');
    } catch { }
    setAddingMem(false);
  }

  if (loading || !person) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="text-4xl animate-pulse">👤</div>
    </div>
  );

  const name = [person.last_name, person.first_name, person.patronymic].filter(Boolean).join(' ') || 'Без імені';
  const initials = [person.first_name, person.last_name].filter(Boolean).map(s => s[0]).join('') || '?';
  const canEdit = role === 'admin' || role === 'editor';
  const isEditor = role === 'editor';
  const saveLabel = isEditor ? (saving ? '...' : '📨 Запропонувати') : (saving ? '...' : 'Зберегти');

  const filteredPersons = allPersons.filter(p =>
    p.id !== pid && [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase().includes(relSearch.toLowerCase())
  );

  const tabs = [
    ['info', 'Інфо'],
    ['family', 'Родина'],
    ['bio', 'Біографія'],
    ['media', 'Фото'],
  ];

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center overflow-hidden">
          {person.avatar_url ? (
            <img src={`${API_BASE}${person.avatar_url}`} alt="" className="h-full w-full object-cover opacity-60" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-700 flex items-center justify-center text-4xl font-bold text-white">
              {initials}
            </div>
          )}
        </div>

        <button onClick={() => navigate(-1)}
          className="absolute top-3 left-3 w-9 h-9 bg-black/40 backdrop-blur rounded-xl flex items-center justify-center text-white text-xl">
          ‹
        </button>

        {role === 'admin' && (
          <button onClick={() => navigate(`/tree/${treeId}/proposals`)}
            className="absolute top-3 right-12 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-xl text-yellow-400 text-xs font-semibold">
            📋 Пропозиції
          </button>
        )}

        {canEdit && (
          <button onClick={handleDelete}
            className="absolute top-3 right-3 w-9 h-9 bg-black/40 backdrop-blur rounded-xl flex items-center justify-center text-lg">
            {isEditor ? '📨' : '🗑'}
          </button>
        )}

        {/* Upload avatar button */}
        {canEdit && (
          <label className="absolute bottom-14 right-3 w-9 h-9 bg-black/50 backdrop-blur rounded-xl flex items-center justify-center text-lg cursor-pointer">
            📷
            <input type="file" accept="image/*" className="hidden" onChange={e => uploadPhoto(e, true)} disabled={uploading} />
          </label>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-slate-900">
          <h1 className="text-white text-xl font-bold">{name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${person.is_alive ? 'bg-green-900/60 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              {person.is_alive ? '🟢 Живий/а' : '⚫️ Помер/ла'}
            </span>
            {isEditor && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-400">редактор</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-4 mb-3 bg-slate-800 mx-4 rounded-2xl p-1">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${tab === key ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {isEditor && (
        <div className="mx-4 mb-3 px-3 py-2 bg-blue-900/30 border border-blue-800/50 rounded-xl">
          <p className="text-blue-300 text-xs">Ви редактор. Зміни потребують схвалення адміністратора.</p>
        </div>
      )}

      <div className="px-4">
        {/* Info tab */}
        {tab === 'info' && (
          <div className="flex flex-col gap-2">
            {[
              { field: 'last_name', label: 'Прізвище', value: person.last_name },
              { field: 'first_name', label: "Ім'я", value: person.first_name },
              { field: 'patronymic', label: 'По батькові', value: person.patronymic },
              { field: 'birth_date', label: 'Народження', value: fmtDate(person.birth_date), raw: person.birth_date },
              { field: 'death_date', label: 'Смерть', value: fmtDate(person.death_date), raw: person.death_date },
              { field: 'birth_place', label: 'Місце нар.', value: person.birth_place },
              { field: 'living_place', label: 'Місце прож.', value: person.living_place },
            ].map(({ field, label, value, raw }) => (
              <div key={field}
                className={`bg-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between ${canEdit ? 'cursor-pointer active:scale-[0.98] transition-all' : ''}`}
                onClick={() => canEdit && openField(field, raw, value)}>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                  <p className="text-white text-sm truncate">{value || <span className="text-slate-600">—</span>}</p>
                </div>
                {canEdit && <span className="text-slate-600 ml-2">{isEditor ? '📨' : '✏️'}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Family tab */}
        {tab === 'family' && (
          <div>
            {canEdit && (
              <button onClick={() => setShowRelModal(true)}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-2xl mb-4 active:scale-95 transition-all">
                ➕ Додати зв'язок
              </button>
            )}
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

        {/* Bio tab */}
        {tab === 'bio' && (
          <div className="flex flex-col gap-4">
            {editField === 'biography' ? (
              <div>
                <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8}
                  className="w-full bg-slate-800 text-white rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
                {proposeSuccess && <p className="text-green-400 text-sm text-center mt-2">✅ Пропозицію надіслано!</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditField(null)} className="flex-1 bg-slate-700 text-white py-3 rounded-2xl">Скасувати</button>
                  <button onClick={saveBio} disabled={saving}
                    className={`flex-1 py-3 rounded-2xl font-semibold ${isEditor ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'}`}>
                    {saving ? '...' : (isEditor ? '📨 Запропонувати' : 'Зберегти')}
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => canEdit && openField('biography', person.biography, person.biography)}
                className={`bg-slate-800 rounded-2xl p-4 min-h-28 ${canEdit ? 'cursor-pointer' : ''}`}>
                {person.biography
                  ? <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{person.biography}</p>
                  : <p className="text-slate-600 text-sm">{canEdit ? 'Натисніть щоб додати біографію...' : 'Біографія відсутня'}</p>}
              </div>
            )}

            {/* Memory board for deceased */}
            {!person.is_alive && (
              <div>
                <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-3">🕯 Дошка спогадів</h3>
                {canEdit && (
                  <div className="bg-slate-800 rounded-2xl p-3 mb-3">
                    <textarea value={memText} onChange={e => setMemText(e.target.value)} rows={3}
                      placeholder="Поділіться спогадом..."
                      className="w-full bg-slate-700 text-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm placeholder-slate-500 mb-2" />
                    <button onClick={addMemory} disabled={addingMem || !memText.trim()}
                      className="w-full bg-blue-600 disabled:opacity-40 text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all">
                      {addingMem ? '...' : 'Додати спогад'}
                    </button>
                  </div>
                )}
                {memories.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-4">Поки немає спогадів</p>
                ) : memories.map(m => {
                  const author = m.username ? `@${m.username}` : [m.first_name, m.last_name].filter(Boolean).join(' ') || '?';
                  return (
                    <div key={m.id} className="bg-slate-800 rounded-2xl p-3 mb-2">
                      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap mb-2">{m.content}</p>
                      <p className="text-slate-500 text-xs">{author} · {new Date(m.created_at).toLocaleDateString('uk-UA')}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Media tab */}
        {tab === 'media' && (
          <div>
            {canEdit && (
              <label className={`w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-600 rounded-2xl py-5 mb-4 cursor-pointer active:scale-95 transition-all ${uploading ? 'opacity-50' : 'hover:border-blue-500'}`}>
                <span className="text-2xl">{uploading ? '⏳' : '📷'}</span>
                <span className="text-slate-400 font-medium">{uploading ? 'Завантаження...' : 'Додати фото'}</span>
                <input type="file" accept="image/*,video/*" className="hidden" onChange={e => uploadPhoto(e)} disabled={uploading} />
              </label>
            )}

            {media.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-2">📷</div>
                <p className="text-slate-500 text-sm">Немає фото</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {media.map(m => (
                  <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-800">
                    {m.type === 'photo' ? (
                      <img src={`${API_BASE}${m.url}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={`${API_BASE}${m.url}`} className="w-full h-full object-cover" />
                    )}
                    {m.is_avatar && (
                      <div className="absolute top-1 left-1 bg-blue-600 rounded-full px-1.5 py-0.5 text-white text-xs font-bold">★</div>
                    )}
                    {canEdit && !m.is_avatar && m.type === 'photo' && (
                      <button onClick={() => setAsAvatar(m.id, m.url)}
                        className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                        Аватар
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Field edit modal */}
      {editField && editField !== 'biography' && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setEditField(null)}>
          <div className="w-full bg-slate-900 rounded-t-3xl p-5 border-t border-slate-700"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
            <p className="text-slate-400 text-sm mb-2">{isEditor ? 'Запропонувати зміну' : 'Редагування'}</p>
            <input value={editValue} onChange={e => setEditValue(e.target.value)}
              type={editField.includes('date') ? 'date' : 'text'} autoFocus
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 text-base mb-3" />
            {proposeSuccess && <p className="text-green-400 text-sm text-center mb-3">✅ Пропозицію надіслано!</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditField(null)} className="flex-1 bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-semibold">Скасувати</button>
              <button onClick={saveField} disabled={saving}
                className={`flex-1 py-3.5 rounded-2xl font-semibold ${isEditor ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'}`}>
                {saveLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relationship modal */}
      {showRelModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setShowRelModal(false)}>
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
