import { useEffect, useState } from 'react';

export function useTelegramApp() {
  const [tg, setTg] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const webapp = window.Telegram?.WebApp;
    if (!webapp) { setReady(true); return; }

    webapp.ready();
    webapp.expand();
    webapp.setHeaderColor('#0F172A');
    webapp.setBackgroundColor('#0F172A');
    setTg(webapp);
    setReady(true);
  }, []);

  const initData = window.Telegram?.WebApp?.initData || null;
  const isTelegramApp = !!window.Telegram?.WebApp;
  return { tg, ready, initData, isTelegramApp };
}
