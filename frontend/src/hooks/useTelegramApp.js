import { useEffect, useState } from 'react';

function setAppHeight(h) {
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}

export function useTelegramApp() {
  const [tg, setTg] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Default height for non-Telegram browsers
    setAppHeight(window.innerHeight);

    const webapp = window.Telegram?.WebApp;
    if (!webapp) { setReady(true); return; }

    webapp.ready();
    webapp.expand();
    webapp.setHeaderColor?.('#0F172A');
    webapp.setBackgroundColor?.('#0F172A');
    webapp.disableVerticalSwipe?.();

    // Set initial height
    setAppHeight(webapp.viewportStableHeight || webapp.viewportHeight || window.innerHeight);

    // Update on keyboard open/close
    webapp.onEvent('viewportChanged', ({ height, is_state_stable }) => {
      if (is_state_stable) setAppHeight(height);
    });

    setTg(webapp);
    setReady(true);
  }, []);

  const initData = window.Telegram?.WebApp?.initData || null;
  const isTelegramApp = !!window.Telegram?.WebApp;
  return { tg, ready, initData, isTelegramApp };
}
