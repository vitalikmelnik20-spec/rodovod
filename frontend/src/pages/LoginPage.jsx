import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'csacas_bot';

export default function LoginPage() {
  const { ready, initData, isTelegramApp } = useTelegramApp();
  const login = useAuthStore(s => s.login);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!ready) return;
    if (initData) {
      handleMiniAppAuth();
    } else if (user) {
      navigate('/', { replace: true });
    } else if (!isTelegramApp) {
      mountWidget();
    }
    // If isTelegramApp && !initData: in Telegram browser but not Mini App — show bot button only
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
    // Глобальний callback для Telegram Widget
    window.onTelegramWidgetAuth = async (data) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/auth/telegram/widget', data);
        login(res.data.user, res.data.access, res.data.refresh);
        navigate('/', { replace: true });
      } catch {
        setError('Помилка авторизації. Спробуйте ще раз.');
        setLoading(false);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'true');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramWidgetAuth(user)');
    script.setAttribute('data-request-access', 'write');
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
      {/* Logo */}
      <div className="text-8xl mb-4">🌳</div>
      <h1 className="text-3xl font-bold text-white mb-2 text-center">Родовідне Дерево</h1>
      <p className="text-slate-400 text-center text-sm mb-10 max-w-xs">
        Спільна платформа для збереження генеалогічного дерева вашої родини
      </p>

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-500/50 text-red-300 px-4 py-3 rounded-2xl mb-6 text-sm text-center w-full max-w-xs">
          {error}
        </div>
      )}

      {/* Login options */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        {isTelegramApp && !initData ? (
          // Opened in Telegram browser (not Mini App) — widget won't work here
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="bg-yellow-900/30 border border-yellow-500/40 text-yellow-300 px-4 py-3 rounded-2xl text-sm text-center">
              Відкрийте додаток через бота, натиснувши кнопку нижче
            </div>
            <a
              href={`https://t.me/${BOT_USERNAME}?start=open`}
              className="flex items-center justify-center gap-3 w-full bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all text-white font-semibold px-6 py-3.5 rounded-2xl text-sm"
            >
              <span className="text-xl">✈️</span> Відкрити через бота
            </a>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
