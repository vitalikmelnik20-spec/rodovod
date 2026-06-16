import { useState, useRef } from 'react';
import api from '../../services/api';

const REL_TYPES = [
  { key: 'parent_child', label: '👨‍👩‍👧 Батько/Мати (ця особа — дитина)' },
  { key: 'spouse',       label: '💍 Чоловік/Дружина' },
  { key: 'sibling',      label: '👫 Брат/Сестра' },
  { key: 'adoption',     label: '👶 Усиновлення' },
  { key: 'other',        label: '🔗 Інший' },
];

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height, 800);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// prefillRel: { person, relType, isReversed? }
// isReversed=true means the existing person is person_a (parent/source),
// and the new person becomes person_b (child/target) in the relationship.
export default function AddPersonModal({ treeId, allPersons, onClose, onCreated, prefillRel }) {
  const [form, setForm] = useState({
    last_name: '', first_name: '', patronymic: '',
    gender: '', is_alive: true,
    birth_date: '', death_date: '',
    birth_place: '', living_place: '',
    biography: '',
  });
  const [photo, setPhoto] = useState(null);
  const [rels, setRels] = useState(() =>
    prefillRel ? [prefillRel] : []
  );
  const [showRelPicker, setShowRelPicker] = useState(false);
  const [relSearch, setRelSearch] = useState('');
  const [pickedPerson, setPickedPerson] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef(null);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  const setVal = (field, val) => setForm(f => ({ ...f, [field]: val }));

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const blob = await compressImage(file);
    if (blob) setPhoto({ preview: URL.createObjectURL(blob), blob });
    e.target.value = '';
  }

  async function handleSave() {
    if (!form.first_name && !form.last_name) { setError("Введіть ім'я або прізвище"); return; }
    setSaving(true);
    setError('');
    try {
      const personRes = await api.post(`/trees/${treeId}/persons`, {
        ...form,
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
        gender: form.gender || null,
      });
      const { id: pid } = personRes.data;

      if (photo?.blob) {
        const fd = new FormData();
        fd.append('file', photo.blob, 'avatar.jpg');
        fd.append('is_avatar', 'true');
        await api.post(`/trees/${treeId}/persons/${pid}/media`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      for (const rel of rels) {
        await api.post(`/trees/${treeId}/relationships`, {
          person_a_id: rel.isReversed ? rel.person.id : pid,
          person_b_id: rel.isReversed ? pid : rel.person.id,
          relation_type: rel.relType,
        });
      }

      onCreated(personRes.data);
    } catch {
      setError('Помилка збереження. Спробуйте ще раз.');
    }
    setSaving(false);
  }

  function openRelPicker() {
    setPickedPerson(null);
    setRelSearch('');
    setShowRelPicker(true);
  }

  function addRel(person, relType) {
    setRels(prev => prev.some(r => r.person.id === person.id) ? prev : [...prev, { person, relType }]);
    setPickedPerson(null);
    setShowRelPicker(false);
  }

  const canSave = !!(form.first_name || form.last_name);
  const filteredPersons = allPersons.filter(p =>
    [p.first_name, p.last_name].filter(Boolean).join(' ')
      .toLowerCase().includes(relSearch.toLowerCase())
  );

  return (
    <div className="form-fullscreen">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 border-b border-slate-800 flex-shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 12 }}>
        <button onClick={onClose}
          className="text-slate-400 text-sm font-medium active:opacity-60 transition-opacity min-w-[72px]">
          Скасувати
        </button>
        <h2 className="flex-1 text-center text-white font-bold text-base">Нова особа</h2>
        <button onClick={handleSave} disabled={!canSave || saving}
          className="text-blue-400 font-semibold text-sm disabled:opacity-30 active:opacity-60 transition-opacity min-w-[72px] text-right">
          {saving ? '...' : 'Додати'}
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="form-body">

        {/* Photo */}
        <div className="flex justify-center mb-6">
          <button onClick={() => photoRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center active:scale-95 transition-all">
            {photo?.preview ? (
              <>
                <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="text-2xl">📷</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">📷</span>
                <span className="text-slate-500 text-xs">Фото</span>
              </div>
            )}
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-3 mb-5">
          <input value={form.last_name} onChange={set('last_name')}
            placeholder="Прізвище" autoFocus
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base" />
          <input value={form.first_name} onChange={set('first_name')}
            placeholder="Ім'я"
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base" />
          <input value={form.patronymic} onChange={set('patronymic')}
            placeholder="По батькові"
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base" />
        </div>

        {/* Gender */}
        <div className="mb-4">
          <p className="text-slate-400 text-xs mb-2 px-1">Стать</p>
          <div className="flex gap-2">
            {[{ v: 'male', label: '♂ Чоловік' }, { v: 'female', label: '♀ Жінка' }, { v: '', label: '— Не вказано' }].map(opt => (
              <button key={opt.v} type="button" onClick={() => setVal('gender', opt.v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  form.gender === opt.v
                    ? opt.v === 'male' ? 'bg-blue-600 text-white' : opt.v === 'female' ? 'bg-pink-600 text-white' : 'bg-slate-600 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="mb-5">
          <div className="flex gap-2">
            <button onClick={() => setVal('is_alive', true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${form.is_alive ? 'bg-green-700 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              🟢 Живий/а
            </button>
            <button onClick={() => setVal('is_alive', false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${!form.is_alive ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              ⚫ Помер/ла
            </button>
          </div>
        </div>

        {/* Dates */}
        <div className="flex flex-col gap-3 mb-5">
          <div>
            <p className="text-slate-400 text-xs mb-1.5 px-1">Дата народження</p>
            <input type="date" value={form.birth_date} onChange={set('birth_date')}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 text-base" />
          </div>
          {!form.is_alive && (
            <div>
              <p className="text-slate-400 text-xs mb-1.5 px-1">Дата смерті</p>
              <input type="date" value={form.death_date} onChange={set('death_date')}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 text-base" />
            </div>
          )}
        </div>

        {/* Places */}
        <div className="flex flex-col gap-3 mb-5">
          <input value={form.birth_place} onChange={set('birth_place')}
            placeholder="Місце народження"
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base" />
          <input value={form.living_place} onChange={set('living_place')}
            placeholder="Місце проживання"
            className="bg-slate-800 text-white rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base" />
        </div>

        {/* Biography */}
        <div className="mb-5">
          <p className="text-slate-400 text-xs mb-1.5 px-1">Біографія</p>
          <textarea value={form.biography} onChange={set('biography')} rows={4}
            placeholder="Коротка біографія..."
            className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-base resize-none" />
        </div>

        {/* Relationships */}
        <div className="mb-2">
          <p className="text-slate-400 text-xs mb-2 px-1">Зв'язки</p>
          {rels.map((r, i) => {
            const n = [r.person.last_name, r.person.first_name].filter(Boolean).join(' ') || 'Без імені';
            const typeLabel = REL_TYPES.find(t => t.key === r.relType)?.label || r.relType;
            const isPrefill = i === 0 && !!prefillRel;
            return (
              <div key={i} className="flex items-center gap-2 mb-2">
                <div className={`flex-1 rounded-xl px-3 py-2.5 ${isPrefill ? 'bg-blue-900/40 border border-blue-700/40' : 'bg-slate-800'}`}>
                  <p className="text-white text-sm font-medium">{n}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{typeLabel}</p>
                </div>
                {!isPrefill && (
                  <button onClick={() => setRels(prev => prev.filter((_, j) => j !== i))}
                    className="w-9 h-9 flex items-center justify-center text-slate-500 active:scale-90 transition-all text-lg">
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {allPersons.length > 0 && (
            <button onClick={openRelPicker}
              className="w-full bg-slate-800 border border-dashed border-slate-600 text-slate-400 font-medium py-3 rounded-xl text-sm active:scale-95 transition-all">
              ➕ Додати зв'язок
            </button>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-3 border-t border-slate-800"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
        <button onClick={handleSave} disabled={!canSave || saving}
          className="w-full bg-blue-600 disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all">
          {saving ? 'Збереження...' : '✓ Додати особу'}
        </button>
      </div>

      {/* ── Relationship picker ─────────────────────────────────────────── */}
      {showRelPicker && (
        <div className="fixed inset-0 z-[200] flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setShowRelPicker(false)}>
          <div className="w-full bg-slate-900 rounded-t-3xl border-t border-slate-700"
            style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>

            <div className="flex-shrink-0 px-5 pt-4 pb-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />

              {pickedPerson ? (
                <>
                  <button onClick={() => setPickedPerson(null)}
                    className="text-blue-400 text-sm mb-3 active:opacity-60">← Назад</button>
                  <h3 className="text-white font-bold text-base mb-4">
                    Тип зв'язку з&nbsp;
                    <span className="text-blue-300">
                      {[pickedPerson.last_name, pickedPerson.first_name].filter(Boolean).join(' ')}
                    </span>
                  </h3>
                </>
              ) : (
                <>
                  <h3 className="text-white font-bold text-base mb-3">Вибрати особу</h3>
                  <input value={relSearch} onChange={e => setRelSearch(e.target.value)}
                    placeholder="Пошук по імені..." autoFocus
                    className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 mb-2" />
                </>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-2">
              {!pickedPerson ? (
                <div className="flex flex-col gap-2">
                  {filteredPersons.slice(0, 30).map(p => {
                    const n = [p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без імені';
                    const already = rels.some(r => r.person.id === p.id);
                    return (
                      <button key={p.id} onClick={() => !already && setPickedPerson(p)} disabled={already}
                        className={`flex items-center gap-3 rounded-xl p-3 text-left transition-all ${already ? 'bg-slate-800/40 opacity-40 cursor-default' : 'bg-slate-800 active:scale-95'}`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                          p.gender === 'male' ? 'bg-blue-700' : p.gender === 'female' ? 'bg-pink-700' : 'bg-slate-600'
                        }`}>
                          {[p.first_name, p.last_name].filter(Boolean).map(s => s[0]).join('') || '?'}
                        </div>
                        <span className="text-white text-sm font-medium flex-1">{n}</span>
                        {already && <span className="text-slate-500 text-xs">вже додано</span>}
                      </button>
                    );
                  })}
                  {filteredPersons.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-6">Нікого не знайдено</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {REL_TYPES.map(({ key, label }) => (
                    <button key={key} onClick={() => addRel(pickedPerson, key)}
                      className="flex items-center bg-slate-800 rounded-xl p-4 text-left text-white text-sm font-medium active:scale-95 transition-all">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
