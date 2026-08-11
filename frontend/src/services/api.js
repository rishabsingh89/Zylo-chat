import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 5000,
});

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zylo_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — skip for mock tokens
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const token = localStorage.getItem('zylo_token') || '';
      // Only redirect on real 401s (not mock tokens)
      if (!token.startsWith('bW9ja18')) {   // base64 of "mock_"
        localStorage.removeItem('zylo_token');
        localStorage.removeItem('zylo_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
