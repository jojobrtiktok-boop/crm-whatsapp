import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Smartphone, Wifi, WifiOff, BarChart3, Trash2, QrCode, RefreshCw, Check, X, Loader2, Hash } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useSocketEvent } from '../hooks/useSocket';

export default function Chips() {
  const [chips, setChips] = useState([]);
  const [comparativo, setComparativo] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [criando, setCriando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  // Estado do modal de conexão
  const [modalConexao, setModalConexao] = useState(null); // { chipId, chipNome }
  const [metodo, setMetodo] = useState(null); // 'qr' | 'pairing'
  const [qrCode, setQrCode] = useState(null);
  const [pairingTelefone, setPairingTelefone] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [conectado, setConectado] = useState(false);
  const intervalRef = useRef(null);

  async function carregarDados() {
    try {
      const [resChips, resComp] = await Promise.all([
        api.get('/chips'),
        api.get('/dashboard/comparativo-chips', { params: { periodo: 'mes' } }),
      ]);
      setChips(resChips.data);
      setComparativo(resComp.data);
    } catch (err) {
      console.error('Erro ao carregar chips:', err);
    }
  }

  useEffect(() => { carregarDados(); }, []);
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const handleChipStatus = useCallback(() => { carregarDados(); }, []);
  useSocketEvent('chip:status', handleChipStatus);

  async function criarChip() {
    if (!nomeNovo.trim()) return;
    setSalvandoNovo(true);
    try {
      const res = await api.post('/chips', { nome: nomeNovo.trim() });
      setNomeNovo('');
      setCriando(false);
      carregarDados();
      // Abrir modal de conexão automaticamente
      abrirModalConexao(res.data.id, res.data.nome);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao criar chip');
    } finally {
      setSalvandoNovo(false);
    }
  }

  function abrirModalConexao(chipId, chipNome) {
    setModalConexao({ chipId, chipNome });
    setMetodo(null);
    setQrCode(null);
    setPairingCode(null);
    setPairingTelefone('');
    setConectado(false);
    setCarregando(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  function fecharModal() {
    setModalConexao(null);
    setMetodo(null);
    setQrCode(null);
    setPairingCode(null);
    setConectado(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function iniciarPolling(chipId) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/chips/${chipId}/status`);
        const state = res.data?.state || res.data?.instance?.state;
        if (state === 'open' || state === 'connected') {
          setConectado(true);
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          // Configurar webhook
          try { await api.post(`/chips/${chipId}/webhook`); } catch {}
          carregarDados();
        }
      } catch {}
    }, 3000);
  }

  async function carregarQR() {
    if (!modalConexao) return;
    setCarregando(true);
    setQrCode(null);
    try {
      const res = await api.get(`/chips/${modalConexao.chipId}/qrcode`);
      if (res.data?.conectado) {
        setConectado(true);
        return;
      }
      const base64 = res.data?.base64;
      if (base64) {
        const src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        setQrCode(src);
        iniciarPolling(modalConexao.chipId);
      } else {
        setQrCode('erro');
      }
    } catch (err) {
      console.error('Erro QR:', err);
      setQrCode('erro');
    } finally {
      setCarregando(false);
    }
  }

  async function gerarPairingCode() {
    if (!modalConexao || !pairingTelefone.trim()) return;
    setCarregando(true);
    setPairingCode(null);
    try {
      const res = await api.post(`/chips/${modalConexao.chipId}/pairingcode`, {
        telefone: pairingTelefone.replace(/\D/g, ''),
      });
      const code = res.data?.code;
      if (code) {
        setPairingCode(code);
        iniciarPolling(modalConexao.chipId);
      } else {
        alert('Nao foi possivel gerar o codigo. Verifique o numero e tente novamente.');
      }
    } catch (err) {
      alert(err.response?.data?.erro || err.response?.data?.detalhe || 'Erro ao gerar codigo');
    } finally {
      setCarregando(false);
    }
  }

  async function excluirChip(id) {
    if (!confirm('Tem certeza que deseja excluir este chip? Todos os dados vinculados serao removidos.')) return;
    try {
      await api.delete(`/chips/${id}`);
      carregarDados();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao excluir chip');
    }
  }

  async function verRelatorio(chipId) {
    try {
      const res = await api.get(`/chips/${chipId}/relatorio`);
      setRelatorio(res.data);
    } catch {}
  }

  function getStatusLabel(s) {
    if (s === 'open' || s === 'connected') return 'Conectado';
    if (s === 'connecting') return 'Conectando...';
    return 'Desconectado';
  }

  function getStatusColor(s) {
    if (s === 'open' || s === 'connected') return 'text-green-500';
    if (s === 'connecting') return 'text-yellow-500';
    return 'text-gray-400';
  }

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Chips WhatsApp</h1>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Plus size={16} /> Novo Chip
        </button>
      </div>

      {/* Form inline de criacao */}
      {criando && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <input
            type="text"
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criarChip()}
            autoFocus
            className="flex-1 rounded-lg border-gray-300 text-sm"
            placeholder="Nome do chip (ex: Vendas 01)"
          />
          <button
            onClick={criarChip}
            disabled={salvandoNovo || !nomeNovo.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {salvandoNovo ? 'Criando...' : 'Criar'}
          </button>
          <button
            onClick={() => { setCriando(false); setNomeNovo(''); }}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Cards dos chips */}
      {chips.length === 0 && !criando ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Smartphone size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhum chip cadastrado</h3>
          <p className="text-sm text-gray-400 mb-4">Clique em "Novo Chip" para adicionar seu primeiro WhatsApp</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {chips.map((chip) => {
            const isConectado = chip.statusConexao === 'open' || chip.statusConexao === 'connected';
            const dadosComp = comparativo.find((c) => c.chipId === chip.id);
            return (
              <div key={chip.id} className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                {/* Status + nome */}
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 ${isConectado ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Smartphone className={isConectado ? 'text-green-600' : 'text-gray-400'} size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm truncate">{chip.nome}</h3>
                    <div className="flex items-center gap-0.5">
                      {isConectado ? <Wifi size={10} className="text-green-500" /> : <WifiOff size={10} className="text-gray-400" />}
                      <span className={`text-[10px] ${getStatusColor(chip.statusConexao)}`}>{getStatusLabel(chip.statusConexao)}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-1.5">
                  <div className="flex-1 bg-gray-50 rounded-lg p-1.5 text-center">
                    <p className="text-sm font-bold text-gray-800">{dadosComp?.vendas || 0}</p>
                    <p className="text-[10px] text-gray-500">Vendas</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-1.5 text-center">
                    <p className="text-sm font-bold text-green-600">{dadosComp?.leads || chip._count?.clientes || 0}</p>
                    <p className="text-[10px] text-gray-500">Leads</p>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-1">
                  <button
                    onClick={() => abrirModalConexao(chip.id, chip.nome)}
                    className={`flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg font-medium ${isConectado ? 'bg-gray-50 text-gray-500 hover:bg-gray-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                  >
                    <QrCode size={11} /> {isConectado ? 'Recon.' : 'Conectar'}
                  </button>
                  <button
                    onClick={() => verRelatorio(chip.id)}
                    className="flex items-center justify-center p-1.5 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    <BarChart3 size={12} />
                  </button>
                  <button
                    onClick={() => excluirChip(chip.id)}
                    className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 rounded-lg"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grafico comparativo */}
      {comparativo.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Comparativo de Vendas - Mes</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={comparativo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="chip" />
              <YAxis />
              <Tooltip formatter={(v, n) => [n === 'valor' ? fmt(v) : v, n === 'valor' ? 'Valor' : 'Quantidade']} />
              <Bar dataKey="vendas" fill="#3b82f6" name="Vendas" radius={[4,4,0,0]} />
              <Bar dataKey="leads" fill="#22c55e" name="Leads" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modal de conexao */}
      {modalConexao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 text-center">
            {conectado ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={40} className="text-green-500" />
                </div>
                <h2 className="text-lg font-bold text-green-600 mb-2">WhatsApp Conectado!</h2>
                <p className="text-sm text-gray-500 mb-4">Chip pronto para enviar e receber mensagens.</p>
                <button onClick={fecharModal} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm">
                  Fechar
                </button>
              </>
            ) : !metodo ? (
              <>
                <h2 className="text-lg font-bold mb-1">Conectar WhatsApp</h2>
                <p className="text-sm text-gray-500 mb-6">{modalConexao.chipNome}</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setMetodo('qr'); carregarQR(); }}
                    className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 text-left"
                  >
                    <div className="bg-primary-100 p-2 rounded-lg">
                      <QrCode size={24} className="text-primary-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">QR Code</p>
                      <p className="text-xs text-gray-500">Escanear pelo WhatsApp do celular</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setMetodo('pairing')}
                    className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 text-left"
                  >
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Hash size={24} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Codigo de Pareamento</p>
                      <p className="text-xs text-gray-500">Receber codigo no proprio WhatsApp</p>
                    </div>
                  </button>
                </div>
                <button onClick={fecharModal} className="w-full mt-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                  Cancelar
                </button>
              </>
            ) : metodo === 'qr' ? (
              <>
                <h2 className="text-lg font-bold mb-1">Escanear QR Code</h2>
                <p className="text-xs text-gray-500 mb-4">WhatsApp → Aparelhos conectados → Conectar aparelho</p>
                <div className="bg-gray-50 rounded-xl p-4 mb-4 min-h-[260px] flex items-center justify-center">
                  {carregando ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={32} className="text-primary-600 animate-spin" />
                      <span className="text-sm text-gray-500">Gerando QR Code...</span>
                    </div>
                  ) : qrCode === 'erro' ? (
                    <div className="flex flex-col items-center gap-2">
                      <X size={32} className="text-red-400" />
                      <span className="text-sm text-red-500">Erro ao gerar QR Code</span>
                      <p className="text-xs text-gray-400">Verifique se a Evolution API esta online</p>
                    </div>
                  ) : qrCode ? (
                    <img src={qrCode} alt="QR Code" className="w-56 h-56" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <QrCode size={32} className="text-gray-300" />
                      <span className="text-sm text-gray-400">Aguardando...</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMetodo(null)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">
                    Voltar
                  </button>
                  <button
                    onClick={carregarQR}
                    disabled={carregando}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Recarregar
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">QR Code expira em 45 segundos</p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold mb-1">Codigo de Pareamento</h2>
                <p className="text-xs text-gray-500 mb-4">Digite o numero do WhatsApp que vai conectar</p>
                {!pairingCode ? (
                  <>
                    <input
                      type="text"
                      value={pairingTelefone}
                      onChange={(e) => setPairingTelefone(e.target.value)}
                      className="w-full rounded-lg border-gray-300 text-sm mb-3"
                      placeholder="5511999995023"
                    />
                    <p className="text-xs text-gray-400 mb-4">Formato: codigo do pais + DDD + numero (sem espacos)</p>
                    <div className="flex gap-2">
                      <button onClick={() => setMetodo(null)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">
                        Voltar
                      </button>
                      <button
                        onClick={gerarPairingCode}
                        disabled={carregando || !pairingTelefone.trim()}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {carregando ? <Loader2 size={14} className="animate-spin" /> : <Hash size={14} />}
                        {carregando ? 'Gerando...' : 'Gerar Codigo'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-green-50 rounded-xl p-6 mb-4">
                      <p className="text-xs text-gray-500 mb-2">Codigo de pareamento:</p>
                      <p className="text-3xl font-mono font-bold text-green-600 tracking-[0.3em]">{pairingCode}</p>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      No WhatsApp, va em <strong>Aparelhos conectados → Conectar → Conectar com numero de telefone</strong> e digite este codigo.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setPairingCode(null)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">
                        Novo codigo
                      </button>
                      <button onClick={fecharModal} className="flex-1 py-2 bg-gray-200 rounded-lg text-sm">
                        Fechar
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal relatorio */}
      {relatorio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Relatorio - {relatorio.chip.nome}</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Total de Clientes</span>
                <span className="font-semibold">{relatorio.totalClientes}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Vendas Hoje</span>
                <span className="font-semibold">{relatorio.dia.vendas} ({fmt(relatorio.dia.valor)})</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Vendas na Semana</span>
                <span className="font-semibold">{relatorio.semana.vendas} ({fmt(relatorio.semana.valor)})</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Vendas no Mes</span>
                <span className="font-semibold">{relatorio.mes.vendas} ({fmt(relatorio.mes.valor)})</span>
              </div>
            </div>
            <button onClick={() => setRelatorio(null)} className="w-full mt-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
