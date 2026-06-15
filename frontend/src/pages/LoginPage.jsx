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
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const widgetRef = useRef(null);

  // Handle redirect-mode auth: tokens arrive in URL after Telegram widget redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access = params.get('access');
    const refresh = params.get('refresh');
    const userStr = params.get('user');
    const err = params.get('error');

    if (err) {
      setError('Помилка авторизації через Telegram. Спробуйте ще раз.');
      window.history.replaceState({}, '', '/login');
      return;
    }

    if (access && refresh && userStr) {
      try {
        const u = JSON.parse(userStr);
        login(u, access, refresh);
        navigate('/', { replace: true });
      } catch {
        setError('Помилка авторизації. Спробуйте ще раз.');
        window.history.replaceState({}, '', '/login');
      }
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (initData) {
      handleMiniAppAuth();
    } else if (user) {
      navigate('/', { replace: true });
    } else {
      mountWidget();
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

  function mountWidget() {
    if (!widgetRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'true');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    // Always use redirect mode — works in all browsers including Telegram in-app browser
    script.setAttribute('data-auth-url', `${window.location.origin}/api/auth/telegram/widget/redirect`);
    script.async = true;
    widgetRef.current.innerHTML = '';
    widgetRef.current.appendChild(script);
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

      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        <div ref={widgetRef} className="flex justify-center w-full" />

        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-600 text-xs">або</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <a
          href={`https://t.me/${BOT_USERNAME}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-3 w-full bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 active:scale-95 transition-all text-blue-300 font-semibold px-6 py-3.5 rounded-2xl text-sm"
        >
          <span className="text-xl">✈️</span> Відкрити бота в Telegram
        </a>

        <p className="text-slate-600 text-xs text-center">
          У боті натисніть «Відкрити додаток» — він відкриється як Mini App
        </p>
      </div>
    </div>
  );
}
