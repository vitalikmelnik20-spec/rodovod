import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

function Avatar({ user, size = 9 }) {
  const initials = [user.first_name, user.last_name].filter(Boolean).map(s => s[0]).join('') || '?';
  return user.photo_url
    ? <img src={user.photo_url} alt="" className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{initials}</div>;
}

export default function ChatPage() {
  const { id: treeId } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.accessToken);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    loadMessages();

    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join-tree', treeId);
    socket.on('chat:message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.emit('leave-tree', treeId);
      socket.disconnect();
    };
  }, [treeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await api.get(`/trees/${treeId}/chat`);
      setMessages(res.data);
    } catch { }
    setLoading(false);
  }

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');
    try {
      await api.post(`/trees/${treeId}/chat`, { message: msg });
    } catch {
      setText(msg);
    }
    setSending(false);
  }

  function fmtTime(d) {
    return new Date(d).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDay(d) {
    return new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  }

  let lastDay = null;

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 px-4 pt-10 pb-3 flex items-center gap-3 border-b border-slate-700 flex-shrink-0">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-white text-xl">
          ‹
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold">💬 Сімейний чат</h1>
          <p className="text-slate-400 text-xs">Всі учасники дерева</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {loading ? (
          <div className="flex justify-center items-center h-full text-4xl animate-pulse">💬</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-slate-400 font-medium">Поки що тихо</p>
            <p className="text-slate-600 text-sm mt-1">Напишіть перше повідомлення!</p>
          </div>
        ) : messages.map((m, i) => {
          const isMe = m.sender_id === me?.telegram_id;
          const day = fmtDay(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;

          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span className="text-slate-500 text-xs bg-slate-800 px-3 py-1 rounded-full">{day}</span>
                </div>
              )}
              <div className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && <Avatar user={m} />}
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && (
                    <span className="text-slate-400 text-xs mb-1 ml-1">
                      {m.username ? `@${m.username}` : [m.first_name, m.last_name].filter(Boolean).join(' ')}
                    </span>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-800 text-white rounded-bl-sm'
                  }`}>
                    {m.message}
                  </div>
                  <span className="text-slate-600 text-xs mt-0.5 mx-1">{fmtTime(m.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-slate-800 border-t border-slate-700 px-4 py-3 flex gap-2 items-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Повідомлення..."
          className="flex-1 bg-slate-700 text-white rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 text-sm"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="w-11 h-11 bg-blue-600 disabled:opacity-40 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all flex-shrink-0"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
