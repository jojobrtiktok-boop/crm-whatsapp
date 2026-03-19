import { useState, useEffect, useCallback } from 'react';
import { Plus, Smartphone, Wifi, WifiOff, BarChart3, Edit2, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useSocketEvent } from '../hooks/useSocket';

export default function Chips() {
  const [chips, setChips] = useState([]);
  const [comparativo, setComparativo] = useState([]);
  const [statusChips, setStatusChips] = useState({});
  const [relatorio, setRelatorio] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [chipEditando, setChipEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', numero: '', instanciaEvolution: '' });

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

  // Atualizar status em tempo real
  const handleChipStatus = useCallback((data) => {
    setStatusChips((prev) => ({ ...prev, [data.instancia]: data.status }));
  }, []);
  useSocketEvent('chip:status', handleChipStatus);

  async function salvarChip() {
    try {
      if (chipEditando) {
        await api.put(`/chips/${chipEditando.id}`, form);
      } else {
        await api.post('/chips', form);
      }
      setModalAberto(false);
      setChipEditando(null);
      setForm({ nome: '', numero: '', instanciaEvolution: '' });
      carregarDados();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao salvar chip');
    }
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
      console.error('Erro ao carregar relatório:', err);
    }
  }

  function editarChip(chip) {
    setChipEditando(chip);
    setForm({ nome: chip.nome, numero: chip.numero, instanciaEvolution: chip.instanciaEvolution });
    setModalAberto(true);
  }

  const formatarMoeda = (valor) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Chips WhatsApp</h1>
        <button
          onClick={() => { setChipEditando(null); setForm({ nome: '', numero: '', instanciaEvolution: '' }); setModalAberto(true); }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Plus size={16} /> Novo Chip
        </button>
      </div>

      {/* Cards dos chips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chips.map((chip) => {
          const status = statusChips[chip.instanciaEvolution];
          const dadosComparativo = comparativo.find((c) => c.chipId === chip.id);

          return (
            <div key={chip.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-100 p-2 rounded-lg">
                    <Smartphone className="text-primary-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{chip.nome}</h3>
                    <p className="text-xs text-gray-500">{chip.numero}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {status === 'online' ? (
                    <Wifi size={14} className="text-green-500" />
                  ) : (
                    <WifiOff size={14} className="text-gray-400" />
                  )}
                  <span className={`text-xs ${status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                    {status || 'N/A'}
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
                <button
                  onClick={() => verRelatorio(chip.id)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  <BarChart3 size={14} /> Relatório
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

      {/* Comparativo em gráfico */}
      {comparativo.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Comparativo de Vendas - Mês</h3>
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

      {/* Modal de relatório */}
      {relatorio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Relatório - {relatorio.chip.nome}</h2>
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
                <span className="text-gray-500">Vendas no Mês</span>
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

      {/* Modal de criação/edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{chipEditando ? 'Editar Chip' : 'Novo Chip'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                  placeholder="Chip 5023"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                <input
                  type="text"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                  placeholder="5511999995023"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instância Evolution API</label>
                <input
                  type="text"
                  value={form.instanciaEvolution}
                  onChange={(e) => setForm({ ...form, instanciaEvolution: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                  placeholder="chip-5023"
                />
              </div>
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
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
