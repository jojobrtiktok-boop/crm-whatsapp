import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Users, ShoppingCart, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api';
import { useSocketEvent } from '../hooks/useSocket';

const CORES_GRAFICO = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [resumo, setResumo] = useState(null);
  const [comparativo, setComparativo] = useState([]);
  const [vendasRecentes, setVendasRecentes] = useState([]);
  const [periodo, setPeriodo] = useState('mes');
  const [carregando, setCarregando] = useState(true);

  async function carregarDados() {
    try {
      const [resResumo, resComparativo, resVendas] = await Promise.all([
        api.get('/dashboard/resumo'),
        api.get('/dashboard/comparativo-chips', { params: { periodo } }),
        api.get('/dashboard/vendas-recentes'),
      ]);
      setResumo(resResumo.data);
      setComparativo(resComparativo.data);
      setVendasRecentes(resVendas.data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregarDados(); }, [periodo]);

  // Atualizar em tempo real quando nova venda é confirmada
  const handleVendaConfirmada = useCallback(() => { carregarDados(); }, []);
  useSocketEvent('venda:confirmada', handleVendaConfirmada);

  if (carregando) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  const formatarMoeda = (valor) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="rounded-lg border-gray-300 text-sm"
        >
          <option value="dia">Hoje</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mês</option>
        </select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          titulo="Vendas do Dia"
          valor={resumo?.dia?.vendas || 0}
          subtitulo={formatarMoeda(resumo?.dia?.valor)}
          icone={ShoppingCart}
          cor="bg-green-500"
        />
        <Card
          titulo="Vendas do Mês"
          valor={resumo?.mes?.vendas || 0}
          subtitulo={formatarMoeda(resumo?.mes?.valor)}
          icone={DollarSign}
          cor="bg-blue-500"
        />
        <Card
          titulo="Leads Hoje"
          valor={resumo?.dia?.leads || 0}
          subtitulo={`${resumo?.mes?.leads || 0} no mês`}
          icone={Users}
          cor="bg-amber-500"
        />
        <Card
          titulo="Taxa de Conversão"
          valor={`${resumo?.geral?.taxaConversao || 0}%`}
          subtitulo={`${resumo?.geral?.totalVendas || 0} vendas total`}
          icone={TrendingUp}
          cor="bg-purple-500"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparativo por chip */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Vendas por Chip</h3>
          {comparativo.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparativo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="chip" />
                <YAxis />
                <Tooltip formatter={(value) => formatarMoeda(value)} />
                <Bar dataKey="valor" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sem dados para exibir</p>
          )}
        </div>

        {/* Distribuição de leads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Leads por Chip</h3>
          {comparativo.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={comparativo}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="leads"
                  nameKey="chip"
                  label={({ chip, leads }) => `${chip}: ${leads}`}
                >
                  {comparativo.map((_, index) => (
                    <Cell key={index} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sem dados para exibir</p>
          )}
        </div>
      </div>

      {/* Vendas recentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Vendas Recentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium">Chip</th>
                <th className="pb-3 font-medium">Valor</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {vendasRecentes.map((venda) => (
                <tr key={venda.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3">{venda.cliente?.nome || 'Sem nome'}</td>
                  <td className="py-3">{venda.chip?.nome}</td>
                  <td className="py-3 font-medium">{formatarMoeda(venda.valor)}</td>
                  <td className="py-3">
                    <StatusBadge status={venda.status} />
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(venda.criadoEm).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {vendasRecentes.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">Nenhuma venda encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ titulo, valor, subtitulo, icone: Icone, cor }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{titulo}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{valor}</p>
          <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>
        </div>
        <div className={`${cor} text-white p-3 rounded-lg`}>
          <Icone size={24} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cores = {
    pendente: 'bg-yellow-100 text-yellow-700',
    confirmado: 'bg-green-100 text-green-700',
    cancelado: 'bg-red-100 text-red-700',
    reembolsado: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}
