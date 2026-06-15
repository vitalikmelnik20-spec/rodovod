import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'csacas_bot';

export default function LoginPage() {
  const { ready, initData } = useTelegramApp();
  const login = useAuthStore(s => s.login);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!ready) return;
    if (initData) {
      handleMiniAppAuth();
    } else if (user) {
      navigate('/', { replace: true });
    }
  }, [ready]);

  async function handleMiniAppAuth() {
    setLoading(true);
    try {
      const res = await api.post('/auth/telegram', { init_data: initData });
      login(res.data.user, res.data.access, res.data.refresh);
      navigate('/', { replace: true });
    } catch {
      setError('Помилка авторизації через Telegram');
      setLoading(false);
    }
  }

  async function handleCodeLogin(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login-code', { code: code.trim() });
      login(res.data.user, res.data.access, res.data.refresh);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Невірний або прострочений код');
      setLoading(false);
      inputRef.current?.select();
    }
  }

  if (loading || (ready && initData && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900">
        <div className="text-6xl mb-6 animate-pulse">🌳</div>
        <p className="text-slate-400 text-lg">Завантаження...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 px-6">
      <div className="text-8xl mb-4">🌳</div>
      <h1 className="text-3xl font-bold text-white mb-2 text-center">Родовідне Дерево</h1>
      <p className="text-slate-400 text-center text-sm mb-10 max-w-xs">
        Спільна платформа для збереження генеалогічного дерева вашої родини
      </p>

      {error && (
        <div className="bg-red-900/40 border border-red-500/50 text-red-300 px-4 py-3 rounded-2xl mb-6 text-sm text-center w-full max-w-xs">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 w-full max-w-xs">
        {/* Step 1 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-3 font-medium uppercase tracking-wide">Крок 1 — Отримайте код</p>
          <a
            href={`https://t.me/${BOT_USERNAME}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all text-white font-semibold px-5 py-3 rounded-xl text-sm"
          >
            <span className="text-lg">✈️</span> Відкрити бота в Telegram
          </a>
          <p className="text-slate-500 text-xs mt-2 text-center">
            В боті натисніть «🔑 Код для входу на сайт»
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-3 font-medium uppercase tracking-wide">Крок 2 — Введіть код</p>
          <form onSubmit={handleCodeLogin} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="w-full bg-slate-700 border border-slate-600 text-white text-center text-2xl font-mono font-bold tracking-widest rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 placeholder-slate-600"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all text-white font-semibold px-5 py-3 rounded-xl text-sm"
            >
              {loading ? 'Перевірка...' : '✓ Увійти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
