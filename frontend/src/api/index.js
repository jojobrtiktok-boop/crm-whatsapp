// Cliente HTTP com interceptors para autenticação
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Interceptor para adicionar token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
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
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
