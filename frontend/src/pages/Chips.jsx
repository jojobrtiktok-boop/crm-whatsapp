import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Smartphone, Wifi, WifiOff, BarChart3, Edit2, Trash2, QrCode, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useSocketEvent } from '../hooks/useSocket';

export default function Chips() {
  const [chips, setChips] = useState([]);
  const [comparativo, setComparativo] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [chipEditando, setChipEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', numero: '' });
  const [qrCode, setQrCode] = useState(null);
  const [qrChipId, setQrChipId] = useState(null);
  const [qrCarregando, setQrCarregando] = useState(false);
  const [qrConectado, setQrConectado] = useState(false);
  const intervalRef = useRef(null);

  async function carregarDados() {
    try {
      const [resChips, resComparativo] = await Promise.all([
        api.get('/chips'),
        api.get('/dashboard/comparativo-chips', { params: { periodo: 'mes' } }),
      ]);
      setChips(resChips.data);
      setComparativo(resComparativo.data);
    } catch (err) {
      console.error('Erro ao carregar chips:', err);
    }
  }

  useEffect(() => { carregarDados(); }, []);

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Atualizar status em tempo real
  const handleChipStatus = useCallback((data) => {
    carregarDados();
  }, []);
  useSocketEvent('chip:status', handleChipStatus);

  async function salvarChip() {
    try {
      if (chipEditando) {
        await api.put(`/chips/${chipEditando.id}`, form);
        setModalAberto(false);
        setChipEditando(null);
        setForm({ nome: '', numero: '' });
        carregarDados();
      } else {
        const res = await api.post('/chips', form);
        setModalAberto(false);
        setForm({ nome: '', numero: '' });
        carregarDados();
        // Abrir QR Code automaticamente apos criar
        abrirQRCode(res.data.id);
      }
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao salvar chip');
    }
  }

  async function abrirQRCode(chipId) {
    setQrChipId(chipId);
    setQrCode(null);
    setQrConectado(false);
    setQrCarregando(true);

    try {
      const res = await api.get(`/chips/${chipId}/qrcode`);
      const qrData = res.data?.base64 || res.data?.qrcode?.base64 || res.data?.code || res.data?.pairingCode || null;

      if (qrData) {
        // Se for base64 de imagem
        if (qrData.startsWith('data:image')) {
          setQrCode(qrData);
        } else if (qrData.length > 100) {
          // Provavelmente base64 sem prefixo
          setQrCode(`data:image/png;base64,${qrData}`);
        } else {
          // Codigo de pareamento
          setQrCode(qrData);
        }
      } else {
        // Pode ser que ja esta conectado
        setQrCode(null);
      }

      // Iniciar polling para verificar se conectou
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(`/chips/${chipId}/status`);
          const state = statusRes.data?.state || statusRes.data?.instance?.state;
          if (state === 'open' || state === 'connected') {
            setQrConectado(true);
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            // Configurar webhook automaticamente
            try {
              await api.post(`/chips/${chipId}/webhook`);
            } catch {}
            carregarDados();
          }
        } catch {}
      }, 3000);

    } catch (err) {
      console.error('Erro QR:', err);
      setQrCode('erro');
    } finally {
      setQrCarregando(false);
    }
  }

  async function recarregarQR() {
    if (qrChipId) abrirQRCode(qrChipId);
  }

  function fecharQR() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setQrChipId(null);
    setQrCode(null);
    setQrConectado(false);
  }

  async function desativarChip(id) {
    if (!confirm('Deseja desativar este chip?')) return;
    try {
      await api.delete(`/chips/${id}`);
      carregarDados();
    } catch (err) {
      console.error('Erro ao desativar chip:', err);
    }
  }

  async function verRelatorio(chipId) {
    try {
      const res = await api.get(`/chips/${chipId}/relatorio`);
      setRelatorio(res.data);
    } catch (err) {
      console.error('Erro ao carregar relatorio:', err);
    }
  }

  function editarChip(chip) {
    setChipEditando(chip);
    setForm({ nome: chip.nome, numero: chip.numero });
    setModalAberto(true);
  }

  function getStatusLabel(status) {
    if (status === 'open' || status === 'connected') return 'Conectado';
    if (status === 'connecting') return 'Conectando...';
    return 'Desconectado';
  }

  function getStatusColor(status) {
    if (status === 'open' || status === 'connected') return 'text-green-500';
    if (status === 'connecting') return 'text-yellow-500';
    return 'text-gray-400';
  }

  const formatarMoeda = (valor) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Chips WhatsApp</h1>
        <button
          onClick={() => { setChipEditando(null); setForm({ nome: '', numero: '' }); setModalAberto(true); }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Plus size={16} /> Novo Chip
        </button>
      </div>

      {/* Cards dos chips */}
      {chips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Smartphone size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhum chip cadastrado</h3>
          <p className="text-sm text-gray-400 mb-4">Clique em "Novo Chip" para adicionar seu primeiro WhatsApp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chips.map((chip) => {
            const status = chip.statusConexao;
            const isConectado = status === 'open' || status === 'connected';
            const dadosComparativo = comparativo.find((c) => c.chipId === chip.id);

            return (
              <div key={chip.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isConectado ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Smartphone className={isConectado ? 'text-green-600' : 'text-gray-400'} size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{chip.nome}</h3>
                      <p className="text-xs text-gray-500">{chip.numero}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isConectado ? (
                      <Wifi size={14} className="text-green-500" />
                    ) : (
                      <WifiOff size={14} className="text-gray-400" />
                    )}
                    <span className={`text-xs ${getStatusColor(status)}`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-800">{dadosComparativo?.vendas || 0}</p>
                    <p className="text-xs text-gray-500">Vendas</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-green-600">{formatarMoeda(dadosComparativo?.valor)}</p>
                    <p className="text-xs text-gray-500">Faturado</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!isConectado && (
                    <button
                      onClick={() => abrirQRCode(chip.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium"
                    >
                      <QrCode size={14} /> Conectar
                    </button>
                  )}
                  <button
                    onClick={() => verRelatorio(chip.id)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    <BarChart3 size={14} /> Relatorio
                  </button>
                  <button
                    onClick={() => editarChip(chip)}
                    className="flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => desativarChip(chip.id)}
                    className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comparativo em grafico */}
      {comparativo.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Comparativo de Vendas - Mes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparativo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="chip" />
              <YAxis />
              <Tooltip formatter={(value, name) => [name === 'valor' ? formatarMoeda(value) : value, name === 'valor' ? 'Valor' : 'Quantidade']} />
              <Bar dataKey="vendas" fill="#3b82f6" name="Vendas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leads" fill="#22c55e" name="Leads" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modal QR Code */}
      {qrChipId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 text-center">
            {qrConectado ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={40} className="text-green-500" />
                </div>
                <h2 className="text-lg font-bold text-green-600 mb-2">WhatsApp Conectado!</h2>
                <p className="text-sm text-gray-500 mb-4">Seu chip esta pronto para enviar e receber mensagens.</p>
                <button
                  onClick={fecharQR}
                  className="w-full py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  Fechar
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold mb-2">Conectar WhatsApp</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Abra o WhatsApp no celular, va em Aparelhos conectados e escaneie o QR Code
                </p>

                <div className="bg-gray-50 rounded-xl p-4 mb-4 min-h-[280px] flex items-center justify-center">
                  {qrCarregando ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={32} className="text-primary-600 animate-spin" />
                      <span className="text-sm text-gray-500">Gerando QR Code...</span>
                    </div>
                  ) : qrCode === 'erro' ? (
                    <div className="flex flex-col items-center gap-2">
                      <X size={32} className="text-red-400" />
                      <span className="text-sm text-red-500">Erro ao gerar QR Code</span>
                    </div>
                  ) : qrCode && qrCode.startsWith('data:image') ? (
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  ) : qrCode ? (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Codigo de pareamento:</p>
                      <p className="text-2xl font-mono font-bold text-primary-600 tracking-wider">{qrCode}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <QrCode size={32} className="text-gray-300" />
                      <span className="text-sm text-gray-400">Clique em recarregar</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={fecharQR}
                    className="flex-1 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={recarregarQR}
                    disabled={qrCarregando}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={qrCarregando ? 'animate-spin' : ''} /> Recarregar
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  O QR Code expira em 45 segundos. Clique em recarregar se expirar.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de relatorio */}
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
                <span className="font-semibold">{relatorio.dia.vendas} ({formatarMoeda(relatorio.dia.valor)})</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Vendas na Semana</span>
                <span className="font-semibold">{relatorio.semana.vendas} ({formatarMoeda(relatorio.semana.valor)})</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Vendas no Mes</span>
                <span className="font-semibold">{relatorio.mes.vendas} ({formatarMoeda(relatorio.mes.valor)})</span>
              </div>
            </div>
            <button
              onClick={() => setRelatorio(null)}
              className="w-full mt-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de criacao/edicao */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{chipEditando ? 'Editar Chip' : 'Novo Chip'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Chip</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                  placeholder="Ex: Chip Vendas 01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero do WhatsApp</label>
                <input
                  type="text"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                  placeholder="5511999995023"
                />
              </div>
              {!chipEditando && (
                <p className="text-xs text-gray-400">
                  Apos criar, o QR Code aparecera automaticamente para voce conectar o WhatsApp.
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setModalAberto(false)}
                className="flex-1 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={salvarChip}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                {chipEditando ? 'Salvar' : 'Criar e Conectar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
