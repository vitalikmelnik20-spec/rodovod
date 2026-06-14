import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function LoginPage() {
  const { ready, initData } = useTelegramApp();
  const login = useAuthStore(s => s.login);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) { navigate('/', { replace: true }); return; }
    if (!ready) return;
    if (initData) handleTelegramAuth();
  }, [ready, initData, user]);

  async function handleTelegramAuth() {
    setLoading(true);
    try {
      const res = await api.post('/auth/telegram', { init_data: initData });
      login(res.data.user, res.data.access, res.data.refresh);
      navigate('/', { replace: true });
    } catch {
      setError('Помилка авторизації');
      setLoading(false);
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6">
      <div className="text-8xl mb-6">🌳</div>
      <h1 className="text-3xl font-bold text-white mb-2">Родовідне Дерево</h1>
      <p className="text-slate-400 text-center mb-10">
        Спільна платформа для збереження генеалогічного дерева вашої родини
      </p>
      {error && (
        <div className="bg-red-900/40 border border-red-500 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}
      <p className="text-slate-500 text-sm text-center">
        Відкрийте додаток через Telegram-бота
      </p>
    </div>
  );
}
