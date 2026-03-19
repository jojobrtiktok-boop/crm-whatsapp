import { Bell } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useSocketEvent } from '../hooks/useSocket';

export default function Header() {
  const [notificacoes, setNotificacoes] = useState([]);

  // Escutar eventos de notificação em tempo real
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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Painel de Controle</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Notificações */}
        <div className="relative">
          <button className="relative text-gray-500 hover:text-gray-700">
            <Bell size={20} />
            {notificacoes.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {notificacoes.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
