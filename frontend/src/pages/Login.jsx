import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao fazer login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #050b18 0%, #0a0f2e 50%, #050b18 100%)' }}>

      {/* Glow de fundo */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="w-full max-w-md px-4">
        <div style={{
          background: 'rgba(10,15,35,0.85)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          padding: '40px 36px',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 0 60px rgba(139,92,246,0.15), 0 0 0 1px rgba(139,92,246,0.1)',
        }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            {/* Contorno roxo brilhoso */}
            <div style={{
              padding: 6,
              borderRadius: 28,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(99,102,241,0.8))',
              boxShadow: '0 0 30px rgba(139,92,246,0.6), 0 0 60px rgba(139,92,246,0.3)',
              marginBottom: 20,
            }}>
              <div style={{
                background: '#070d1f',
                borderRadius: 22,
                padding: '10px 16px',
              }}>
                <img
                  src="https://i.postimg.cc/kMSmpLX7/Chat-GPT-Image-23-de-mar-de-2026-12-02-06.png"
                  alt="Logo"
                  style={{ height: 90, objectFit: 'contain', display: 'block', filter: 'brightness(1.1)' }}
                />
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Entre na sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>
                {erro}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: 12, padding: '11px 14px',
                  color: '#e2e8f0', fontSize: 14,
                  outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(139,92,246,0.25)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: 12, padding: '11px 14px',
                  color: '#e2e8f0', fontSize: 14,
                  outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(139,92,246,0.25)'}
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              style={{
                width: '100%', padding: '13px',
                borderRadius: 12, border: 'none', cursor: carregando ? 'not-allowed' : 'pointer',
                fontSize: 14, fontWeight: 600, color: '#ffffff',
                background: carregando
                  ? 'rgba(139,92,246,0.4)'
                  : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                boxShadow: carregando ? 'none' : '0 0 20px rgba(139,92,246,0.4)',
                transition: 'all 0.2s', marginTop: 8,
              }}
              onMouseEnter={e => { if (!carregando) e.currentTarget.style.boxShadow = '0 0 30px rgba(139,92,246,0.7)'; }}
              onMouseLeave={e => { if (!carregando) e.currentTarget.style.boxShadow = '0 0 20px rgba(139,92,246,0.4)'; }}
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
