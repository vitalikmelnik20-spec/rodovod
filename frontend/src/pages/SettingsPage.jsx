import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function SettingsPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const fileRef = useRef(null);

  const [tree, setTree] = useState(null);
  const [role, setRole] = useState(null);
  const [pendingProposals, setPendingProposals] = useState(0);

  // Tree settings edit state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [savingTree, setSavingTree] = useState(false);
  const [treeSaved, setTreeSaved] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [exportingGed, setExportingGed] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/trees/${treeId}`);
        setTree(res.data);
        setRole(res.data.role);
        setPendingProposals(parseInt(res.data.pending_proposals) || 0);
        setEditName(res.data.name || '');
        setEditDesc(res.data.description || '');
        setEditPublic(res.data.is_public || false);
      } catch {}
    }
    load();
  }, [treeId]);

  async function saveTreeSettings() {
    if (!editName.trim()) return;
    setSavingTree(true);
    try {
      const res = await api.put(`/trees/${treeId}`, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        is_public: editPublic,
      });
      setTree(res.data);
      setTreeSaved(true);
      setTimeout(() => setTreeSaved(false), 2000);
    } catch {}
    setSavingTree(false);
  }

  async function exportGedcom() {
    setExportingGed(true);
    try {
      const res = await api.get(`/trees/${treeId}/gedcom`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tree_${treeId}.ged`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setExportingGed(false);
  }

  async function importGedcom(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post(`/trees/${treeId}/gedcom/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult({ ok: true, count: res.data.imported });
    } catch {
      setImportResult({ ok: false });
    }
    setImporting(false);
    e.target.value = '';
  }

  async function exportPng() {
    try {
      const { toPng } = await import('html-to-image');
      const viewport = document.querySelector('.react-flow__viewport');
      if (!viewport) { alert('Спочатку відкрийте дерево'); return; }
      const dataUrl = await toPng(viewport, { backgroundColor: '#0F172A', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `tree_${treeId}.png`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  }

  const sections = [
    {
      title: '📤 Експорт',
      items: [
        {
          icon: '🧬', label: 'Завантажити GEDCOM',
          desc: 'Стандартний формат генеалогії (.ged)',
          action: exportGedcom, loading: exportingGed,
        },
        {
          icon: '🖼', label: 'Завантажити PNG',
          desc: 'Скріншот дерева (відкрийте дерево спочатку)',
          action: exportPng,
        },
      ],
    },
    {
      title: '📥 Імпорт',
      items: [
        {
          icon: '🧬', label: 'Імпортувати GEDCOM',
          desc: 'Додати осіб з файлу .ged (тільки адмін)',
          action: () => fileRef.current?.click(), loading: importing,
        },
      ],
    },
    {
      title: '🔗 Посилання',
      items: [
        {
          icon: '👥', label: 'Учасники',
          desc: 'Переглянути та запросити',
          action: () => navigate(`/tree/${treeId}/members`),
        },
        {
          icon: '📋', label: 'Пропозиції змін',
          desc: 'Розглянути заявки від редакторів',
          action: () => navigate(`/tree/${treeId}/proposals`),
          badge: pendingProposals > 0 ? pendingProposals : null,
        },
        {
          icon: '🕓', label: 'Історія змін',
          desc: 'Журнал всіх редагувань',
          action: () => navigate(`/tree/${treeId}/history`),
        },
      ],
    },
    {
      title: '👤 Акаунт',
      items: [
        {
          icon: '🚪', label: 'Вийти',
          desc: user?.first_name ? `Вхід як ${user.first_name}` : '',
          action: () => { logout(); navigate('/login'); },
          danger: true,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur px-4 pt-10 pb-4 sticky top-0 z-10 border-b border-slate-700">
        <h1 className="text-white font-bold text-lg">⚙️ Ще</h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">
        {/* Tree settings editor — admin only */}
        {role === 'admin' && tree && (
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">🌳 Дерево</p>
            <div className="bg-slate-800 rounded-2xl p-4 flex flex-col gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Назва</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  placeholder="Назва дерева"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Опис</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 resize-none"
                  placeholder="Короткий опис..."
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Публічне дерево</p>
                  <p className="text-slate-500 text-xs">Видно всім без запрошення</p>
                </div>
                <button
                  onClick={() => setEditPublic(v => !v)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${editPublic ? 'bg-blue-600' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${editPublic ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
              <button
                onClick={saveTreeSettings}
                disabled={savingTree || !editName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
              >
                {treeSaved ? '✅ Збережено!' : savingTree ? '...' : 'Зберегти зміни'}
              </button>
            </div>
          </div>
        )}

        {importResult && (
          <div className={`px-4 py-3 rounded-2xl text-sm font-medium ${
            importResult.ok ? 'bg-green-900/40 text-green-300 border border-green-800' : 'bg-red-900/40 text-red-300 border border-red-800'
          }`}>
            {importResult.ok ? `✅ Імпортовано ${importResult.count} осіб` : '❌ Помилка імпорту'}
          </div>
        )}

        {sections.map(section => (
          <div key={section.title}>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{section.title}</p>
            <div className="bg-slate-800 rounded-2xl overflow-hidden">
              {section.items.map((item, i) => (
                <button key={item.label}
                  onClick={item.action}
                  disabled={item.loading}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:scale-[0.98] transition-all disabled:opacity-60 ${
                    i < section.items.length - 1 ? 'border-b border-slate-700' : ''
                  }`}>
                  <span className="text-2xl w-8 text-center flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${item.danger ? 'text-red-400' : 'text-white'}`}>
                      {item.loading ? '...' : item.label}
                    </p>
                    {item.desc && <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>}
                  </div>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {item.badge}
                    </span>
                  )}
                  <span className="text-slate-600">›</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept=".ged,.gedcom" className="hidden" onChange={importGedcom} />
    </div>
  );
}
