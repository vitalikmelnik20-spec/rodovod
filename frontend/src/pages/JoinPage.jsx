import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [treeInfo, setTreeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await api.get(`/trees/join/${token}`);
        setTreeInfo(res.data);
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true);
        else setError('Помилка завантаження запрошення');
      }
      setLoading(false);
    }
    fetchInvite();
  }, [token]);

  async function join() {
    if (!user) {
      navigate('/login');
      return;
    }
    setJoining(true);
    try {
      const res = await api.post(`/trees/join/${token}`);
      navigate(`/tree/${res.data.tree_id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка. Спробуйте ще раз.');
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900">
        <div className="text-6xl mb-4 animate-pulse">🌳</div>
        <p className="text-slate-400">Завантаження...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 px-6 text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h2 className="text-white text-xl font-bold mb-2">Посилання недійсне</h2>
        <p className="text-slate-400 text-sm mb-8">Можливо, термін дії минув або посилання вже не активне</p>
        <button
          onClick={() => navigate('/')}
          className="bg-slate-700 hover:bg-slate-600 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-all"
        >
          На головну
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 px-6">
      <div className="text-7xl mb-6">🌳</div>

      <div className="w-full max-w-xs bg-slate-800 rounded-3xl p-6 text-center">
        <p className="text-slate-400 text-sm mb-1">Запрошення до дерева</p>
        <h2 className="text-white text-xl font-bold mb-1">{treeInfo?.name || 'Родовідне дерево'}</h2>
        {treeInfo?.description && (
          <p className="text-slate-500 text-xs mb-4">{treeInfo.description}</p>
        )}

        <div className="bg-slate-700/50 rounded-2xl px-4 py-2 text-xs text-slate-400 mb-6">
          Ви отримаєте роль <span className="text-blue-400 font-semibold">Редактор</span>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-xs px-3 py-2 rounded-xl mb-4">
            {error}
          </div>
        )}

        {!user ? (
          <>
            <p className="text-slate-400 text-sm mb-4">Увійдіть через Telegram, щоб прийняти запрошення</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all"
            >
              Увійти через Telegram
            </button>
          </>
        ) : (
          <button
            onClick={join}
            disabled={joining}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all disabled:opacity-60"
          >
            {joining ? 'Приєднуюсь...' : '✅ Приєднатись'}
          </button>
        )}
      </div>
    </div>
  );
}
