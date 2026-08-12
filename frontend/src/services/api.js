import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    // When running under Vite dev server, use empty baseURL so requests are proxied via vite.config.js
    if (port === '5173' || port === '3000') {
      return '';
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return `${window.location.protocol}//${hostname}:8000`;
    }
    return window.location.origin;
  }
  return 'http://localhost:8000';
};


const api = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zylo_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('zylo_token');
      localStorage.removeItem('zylo_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);


export default api;
