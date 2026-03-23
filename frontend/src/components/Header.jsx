import { Bell } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useSocketEvent } from '../hooks/useSocket';

export default function Header() {
  const [notificacoes, setNotificacoes] = useState([]);

  const handleNovoAtendimento = useCallback((data) => {
    setNotificacoes((prev) => [
      { id: Date.now(), texto: `Novo atendimento: ${data.cliente?.nome || 'Lead'}`, tipo: 'atendimento' },
      ...prev.slice(0, 9),
    ]);
  }, []);

  const handleComprovante = useCallback((data) => {
    const status = data.status === 'confirmado' ? 'Confirmado' : 'Divergente';
    setNotificacoes((prev) => [
      { id: Date.now(), texto: `Comprovante ${status}`, tipo: 'comprovante' },
      ...prev.slice(0, 9),
    ]);
  }, []);

  useSocketEvent('atendimento:novo', handleNovoAtendimento);
  useSocketEvent('comprovante:analisado', handleComprovante);

  return (
    <header className="h-24 flex items-center justify-between px-4 relative"
      style={{ background: 'rgba(6,11,24,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a2d4a' }}>
      {/* Mobile: logo centralizada */}
      <div className="md:hidden absolute left-1/2 -translate-x-1/2">
        <img
          src="https://i.postimg.cc/kMSmpLX7/Chat-GPT-Image-23-de-mar-de-2026-12-02-06.png"
          alt="Logo"
          style={{ height: '80px', objectFit: 'contain', filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(129,140,248,0.5))' }}
        />
      </div>
      {/* Desktop: título */}
      <div className="hidden md:block">
        <h2 className="text-sm font-semibold text-white tracking-wide">Painel de Controle</h2>
      </div>
      {/* Spacer mobile (mantém bell à direita) */}
      <div className="md:hidden flex-1" />

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            className="relative p-2 rounded-xl transition-all"
            style={{ color: '#475569', border: '1px solid #1a2d4a', background: '#0d1526' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.boxShadow = '0 0 10px rgba(59,130,246,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a2d4a'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <Bell size={16} />
            {notificacoes.length > 0 && (
              <span className="absolute -top-1 -right-1 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold"
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                {notificacoes.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
