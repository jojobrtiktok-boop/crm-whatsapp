import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, User, GitBranch, Play, Smartphone, Bot, HeadphonesIcon, Paperclip, Check, CheckCheck, FileText, X, DollarSign } from 'lucide-react';
import api from '../api';
import { useSocket, useSocketEvent } from '../hooks/useSocket';

// Formata exibição de telefone — trata @lid (contatos com privacidade ativada no WhatsApp)
function exibirContato(lead) {
  if (lead.nome) return lead.nome;
  if (lead.telefone?.includes('@lid')) return 'Contato WhatsApp';
  return lead.telefone || 'Sem nome';
}

function exibirTelefone(telefone) {
  if (!telefone) return '';
  if (telefone.includes('@lid')) return 'Número protegido pelo WhatsApp';
  return telefone;
}

// Ícone de ticks de leitura WhatsApp
function Ticks({ status }) {
  if (status === 'erro') {
    return <X size={14} className="text-red-300 shrink-0" title="Falha no envio" />;
  }
  if (status === 'lido') {
    return <CheckCheck size={14} className="text-blue-300 shrink-0" />;
  }
  if (status === 'entregue') {
    return <CheckCheck size={14} className="text-primary-200 shrink-0" />;
  }
  // enviado (padrão)
  return <Check size={14} className="text-primary-200 shrink-0" />;
}

// Preview de mídia na bolha de mensagem
function MidiaBubble({ msg }) {
  if (!msg.tipoMidia) return <p className="whitespace-pre-wrap">{msg.conteudo}</p>;

  const url = msg.midiaUrl ? (msg.midiaUrl.startsWith('http') ? msg.midiaUrl : `${window.location.origin.replace(':5173', ':3001')}${msg.midiaUrl}`) : null;

  if (msg.tipoMidia === 'imagem' && url) {
    return (
      <div>
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="imagem" className="rounded max-w-[200px] mb-1" />
        </a>
        {msg.conteudo && <p className="text-xs mt-1">{msg.conteudo}</p>}
      </div>
    );
  }
  if (msg.tipoMidia === 'video' && url) {
    return (
      <div>
        <video src={url} controls className="rounded max-w-[200px] mb-1" />
        {msg.conteudo && <p className="text-xs mt-1">{msg.conteudo}</p>}
      </div>
    );
  }
  if (msg.tipoMidia === 'audio' && url) {
    return (
      <div>
        <audio src={url} controls className="max-w-[220px]" />
        {msg.conteudo && <p className="text-xs mt-1">{msg.conteudo}</p>}
      </div>
    );
  }
  if (msg.tipoMidia === 'documento' && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline">
        <FileText size={16} />
        <span className="text-sm">{msg.conteudo || 'documento.pdf'}</span>
      </a>
    );
  }
  return <p className="italic opacity-75">[{msg.tipoMidia}]</p>;
}

