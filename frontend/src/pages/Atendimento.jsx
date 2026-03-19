import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, User, Clock, CheckCircle, PhoneOff, GitBranch, Play, Smartphone } from 'lucide-react';
import api from '../api';
import { useSocket, useSocketEvent } from '../hooks/useSocket';

export default function Atendimento() {
  const [atendimentos, setAtendimentos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [chips, setChips] = useState([]);
  const [funis, setFunis] = useState([]);
  const [modalFunil, setModalFunil] = useState(false);
  const chatRef = useRef(null);
  const socket = useSocket();

  async function carregarAtendimentos() {
    try {
      const [resAtend, resChips, resFunis] = await Promise.all([
        api.get('/atendimento'),
        api.get('/chips'),
        api.get('/funis'),
      ]);
      setAtendimentos(resAtend.data);
      setChips(resChips.data);
      setFunis(resFunis.data);
    } catch (err) {
      console.error('Erro ao carregar atendimentos:', err);
    }
  }

  useEffect(() => { carregarAtendimentos(); }, []);

  // Novo atendimento em tempo real
  const handleNovoAtendimento = useCallback(() => { carregarAtendimentos(); }, []);
  useSocketEvent('atendimento:novo', handleNovoAtendimento);

  // Nova mensagem em tempo real
  const handleNovaMensagem = useCallback((data) => {
    if (selecionado && data.clienteId === selecionado.clienteId) {
      setConversas((prev) => [...prev, data.conversa]);
      scrollParaBaixo();
    }
  }, [selecionado]);
  useSocketEvent('mensagem:nova', handleNovaMensagem);

  async function selecionarAtendimento(atend) {
    setSelecionado(atend);

    // Assumir atendimento se está aguardando
    if (atend.status === 'aguardando') {
      try {
        await api.put(`/atendimento/${atend.id}/assumir`);
        carregarAtendimentos();
      } catch (err) {
        console.error('Erro ao assumir:', err);
      }
    }

    // Carregar conversas do cliente
    try {
      const res = await api.get(`/clientes/${atend.clienteId}/conversas`);
      setConversas(res.data);
      scrollParaBaixo();

      if (socket) {
        socket.emit('atendimento:assumir', { atendimentoId: atend.id });
      }
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    }
  }

  async function enviarMensagem() {
    if (!mensagem.trim() || !selecionado) return;

    const cliente = selecionado.cliente;
    const chipId = selecionado.cliente?.chipOrigem?.id || chips[0]?.id;

    try {
      await api.post('/whatsapp/enviar', {
        clienteId: cliente.id,
        chipId,
        mensagem: mensagem.trim(),
      });

      setMensagem('');
      const res = await api.get(`/clientes/${cliente.id}/conversas`);
      setConversas(res.data);
      scrollParaBaixo();
    } catch (err) {
      console.error('Erro ao enviar:', err);
    }
  }

  async function finalizarAtendimento(atendId) {
    try {
      await api.put(`/atendimento/${atendId}/finalizar`);
      setSelecionado(null);
      setConversas([]);
      carregarAtendimentos();
    } catch (err) {
      console.error('Erro ao finalizar:', err);
    }
  }

  function scrollParaBaixo() {
    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  // Buscar nome do chip pelo ID
  function getNomeChip(chipId) {
    const chip = chips.find((c) => c.id === chipId);
    return chip?.nome || chip?.numero?.slice(-4) || '';
  }

  const atendimentosPendentes = atendimentos.filter((a) => a.status !== 'finalizado');

  return (
    <div className="h-[calc(100vh-7rem)] flex bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Lista de atendimentos */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Atendimentos</h2>
          <p className="text-xs text-gray-500 mt-1">{atendimentosPendentes.length} em aberto</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {atendimentosPendentes.map((atend) => (
            <div
              key={atend.id}
              onClick={() => selecionarAtendimento(atend)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 ${
                selecionado?.id === atend.id ? 'bg-primary-50' : ''
              }`}
            >
              <div className="bg-gray-200 rounded-full p-2">
                <User size={16} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {atend.cliente?.nome || 'Sem nome'}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-gray-500 truncate">{atend.cliente?.telefone}</p>
                  {atend.cliente?.chipOrigem && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-md shrink-0">
                      <Smartphone size={9} />
                      {atend.cliente.chipOrigem.nome || atend.cliente.chipOrigem.numero?.slice(-4)}
                    </span>
                  )}
                </div>
              </div>
              <div>
                {atend.status === 'aguardando' ? (
                  <Clock size={14} className="text-yellow-500" />
                ) : (
                  <CheckCircle size={14} className="text-green-500" />
                )}
              </div>
            </div>
          ))}

          {atendimentosPendentes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <User size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Nenhum atendimento</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat */}
      {selecionado ? (
        <div className="flex-1 flex flex-col">
          {/* Header do chat */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div>
              <h3 className="font-semibold text-gray-800">{selecionado.cliente?.nome || 'Sem nome'}</h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{selecionado.cliente?.telefone}</p>
                {selecionado.cliente?.chipOrigem && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-md">
                    <Smartphone size={10} />
                    {selecionado.cliente.chipOrigem.nome || selecionado.cliente.chipOrigem.numero?.slice(-4)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalFunil(true)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-3 py-1.5 bg-primary-50 rounded-lg"
              >
                <GitBranch size={14} /> Ativar Funil
              </button>
              <button
                onClick={() => finalizarAtendimento(selecionado.id)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 bg-red-50 rounded-lg"
              >
                <PhoneOff size={14} /> Finalizar
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
            {conversas.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.tipo === 'enviada' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                    msg.tipo === 'enviada'
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p>{msg.conteudo || `[${msg.tipoMidia}]`}</p>
                  <div className={`flex items-center gap-1.5 mt-1 ${msg.tipo === 'enviada' ? 'text-primary-100' : 'text-gray-400'}`}>
                    <span className="text-xs">
                      {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.tipo === 'recebida' && msg.chipId && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-green-100 text-green-700 text-[9px] font-semibold rounded">
                        <Smartphone size={8} />
                        {getNomeChip(msg.chipId)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input de mensagem */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarMensagem()}
                className="flex-1 rounded-lg border-gray-300 text-sm"
                placeholder="Digite sua mensagem..."
              />
              <button
                onClick={enviarMensagem}
                disabled={!mensagem.trim()}
                className="bg-primary-600 text-white px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <MessageIcon size={48} className="mx-auto mb-3 opacity-50" />
            <p>Selecione um atendimento</p>
          </div>
        </div>
      )}

      {/* Modal ativar funil */}
      {modalFunil && selecionado && (
        <ModalAtivarFunil
          funis={funis}
          chips={chips}
          clienteId={selecionado.clienteId}
          onClose={() => setModalFunil(false)}
        />
      )}
    </div>
  );
}

function ModalAtivarFunil({ funis, chips, clienteId, onClose }) {
  const [funilId, setFunilId] = useState('');
  const [chipId, setChipId] = useState(chips[0]?.id?.toString() || '');
  const [ativando, setAtivando] = useState(false);

  async function ativar() {
    if (!funilId || !chipId) {
      alert('Selecione um funil e um chip');
      return;
    }
    setAtivando(true);
    try {
      await api.post('/funis/executar', {
        funilId: parseInt(funilId),
        clienteId: parseInt(clienteId),
        chipId: parseInt(chipId),
      });
      alert('Funil ativado para este lead!');
      onClose();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao ativar funil');
    } finally {
      setAtivando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-4">Ativar Funil Manualmente</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Funil</label>
            <select
              value={funilId}
              onChange={(e) => setFunilId(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm"
            >
              <option value="">Selecione o funil</option>
              {funis.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chip para envio</label>
            <select
              value={chipId}
              onChange={(e) => setChipId(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm"
            >
              <option value="">Selecione o chip</option>
              {chips.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">
            Cancelar
          </button>
          <button
            onClick={ativar}
            disabled={ativando}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            <Play size={14} /> {ativando ? 'Ativando...' : 'Ativar Funil'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageIcon(props) {
  return <User {...props} />;
}
