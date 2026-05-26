import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, User, GitBranch, Play, Smartphone, Bot, HeadphonesIcon, Paperclip, Check, CheckCheck, FileText, X, DollarSign, Search } from 'lucide-react';
import api from '../api';
import { useSocket, useSocketEvent } from '../hooks/useSocket';

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

function Ticks({ status }) {
  if (status === 'erro') return <X size={14} className="shrink-0" style={{ color: '#f87171' }} title="Falha no envio" />;
  if (status === 'lido') return <CheckCheck size={14} className="shrink-0" style={{ color: '#53bdeb' }} />;
  if (status === 'entregue') return <CheckCheck size={14} className="shrink-0" style={{ color: '#b2c8d1' }} />;
  return <Check size={14} className="shrink-0" style={{ color: '#b2c8d1' }} />;
}

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
  const [aba, setAba] = useState('todos');
  const [leads, setLeads] = useState([]);
  const [leadsPagos, setLeadsPagos] = useState([]);
  const [filtroChip, setFiltroChip] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [vistaChat, setVistaChat] = useState(false);
  const [conversas, setConversas] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [chips, setChips] = useState([]);
  const [funis, setFunis] = useState([]);
  const [modalFunil, setModalFunil] = useState(false);
  const [fotos, setFotos] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [previewArquivo, setPreviewArquivo] = useState(null);
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

  const listaFiltrada = (aba === 'todos' ? leads : leadsPagos)
    .filter((lead) => filtroChip === null || lead.chipOrigemId === filtroChip || lead.chipOrigem?.id === filtroChip);

  return (
    <div className="flex h-[calc(100vh-7rem)] rounded-xl overflow-hidden" style={{ border: '1px solid #e9edef' }}>

      {/* ══ SIDEBAR ══ */}
      <div className="flex w-full md:w-96 flex-col md:flex-shrink-0" style={{ background: '#fff', borderRight: '1px solid #e9edef' }}>

        {/* Header estilo WhatsApp */}
        <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 59, background: '#f0f2f5' }}>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#aebac1' }}>
              <User size={20} color="#fff" />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#111b21' }}>Conversas</span>
          </div>
          <div className="flex gap-0.5 items-center">
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#54656f"><path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#54656f"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 py-2 shrink-0" style={{ background: '#fff' }}>
          <div className="flex items-center gap-2 px-3 rounded-lg" style={{ background: '#f0f2f5', padding: '8px 12px' }}>
            <Search size={16} color="#54656f" />
            <span className="text-sm" style={{ color: '#667781' }}>Pesquisar conversa</span>
          </div>
        </div>

        {/* Tabs Atendimento / Pagos */}
        <div className="px-3 pb-2 shrink-0 flex gap-1.5">
          <button
            onClick={() => setAba('todos')}
            className="flex-1 py-1.5 text-xs font-semibold rounded-full transition-colors"
            style={aba === 'todos' ? { background: '#d9fdd3', color: '#006d5b' } : { background: '#f0f2f5', color: '#667781' }}
          >
            Atendimento ({leads.length})
          </button>
          <button
            onClick={() => setAba('pagos')}
            className="flex-1 py-1.5 text-xs font-semibold rounded-full flex items-center justify-center gap-1 transition-colors"
            style={aba === 'pagos' ? { background: '#25d366', color: '#fff' } : { background: '#f0f2f5', color: '#667781' }}
          >
            <DollarSign size={11} /> Pagos ({leadsPagos.length})
          </button>
        </div>

        {/* Filtro chips */}
        {chips.length > 1 && (
          <div className="px-3 pb-2 shrink-0 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setFiltroChip(null)}
              className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors"
              style={filtroChip === null ? { background: '#d9fdd3', color: '#006d5b' } : { background: '#f0f2f5', color: '#667781' }}
            >
              Todos
            </button>
            {chips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setFiltroChip(filtroChip === chip.id ? null : chip.id)}
                className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors"
                style={filtroChip === chip.id ? { background: '#25d366', color: '#fff' } : { background: '#f0f2f5', color: '#667781' }}
              >
                <Smartphone size={9} />
                {chip.nome}
              </button>
            ))}
          </div>
        )}

        {/* Lista de contatos */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c0c7cb transparent' }}>
          {listaFiltrada.map((lead) => (
            <div
              key={lead.id}
              onClick={() => selecionarLead(lead)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
              style={{
                borderBottom: '1px solid #f0f2f5',
                background: selecionado?.id === lead.id ? '#f0f2f5' : undefined,
              }}
              onMouseEnter={(e) => { if (selecionado?.id !== lead.id) e.currentTarget.style.background = '#f5f6f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = selecionado?.id === lead.id ? '#f0f2f5' : ''; }}
            >
              {/* Avatar */}
              <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#aebac1' }}>
                {fotos[lead.id]
                  ? <img src={fotos[lead.id]} alt="" className="w-full h-full object-cover" />
                  : <User size={20} color="#fff" />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <p className="text-[15px] font-normal truncate" style={{ color: '#111b21' }}>
                    {exibirContato(lead)}
                  </p>
                  {aba === 'pagos' && lead.ultimoComprovante ? (
                    <span className="text-[11px] font-bold shrink-0" style={{ color: '#25d366' }}>
                      R$ {lead.ultimoComprovante.valorExtraido?.toFixed(2) || '?'}
                    </span>
                  ) : lead.ultimaMensagem ? (
                    <span className="text-[11px] shrink-0" style={{ color: '#667781' }}>
                      {formatarData(lead.ultimaMensagem.criadoEm)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {lead.chipOrigem && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md shrink-0 text-[10px] font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>
                      <Smartphone size={9} />
                      {lead.chipOrigem.nome || lead.chipOrigem.numero?.slice(-4)}
                    </span>
                  )}
                  {aba === 'pagos' && lead.ultimoComprovante ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md shrink-0 text-[10px] font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>
                      <DollarSign size={9} /> {lead.ultimoComprovante.banco || lead.ultimoComprovante.tipoTransferencia || 'Pago'}
                    </span>
                  ) : (
                    <>
                      {lead.emFunil ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md shrink-0 text-[10px] font-semibold" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                          <Bot size={9} /> Bot
                        </span>
                      ) : lead.atendimento ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md shrink-0 text-[10px] font-semibold" style={{ background: '#ffedd5', color: '#c2410c' }}>
                          <HeadphonesIcon size={9} /> Humano
                        </span>
                      ) : null}
                      {lead.ultimaMensagem && (
                        <p className="text-xs truncate" style={{ color: '#667781' }}>
                          {lead.ultimaMensagem.conteudo || `[${lead.ultimaMensagem.tipoMidia}]`}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {listaFiltrada.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40" style={{ color: '#aebac1' }}>
              <User size={32} className="mb-2 opacity-50" />
              <p className="text-sm">{filtroChip ? 'Nenhuma conversa neste chip' : aba === 'pagos' ? 'Nenhum pagamento confirmado' : 'Nenhuma conversa ainda'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ CHAT — desktop ══ */}
      {selecionado ? (
        <div className="hidden md:flex flex-1 flex-col">
          <ChatHeader lead={selecionado} fotos={fotos} onVoltar={() => setVistaChat(false)} onAtivarFunil={() => setModalFunil(true)} mobile={false} />
          <ChatMensagens conversas={conversas} chatRef={chatRef} formatarHora={formatarHora} getNomeChip={getNomeChip} />
          <ChatInput
            mensagem={mensagem} setMensagem={setMensagem} enviando={enviando}
            enviarMensagem={enviarMensagem} previewArquivo={previewArquivo}
            setPreviewArquivo={setPreviewArquivo} enviarArquivo={enviarArquivo}
            fileInputRef={fileInputRef} onArquivoSelecionado={onArquivoSelecionado}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center" style={{ backgroundImage: "url('/bg-chat.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#efeae2' }}>
          <div className="text-center px-8 py-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f0f2f5' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#aebac1"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <p className="font-medium" style={{ color: '#111b21' }}>Selecione uma conversa</p>
            <p className="text-sm mt-1" style={{ color: '#667781' }}>Escolha um contato para iniciar</p>
          </div>
        </div>
      )}

      {/* Overlay mobile */}
      {vistaChat && selecionado && (
        <div className="fixed inset-0 z-50 flex flex-col md:hidden" style={{ background: '#efeae2' }}>
          <ChatHeader lead={selecionado} fotos={fotos} onVoltar={() => setVistaChat(false)} onAtivarFunil={() => setModalFunil(true)} mobile={true} />
          <ChatMensagens conversas={conversas} chatRef={chatRef} formatarHora={formatarHora} getNomeChip={getNomeChip} />
          <ChatInput
            mensagem={mensagem} setMensagem={setMensagem} enviando={enviando}
            enviarMensagem={enviarMensagem} previewArquivo={previewArquivo}
            setPreviewArquivo={setPreviewArquivo} enviarArquivo={enviarArquivo}
            fileInputRef={fileInputRef} onArquivoSelecionado={onArquivoSelecionado}
          />
        </div>
      )}

      {/* Modal funil */}
      {modalFunil && selecionado && (
        <ModalAtivarFunil funis={funis} chips={chips} clienteId={selecionado.id} onClose={() => setModalFunil(false)} />
      )}
    </div>
  );
}

function ChatHeader({ lead, fotos, onVoltar, onAtivarFunil, mobile }) {
  return (
    <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 59, background: '#f0f2f5', borderBottom: '1px solid #e9edef' }}>
      <div className="flex items-center gap-3 min-w-0">
        {mobile && (
          <button onClick={onVoltar} className="p-1 -ml-1 shrink-0" style={{ color: '#54656f' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
        )}
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: '#aebac1' }}>
          {fotos[lead.id]
            ? <img src={fotos[lead.id]} alt="" className="w-full h-full object-cover" />
            : <User size={18} color="#fff" />
          }
        </div>
        <div className="min-w-0">
          <h3 className="font-medium truncate" style={{ color: '#111b21', fontSize: 16 }}>{exibirContato(lead)}</h3>
          <div className="flex items-center gap-2">
            <p className="text-xs truncate" style={{ color: '#667781' }}>{exibirTelefone(lead.telefone)}</p>
            {lead.chipOrigem && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md shrink-0 text-[10px] font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>
                <Smartphone size={10} />
                {lead.chipOrigem.nome || lead.chipOrigem.numero?.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onAtivarFunil}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg shrink-0 ml-2 transition-colors hover:opacity-80"
        style={{ background: '#d9fdd3', color: '#006d5b' }}
      >
        <GitBranch size={14} /> <span className="hidden sm:inline">Ativar Funil</span>
      </button>
    </div>
  );
}

function ChatMensagens({ conversas, chatRef, formatarHora, getNomeChip }) {
  return (
    <div
      ref={chatRef}
      className="flex-1 overflow-y-auto"
      style={{
        padding: '12px 8% 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        backgroundImage: "url('/bg-chat.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#efeae2',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,0,0,.18) transparent',
      }}
    >
      {conversas.map((msg) => {
        const enviada = msg.tipo === 'enviada';
        return (
          <div key={msg.id} className="flex" style={{ justifyContent: enviada ? 'flex-end' : 'flex-start', marginBottom: 1 }}>
            <div
              style={{
                maxWidth: '65%',
                padding: '7px 9px 6px',
                borderRadius: 7.5,
                borderTopRightRadius: enviada ? 0 : 7.5,
                borderTopLeftRadius: enviada ? 7.5 : 0,
                background: enviada ? '#d9fdd3' : '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,.12)',
                color: '#111b21',
                fontSize: 14,
                lineHeight: '20px',
                position: 'relative',
              }}
            >
              <MidiaBubble msg={msg} />
              <div className="flex items-center justify-end gap-1 mt-1" style={{ color: '#667781' }}>
                <span style={{ fontSize: 11 }}>{formatarHora(msg.criadoEm)}</span>
                {msg.tipo === 'recebida' && msg.chipId && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>
                    <Smartphone size={8} />
                    {getNomeChip(msg.chipId)}
                  </span>
                )}
                {enviada && <Ticks status={msg.status} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChatInput({ mensagem, setMensagem, enviando, enviarMensagem, previewArquivo, setPreviewArquivo, enviarArquivo, fileInputRef, onArquivoSelecionado }) {
  return (
    <div className="shrink-0" style={{ background: '#f0f2f5', borderTop: '1px solid #e9edef' }}>
      {previewArquivo && (
        <div className="px-4 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid #e9edef', background: '#f0f2f5' }}>
          {previewArquivo.tipo === 'imagem' && (
            <img src={previewArquivo.url} alt="" className="h-16 w-16 object-cover rounded" />
          )}
          {previewArquivo.tipo === 'video' && (
            <video src={previewArquivo.url} className="h-16 w-16 object-cover rounded" />
          )}
          {previewArquivo.tipo === 'documento' && (
            <div className="flex items-center gap-2" style={{ color: '#111b21' }}>
              <FileText size={32} />
              <span className="text-sm truncate max-w-[160px]">{previewArquivo.file.name}</span>
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={enviarArquivo}
            disabled={enviando}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
            style={{ background: '#00a884', color: '#fff' }}
          >
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
          <button onClick={() => { setPreviewArquivo(null); fileInputRef.current.value = ''; }} style={{ color: '#54656f' }}>
            <X size={18} />
          </button>
        </div>
      )}
      <div className="flex gap-2 items-center" style={{ padding: '8px 14px 8px 12px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/avi,video/mov,.pdf"
          className="hidden"
          onChange={onArquivoSelecionado}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors shrink-0"
          style={{ color: '#54656f' }}
        >
          <Paperclip size={22} />
        </button>
        <input
          type="text"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
          className="flex-1 rounded-lg text-sm outline-none"
          style={{ background: '#fff', border: 'none', padding: '10px 14px', color: '#111b21' }}
          placeholder="Digite sua mensagem..."
          disabled={enviando}
        />
        <button
          onClick={enviarMensagem}
          disabled={!mensagem.trim() || enviando}
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors"
          style={{ background: '#00a884', boxShadow: '0 2px 6px rgba(0,168,132,.3)' }}
        >
          <Send size={20} color="#fff" />
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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#111b21' }}>Ativar Funil Manualmente</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#667781' }}>Funil</label>
            <select value={funilId} onChange={(e) => setFunilId(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Selecione o funil</option>
              {funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#667781' }}>Chip para envio</label>
            <select value={chipId} onChange={(e) => setChipId(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Selecione o chip</option>
              {chips.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm" style={{ background: '#f0f2f5', color: '#667781' }}>Cancelar</button>
          <button
            onClick={ativar}
            disabled={ativando}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00a884', color: '#fff' }}
          >
            <Play size={14} /> {ativando ? 'Ativando...' : 'Ativar Funil'}
          </button>
        </div>
      </div>
    </div>
  );
}
