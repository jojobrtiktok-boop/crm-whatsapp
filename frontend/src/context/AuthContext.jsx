import { createContext, useState, useEffect } from 'react';
import api from '../api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Helpers seguros para localStorage (Safari modo privado lança SecurityError)
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  useEffect(() => {
    const token = lsGet('crm_token');
    const dadosUsuario = lsGet('crm_usuario');

    if (token && dadosUsuario) {
      try { setUsuario(JSON.parse(dadosUsuario)); } catch {}
      api.get('/auth/me')
        .then((res) => setUsuario(res.data))
        .catch(() => {
          lsRemove('crm_token');
          lsRemove('crm_usuario');
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
    lsSet('crm_token', token);
    lsSet('crm_usuario', JSON.stringify(dados));
    setUsuario(dados);
    return dados;
  }

  function logout() {
    lsRemove('crm_token');
    lsRemove('crm_usuario');
    setUsuario(null);
  }

  const moeda = usuario?.moeda || 'BRL';
  const idioma = usuario?.idioma || 'pt';
  const pais = usuario?.pais || 'BR';

  const LOCALES = { pt: 'pt-BR', es: 'es-AR', en: 'en-US' };
  const locale = LOCALES[idioma] || 'pt-BR';

  function formatarMoeda(valor) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: moeda }).format(valor || 0);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout, moeda, idioma, pais, formatarMoeda }}>
      {children}
    </AuthContext.Provider>
  );
}
