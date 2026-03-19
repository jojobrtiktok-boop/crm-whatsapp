import { createContext, useState, useEffect } from 'react';
import api from '../api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    const dadosUsuario = localStorage.getItem('crm_usuario');

    if (token && dadosUsuario) {
      setUsuario(JSON.parse(dadosUsuario));
      // Validar token no backend
      api.get('/auth/me')
        .then((res) => setUsuario(res.data))
        .catch(() => {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_usuario');
          setUsuario(null);
        })
        .finally(() => setCarregando(false));
    } else {
      setCarregando(false);
    }
  }, []);

  async function login(email, senha) {
    const res = await api.post('/auth/login', { email, senha });
    const { token, usuario: dados } = res.data;
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_usuario', JSON.stringify(dados));
    setUsuario(dados);
    return dados;
  }

  function logout() {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
