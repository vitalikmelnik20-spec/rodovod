import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../services/api';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: treeId } = useParams();
  const [pendingCount, setPendingCount] = useState(0);
  const [treeRole, setTreeRole] = useState(null);

  useEffect(() => {
    if (!treeId) return;
    api.get(`/trees/${treeId}`)
      .then(res => {
        setTreeRole(res.data.role);
        setPendingCount(parseInt(res.data.pending_proposals) || 0);
      })
      .catch(() => {});
  }, [treeId]);

  const tabs = treeId ? [
    { icon: '🌳', label: 'Дерево', path: `/tree/${treeId}` },
    { icon: '🔍', label: 'Пошук', path: `/tree/${treeId}/search` },
    { icon: '💬', label: 'Чат', path: `/tree/${treeId}/chat` },
    { icon: '📅', label: 'Хронологія', path: `/tree/${treeId}/timeline` },
    {
      icon: '⚙️', label: 'Ще', path: `/tree/${treeId}/settings`,
      badge: treeRole === 'admin' && pendingCount > 0 ? pendingCount : null,
    },
  ] : [];

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      <main className="flex-1 overflow-hidden" style={{ paddingBottom: treeId ? '64px' : '0' }}>
        <Outlet />
      </main>

      {treeId && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex">
            {tabs.map(tab => {
              const active = location.pathname === tab.path;
              return (
                <button key={tab.path} onClick={() => navigate(tab.path)}
                  className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                    active ? 'text-blue-400' : 'text-slate-500'
                  }`}>
                  <span className="text-xl mb-0.5 relative inline-block">
                    {tab.icon}
                    {tab.badge && (
                      <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
