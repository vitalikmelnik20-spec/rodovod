import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const stored = JSON.parse(localStorage.getItem('rodovod-auth') || '{}');
  const token = stored?.state?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      const { useAuthStore } = await import('../store/authStore');
      const refreshed = await useAuthStore.getState().refresh();
      if (refreshed) return api(err.config);
    }
    return Promise.reject(err);
  }
);

export default api;
