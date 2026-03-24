// Cliente HTTP com interceptors para autenticação
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsRemove(key) { try { localStorage.removeItem(key); } catch {} }

// Interceptor para adicionar token JWT
api.interceptors.request.use((config) => {
  const token = lsGet('crm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      lsRemove('crm_token');
      lsRemove('crm_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