export default function Atendimento() {
  const [aba, setAba] = useState('todos'); // 'todos' | 'pagos'
  const [leads, setLeads] = useState([]);
  const [leadsPagos, setLeadsPagos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [vistaChat, setVistaChat] = useState(false); // mobile: alterna entre lista e chat
  const [conversas, setConversas] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [chips, setChips] = useState([]);
  const [funis, setFunis] = useState([]);
  const [modalFunil, setModalFunil] = useState(false);
  const [fotos, setFotos] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [previewArquivo, setPreviewArquivo] = useState(null); // { file, tipo, url }
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);
  const socket = useSocket();

  async function carregarLeads() {
    try {
      const [resLeads, resChips, resFunis] = await Promise.all([
        api.get('/atendimento'),
        api.get('/chips'),
        api.get('/funis'),
      ]);
      setLeads(resLeads.data);
      setChips(resChips.data);
      setFunis(resFunis.data);
      resLeads.data.forEach((lead) => {
        api.get(`/clientes/${lead.id}/foto`).then((r) => {
          if (r.data?.url) setFotos((prev) => ({ ...prev, [lead.id]: r.data.url }));
        }).catch(() => {});
      });
    } catch (err) {
      console.error('Erro ao carregar leads:', err);
    }
    // Pagos é não-crítico — não bloqueia o atendimento se falhar
    api.get('/atendimento/pagos').then((r) => setLeadsPagos(r.data)).catch(() => {});
  }

  useEffect(() => { carregarLeads(); }, []);

  const handleNovoAtendimento = useCallback(() => { carregarLeads(); }, []);
  useSocketEvent('atendimento:novo', handleNovoAtendimento);
  useSocketEvent('lead:novo', handleNovoAtendimento);

  const handleNovaMensagem = useCallback((data) => {
    carregarLeads();
    if (selecionado && data.clienteId === selecionado.id) {
      setConversas((prev) => [...prev, data.conversa]);
      scrollParaBaixo();
    }
  }, [selecionado]);
  useSocketEvent('mensagem:nova', handleNovaMensagem);

  // Atualizar status de leitura em tempo real
  const handleMensagemStatus = useCallback((data) => {
    if (selecionado && data.clienteId === selecionado.id) {
      setConversas((prev) =>
        prev.map((c) => c.id === data.conversaId ? { ...c, status: data.status } : c)
      );
    }
  }, [selecionado]);
  useSocketEvent('mensagem:status', handleMensagemStatus);

  async function selecionarLead(lead) {
    setSelecionado(lead);
    setVistaChat(true);
    try {
      const res = await api.get(`/clientes/${lead.id}/conversas`);
      setConversas(res.data);
      scrollParaBaixo();
      if (socket && lead.atendimento) {
        socket.emit('atendimento:assumir', { atendimentoId: lead.atendimento.id });
      }
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    }
  }

  async function enviarMensagem() {
    if (!mensagem.trim() || !selecionado || enviando) return;
    const chipId = selecionado.chipOrigem?.id || selecionado.chipOrigemId || chips[0]?.id;
    setEnviando(true);
    try {
      const res = await api.post('/whatsapp/enviar', {
        clienteId: selecionado.id,
        chipId,
        mensagem: mensagem.trim(),
      });
      setMensagem('');
      setConversas((prev) => [...prev, res.data.conversa]);
      scrollParaBaixo();
      carregarLeads();
    } catch (err) {
      console.error('Erro ao enviar:', err);
    } finally {
      setEnviando(false);
    }
  }

  function onArquivoSelecionado(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const tipo = ext === 'pdf' ? 'documento' : /mp4|avi|mov/.test(ext) ? 'video' : 'imagem';
    const url = URL.createObjectURL(file);
    setPreviewArquivo({ file, tipo, url });
  }

  async function enviarArquivo() {
    if (!previewArquivo || !selecionado || enviando) return;
    const chipId = selecionado.chipOrigem?.id || selecionado.chipOrigemId || chips[0]?.id;
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', previewArquivo.file);
      formData.append('clienteId', selecionado.id);
      formData.append('chipId', chipId);

      const res = await api.post('/whatsapp/enviar-arquivo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setConversas((prev) => [...prev, res.data.conversa]);
      scrollParaBaixo();
      carregarLeads();
      setPreviewArquivo(null);
      fileInputRef.current.value = '';
    } catch (err) {
      console.error('Erro ao enviar arquivo:', err);
      alert('Erro ao enviar arquivo');
    } finally {
      setEnviando(false);
    }
  }

  function scrollParaBaixo() {
    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  function getNomeChip(chipId) {
    const chip = chips.find((c) => c.id === chipId);
    return chip?.nome || chip?.numero?.slice(-4) || '';
  }

  function formatarHora(data) {
    return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatarData(data) {
    const d = new Date(data);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) return formatarHora(data);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Lista de leads — mobile: sempre visível (chat abre em overlay) */}
      <div className="flex w-full md:w-96 border-r border-gray-200 flex-col md:flex-shrink-0">
        <div className="p-3 border-b border-gray-200">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => setAba('todos')}
              className={`flex-1 py-1.5 text-xs font-medium ${aba === 'todos' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Atendimento ({leads.length})
            </button>
            <button
              onClick={() => setAba('pagos')}
              className={`flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${aba === 'pagos' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <DollarSign size={11} /> Pagos ({leadsPagos.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {(aba === 'todos' ? leads : leadsPagos).map((lead) => (
            <div
              key={lead.id}
              onClick={() => selecionarLead(lead)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 ${
                selecionado?.id === lead.id ? 'bg-primary-50' : ''
              }`}
            >
              <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {fotos[lead.id]
                  ? <img src={fotos[lead.id]} alt="" className="w-full h-full object-cover" />
                  : <User size={18} className="text-gray-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {exibirContato(lead)}
                  </p>
                  {aba === 'pagos' && lead.ultimoComprovante ? (
                    <span className="text-[10px] font-bold text-green-600 shrink-0">
                      R$ {lead.ultimoComprovante.valorExtraido?.toFixed(2) || '?'}
                    </span>
                  ) : lead.ultimaMensagem ? (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {formatarData(lead.ultimaMensagem.criadoEm)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {lead.chipOrigem && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-md shrink-0">
                      <Smartphone size={9} />
                      {lead.chipOrigem.nome || lead.chipOrigem.numero?.slice(-4)}
                    </span>
                  )}
                  {aba === 'pagos' && lead.ultimoComprovante ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-md shrink-0">
                      <DollarSign size={9} /> {lead.ultimoComprovante.banco || lead.ultimoComprovante.tipoTransferencia || 'Pago'}
                    </span>
                  ) : (
                    <>
                      {lead.emFunil ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-md shrink-0">
                          <Bot size={9} /> Bot
                        </span>
                      ) : lead.atendimento ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded-md shrink-0">
                          <HeadphonesIcon size={9} /> Humano
                        </span>
                      ) : null}
                      {lead.ultimaMensagem && (
                        <p className="text-xs text-gray-400 truncate">
                          {lead.ultimaMensagem.conteudo || `[${lead.ultimaMensagem.tipoMidia}]`}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {(aba === 'todos' ? leads : leadsPagos).length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <User size={32} className="mb-2 opacity-50" />
              <p className="text-sm">{aba === 'pagos' ? 'Nenhum pagamento confirmado' : 'Nenhuma conversa ainda'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat — desktop only (mobile usa overlay abaixo) */}
      {selecionado ? (
        <div className="hidden md:flex flex-1 flex-col">
          <ChatHeader
            lead={selecionado}
            fotos={fotos}
            onVoltar={() => setVistaChat(false)}
            onAtivarFunil={() => setModalFunil(true)}
            mobile={false}
          />
          <ChatMensagens conversas={conversas} chatRef={chatRef} formatarHora={formatarHora} getNomeChip={getNomeChip} />
          <ChatInput
            mensagem={mensagem}
            setMensagem={setMensagem}
            enviando={enviando}
            enviarMensagem={enviarMensagem}
            previewArquivo={previewArquivo}
            setPreviewArquivo={setPreviewArquivo}
            enviarArquivo={enviarArquivo}
            fileInputRef={fileInputRef}
            onArquivoSelecionado={onArquivoSelecionado}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-400">
          <div className="text-center">
            <User size={48} className="mx-auto mb-3 opacity-50" />
            <p>Selecione uma conversa</p>
          </div>
        </div>
      )}

      {/* Overlay full-screen chat — mobile only */}
      {vistaChat && selecionado && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
          <ChatHeader
            lead={selecionado}
            fotos={fotos}
            onVoltar={() => setVistaChat(false)}
            onAtivarFunil={() => setModalFunil(true)}
            mobile={true}
          />
          <ChatMensagens conversas={conversas} chatRef={chatRef} formatarHora={formatarHora} getNomeChip={getNomeChip} />
          <ChatInput
            mensagem={mensagem}
            setMensagem={setMensagem}
            enviando={enviando}
            enviarMensagem={enviarMensagem}
            previewArquivo={previewArquivo}
            setPreviewArquivo={setPreviewArquivo}
            enviarArquivo={enviarArquivo}
            fileInputRef={fileInputRef}
            onArquivoSelecionado={onArquivoSelecionado}
          />
        </div>
      )}

      {/* Modal ativar funil */}
      {modalFunil && selecionado && (
        <ModalAtivarFunil
          funis={funis}
          chips={chips}
          clienteId={selecionado.id}
          onClose={() => setModalFunil(false)}
        />
      )}
    </div>
  );
}

function ChatHeader({ lead, fotos, onVoltar, onAtivarFunil, mobile }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {mobile && (
          <button onClick={onVoltar} className="p-1 -ml-1 text-gray-500 hover:text-gray-700 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
        )}
        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center shrink-0">
          {fotos[lead.id]
            ? <img src={fotos[lead.id]} alt="" className="w-full h-full object-cover" />
            : <User size={16} className="text-gray-500" />
          }
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{exibirContato(lead)}</h3>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 truncate">{exibirTelefone(lead.telefone)}</p>
            {lead.chipOrigem && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-md shrink-0">
                <Smartphone size={10} />
                {lead.chipOrigem.nome || lead.chipOrigem.numero?.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onAtivarFunil}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-3 py-1.5 bg-primary-50 rounded-lg shrink-0 ml-2"
      >
        <GitBranch size={14} /> <span className="hidden sm:inline">Ativar Funil</span>
      </button>
    </div>
  );
}

function ChatMensagens({ conversas, chatRef, formatarHora, getNomeChip }) {
  return (
    <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
      {conversas.map((msg) => (
        <div key={msg.id} className={`flex ${msg.tipo === 'enviada' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
              msg.tipo === 'enviada'
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-800'
            }`}
          >
            <MidiaBubble msg={msg} />
            <div className={`flex items-center justify-end gap-1 mt-1 ${msg.tipo === 'enviada' ? 'text-primary-100' : 'text-gray-400'}`}>
              <span className="text-xs">{formatarHora(msg.criadoEm)}</span>
              {msg.tipo === 'recebida' && msg.chipId && (
                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-green-100 text-green-700 text-[9px] font-semibold rounded">
                  <Smartphone size={8} />
                  {getNomeChip(msg.chipId)}
                </span>
              )}
              {msg.tipo === 'enviada' && <Ticks status={msg.status} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatInput({ mensagem, setMensagem, enviando, enviarMensagem, previewArquivo, setPreviewArquivo, enviarArquivo, fileInputRef, onArquivoSelecionado }) {
  return (
    <div className="shrink-0 border-t border-gray-200 bg-white">
      {previewArquivo && (
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3">
          {previewArquivo.tipo === 'imagem' && (
            <img src={previewArquivo.url} alt="" className="h-16 w-16 object-cover rounded" />
          )}
          {previewArquivo.tipo === 'video' && (
            <video src={previewArquivo.url} className="h-16 w-16 object-cover rounded" />
          )}
          {previewArquivo.tipo === 'documento' && (
            <div className="flex items-center gap-2 text-gray-700">
              <FileText size={32} />
              <span className="text-sm truncate max-w-[160px]">{previewArquivo.file.name}</span>
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={enviarArquivo}
            disabled={enviando}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
          <button
            onClick={() => { setPreviewArquivo(null); fileInputRef.current.value = ''; }}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className="p-3 flex gap-2 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/avi,video/mov,.pdf"
          className="hidden"
          onChange={onArquivoSelecionado}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 shrink-0"
        >
          <Paperclip size={20} />
        </button>
        <input
          type="text"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
          className="flex-1 rounded-lg border-gray-300 text-sm"
          placeholder="Digite sua mensagem..."
          disabled={enviando}
        />
        <button
          onClick={enviarMensagem}
          disabled={!mensagem.trim() || enviando}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function ModalAtivarFunil({ funis, chips, clienteId, onClose }) {
  const [funilId, setFunilId] = useState('');
  const [chipId, setChipId] = useState(chips[0]?.id?.toString() || '');
  const [ativando, setAtivando] = useState(false);

  async function ativar() {
    if (!funilId || !chipId) { alert('Selecione um funil e um chip'); return; }
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
            <select value={funilId} onChange={(e) => setFunilId(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Selecione o funil</option>
              {funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chip para envio</label>
            <select value={chipId} onChange={(e) => setChipId(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Selecione o chip</option>
              {chips.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={ativar} disabled={ativando} className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            <Play size={14} /> {ativando ? 'Ativando...' : 'Ativar Funil'}
          </button>
        </div>
      </div>
    </div>
  );
}
