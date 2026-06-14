import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function SettingsPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [exportingGed, setExportingGed] = useState(false);

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
    } catch { }
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
                  <span className="text-slate-600">›</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hidden GEDCOM file input */}
      <input ref={fileRef} type="file" accept=".ged,.gedcom" className="hidden" onChange={importGedcom} />
    </div>
  );
}
