import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const ROLE_LABELS = { admin: 'Адмін', editor: 'Редактор', viewer: 'Глядач' };
const ROLE_COLORS = { admin: 'text-yellow-400', editor: 'text-blue-400', viewer: 'text-slate-400' };

const EXPIRY_OPTIONS = [
  { label: '1 день', value: 1 },
  { label: '7 днів', value: 7 },
  { label: '30 днів', value: 30 },
];

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

export default function MembersPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Invite sheet state
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [membRes, treeRes] = await Promise.all([
          api.get(`/trees/${treeId}/members`),
          api.get(`/trees/${treeId}`),
        ]);
        setMembers(membRes.data);
        setMyRole(treeRes.data.role);
      } catch {}
      setLoading(false);
    }
    load();
  }, [treeId]);

  async function generateInvite() {
    setGenerating(true);
    try {
      const res = await api.post(`/trees/${treeId}/invite`, { expires_in_days: expiresInDays });
      setInviteData(res.data);
    } catch {}
    setGenerating(false);
  }

  async function handleCopy(key, text) {
    await copyText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleShare(url) {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}`);
    } else {
      navigator.share?.({ url }) ?? copyText(url);
    }
  }

  function openInviteSheet() {
    setInviteData(null);
    setExpiresInDays(7);
    setShowInviteSheet(true);
  }

  async function changeRole(uid, role) {
    try {
      await api.put(`/trees/${treeId}/members/${uid}`, { role });
      setMembers(m => m.map(mb => mb.telegram_user_id === uid ? { ...mb, role } : mb));
    } catch {}
  }

  async function removeMember(uid, name) {
    if (!window.confirm(`Видалити ${name}?`)) return;
    try {
      await api.delete(`/trees/${treeId}/members/${uid}`);
      setMembers(m => m.filter(mb => mb.telegram_user_id !== uid));
    } catch {}
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-slate-400">Завантаження...</div>
    </div>
  );

  const expiryLabel = EXPIRY_OPTIONS.find(o => o.value === expiresInDays)?.label;

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur px-4 pt-10 pb-4 sticky top-0 z-10 border-b border-slate-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 text-2xl leading-none">‹</button>
        <h1 className="text-white font-bold text-lg">👥 Учасники</h1>
        <span className="ml-auto text-slate-500 text-sm">{members.length}</span>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Invite button — admin only */}
        {myRole === 'admin' && (
          <button onClick={openInviteSheet}
            className="w-full bg-blue-600 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all">
            🔗 Запросити учасника
          </button>
        )}

        {/* Members list */}
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          {members.map((mb, i) => {
            const name = [mb.first_name, mb.last_name].filter(Boolean).join(' ')
              || mb.username
              || `#${mb.telegram_user_id}`;
            const isMe = String(mb.telegram_user_id) === String(user?.telegram_id);

            return (
              <div key={mb.telegram_user_id}
                className={`flex items-center gap-3 px-4 py-3.5 ${i < members.length - 1 ? 'border-b border-slate-700' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg font-semibold text-slate-300">
                  {mb.photo_url
                    ? <img src={mb.photo_url} alt={name} className="w-full h-full object-cover" />
                    : (mb.first_name?.[0] || '?').toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {name}{isMe && <span className="text-slate-500 text-xs ml-1.5">(я)</span>}
                  </p>
                  <p className={`text-xs ${ROLE_COLORS[mb.role] || 'text-slate-400'}`}>
                    {ROLE_LABELS[mb.role] || mb.role}
                  </p>
                </div>

                {myRole === 'admin' && !isMe && (
                  <div className="flex items-center gap-1.5">
                    <select value={mb.role} onChange={e => changeRole(mb.telegram_user_id, e.target.value)}
                      className="bg-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer">
                      <option value="admin">Адмін</option>
                      <option value="editor">Редактор</option>
                      <option value="viewer">Глядач</option>
                    </select>
                    <button onClick={() => removeMember(mb.telegram_user_id, name)}
                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 active:scale-90 rounded-lg transition-all">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {members.length === 0 && (
            <div className="text-center text-slate-500 py-12">
              <div className="text-5xl mb-3">👤</div>
              <p>Учасників немає</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Invite bottom sheet (6.2) ─────────────────────────────── */}
      {showInviteSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={e => e.target === e.currentTarget && setShowInviteSheet(false)}>
          <div className="w-full bg-slate-900 rounded-t-3xl border-t border-slate-700"
            style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>

            <div className="flex-shrink-0 px-5 pt-4 pb-3">
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
              <h3 className="text-white font-bold text-lg mb-1">Запросити учасника</h3>
              <p className="text-slate-400 text-xs mb-4">Отримає роль «Редактор»</p>

              {/* Expiry selector */}
              {!inviteData && (
                <>
                  <p className="text-slate-400 text-xs mb-2">Термін дії</p>
                  <div className="flex gap-2 mb-5">
                    {EXPIRY_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setExpiresInDays(opt.value)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          expiresInDays === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={generateInvite} disabled={generating}
                    className="w-full bg-blue-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all">
                    {generating ? 'Генерую...' : '🔗 Згенерувати посилання'}
                  </button>
                </>
              )}
            </div>

            {/* Links section */}
            {inviteData && (
              <div className="overflow-y-auto flex-1 px-5 pb-2">
                <p className="text-slate-500 text-xs mb-4 text-center">
                  Дійсне {expiryLabel} · {new Date(inviteData.expires_at).toLocaleDateString('uk-UA')}
                </p>

                {[
                  { key: 'web',    icon: '🌐', label: 'Веб-посилання',    url: inviteData.links.web },
                  { key: 'bot',    icon: '🤖', label: 'Telegram Bot',     url: inviteData.links.bot },
                  { key: 'webapp', icon: '📱', label: 'Telegram WebApp',  url: inviteData.links.webapp },
                ].map(({ key, icon, label, url }) => (
                  <div key={key} className="bg-slate-800 rounded-2xl p-4 mb-3">
                    <p className="text-slate-400 text-xs mb-1">{icon} {label}</p>
                    <p className="text-white text-xs font-mono truncate mb-3">{url}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleCopy(key, url)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          copiedKey === key ? 'bg-green-700 text-white' : 'bg-slate-700 text-slate-300 active:scale-95'
                        }`}>
                        {copiedKey === key ? '✓ Скопійовано' : 'Копіювати'}
                      </button>
                      <button onClick={() => handleShare(url)}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all">
                        Поділитись
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={() => setInviteData(null)}
                  className="w-full text-slate-500 text-sm py-3 active:opacity-60">
                  ← Нове посилання
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
