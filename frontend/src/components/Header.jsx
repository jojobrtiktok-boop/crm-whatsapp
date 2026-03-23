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

  // Desktop: header escondido (sino fica na Sidebar)
  return (
    <header className="md:hidden h-20 flex items-center justify-between px-4 relative"
      style={{ background: 'rgba(6,11,24,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(129,140,248,0.35)', boxShadow: '0 2px 20px rgba(129,140,248,0.12)' }}>
      {/* Mobile: logo centralizada */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <img
          src="https://i.postimg.cc/kMSmpLX7/Chat-GPT-Image-23-de-mar-de-2026-12-02-06.png"
          alt="Logo"
          style={{ height: '82px', objectFit: 'contain', filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(129,140,248,0.5))' }}
        />
      </div>
      <div className="flex-1" />
      <div className="relative">
        <button
          className="relative p-2 rounded-xl transition-all"
          style={{ color: '#818cf8', border: '1px solid rgba(129,140,248,0.45)', background: 'rgba(129,140,248,0.08)', boxShadow: '0 0 12px rgba(129,140,248,0.3)' }}
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
    </header>
  );
}
