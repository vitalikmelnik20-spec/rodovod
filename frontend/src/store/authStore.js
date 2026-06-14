import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    accessToken: null,
    refreshToken: null,

    login: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),

    logout: () => {
      set({ user: null, accessToken: null, refreshToken: null });
    },

    refresh: async () => {
      const { refreshToken } = get();
      if (!refreshToken) return false;
      try {
        const res = await api.post('/auth/refresh', { refresh_token: refreshToken });
        set({ user: res.data.user, accessToken: res.data.access, refreshToken: res.data.refresh });
        return true;
      } catch {
        get().logout();
        return false;
      }
    },
  }),
  { name: 'rodovod-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }) }
));
