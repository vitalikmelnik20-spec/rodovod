import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useTelegramApp } from './hooks/useTelegramApp';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import TreePage from './pages/TreePage';
import PersonPage from './pages/PersonPage';
import TimelinePage from './pages/TimelinePage';
import SearchPage from './pages/SearchPage';
import ChatPage from './pages/ChatPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import MembersPage from './pages/MembersPage';
import JoinPage from './pages/JoinPage';
import Layout from './components/layout/Layout';

function PrivateRoute({ children }) {
  const user = useAuthStore(s => s.user);
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { tg } = useTelegramApp();

  useEffect(() => {
    if (tg) {
      tg.MainButton.hide();
    }
  }, [tg]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<HomePage />} />
        <Route path="tree/:id" element={<TreePage />} />
        <Route path="tree/:id/person/:pid" element={<PersonPage />} />
        <Route path="tree/:id/timeline" element={<TimelinePage />} />
        <Route path="tree/:id/search" element={<SearchPage />} />
        <Route path="tree/:id/chat" element={<ChatPage />} />
        <Route path="tree/:id/history" element={<HistoryPage />} />
        <Route path="tree/:id/settings" element={<SettingsPage />} />
        <Route path="tree/:id/members" element={<MembersPage />} />
      </Route>
    </Routes>
  );
}
