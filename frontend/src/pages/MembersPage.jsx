import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const ROLE_LABELS = { admin: 'Адмін', editor: 'Редактор', viewer: 'Глядач' };
const ROLE_COLORS = { admin: 'text-yellow-400', editor: 'text-blue-400', viewer: 'text-slate-400' };

export default function MembersPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setGeneratingLink(true);
    try {
      const res = await api.post(`/trees/${treeId}/invite`);
      setInviteLink(res.data.link);
    } catch {}
    setGeneratingLink(false);
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h1 className="text-white font-bold text-lg">👥 Учасники</h1>
        <span className="ml-auto text-slate-500 text-sm">{members.length}</span>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Invite block — admin only */}
        {myRole === 'admin' && (
          <div className="bg-slate-800 rounded-2xl p-4">
            <p className="text-white font-semibold text-sm mb-3">🔗 Запросити учасника</p>
            {!inviteLink ? (
              <button
                onClick={generateInvite}
                disabled={generatingLink}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-sm font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {generatingLink ? 'Генерую...' : 'Згенерувати посилання'}
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <div className="flex-1 bg-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 truncate select-all">
                  {inviteLink}
                </div>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all"
                >
                  {copied ? '✓' : 'Копія'}
                </button>
              </div>
            )}
            {inviteLink && (
              <p className="text-slate-500 text-xs mt-2">Посилання дійсне 7 днів · роль «Редактор»</p>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          {members.map((mb, i) => {
            const name = [mb.first_name, mb.last_name].filter(Boolean).join(' ')
              || mb.username
              || `#${mb.telegram_user_id}`;
            const isMe = String(mb.telegram_user_id) === String(user?.telegram_id);

            return (
              <div
                key={mb.telegram_user_id}
                className={`flex items-center gap-3 px-4 py-3.5 ${i < members.length - 1 ? 'border-b border-slate-700' : ''}`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg font-semibold text-slate-300">
                  {mb.photo_url
                    ? <img src={mb.photo_url} alt={name} className="w-full h-full object-cover" />
                    : (mb.first_name?.[0] || '?').toUpperCase()
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {name}
                    {isMe && <span className="text-slate-500 text-xs ml-1.5">(я)</span>}
                  </p>
                  <p className={`text-xs ${ROLE_COLORS[mb.role] || 'text-slate-400'}`}>
                    {ROLE_LABELS[mb.role] || mb.role}
                  </p>
                </div>

                {myRole === 'admin' && !isMe && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={mb.role}
                      onChange={e => changeRole(mb.telegram_user_id, e.target.value)}
                      className="bg-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer"
                    >
                      <option value="admin">Адмін</option>
                      <option value="editor">Редактор</option>
                      <option value="viewer">Глядач</option>
                    </select>
                    <button
                      onClick={() => removeMember(mb.telegram_user_id, name)}
                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 active:scale-90 rounded-lg transition-all"
                      title="Видалити"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {members.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <div className="text-5xl mb-3">👤</div>
            <p>Учасників немає</p>
          </div>
        )}
      </div>
    </div>
  );
}
