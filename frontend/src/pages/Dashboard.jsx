import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Users, ShoppingCart, TrendingUp, Smartphone, ArrowUp, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api';
import { useSocketEvent } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

const CORES = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const { formatarMoeda } = useAuth();
  const [resumo, setResumo] = useState(null);
  const [comparativo, setComparativo] = useState([]);
  const [chipsResumo, setChipsResumo] = useState([]);
  const [vendasRecentes, setVendasRecentes] = useState([]);
  const [periodo, setPeriodo] = useState('mes');
  const [carregando, setCarregando] = useState(true);

  async function carregarDados() {
    try {
      const [resResumo, resComparativo, resChips, resVendas] = await Promise.all([
        api.get('/dashboard/resumo'),
        api.get('/dashboard/comparativo-chips', { params: { periodo } }),
        api.get('/dashboard/chips-resumo'),
        api.get('/dashboard/vendas-recentes'),
      ]);
      setResumo(resResumo.data);
      setComparativo(resComparativo.data);
      setChipsResumo(resChips.data);
      setVendasRecentes(resVendas.data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregarDados(); }, [periodo]);

  const handleVendaConfirmada = useCallback(() => { carregarDados(); }, []);
  useSocketEvent('venda:confirmada', handleVendaConfirmada);

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visão geral do seu negócio</p>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="rounded-lg border-gray-300 text-sm shadow-sm"
        >
          <option value="dia">Hoje</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mês</option>
        </select>
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          titulo="Faturamento Hoje"
          valor={formatarMoeda(resumo?.dia?.valor)}
          sub={`${resumo?.dia?.vendas || 0} vendas`}
          icone={DollarSign}
          cor="from-green-500 to-emerald-600"
          destaque
        />
        <MetricCard
          titulo={periodo === 'dia' ? 'Vendas Hoje' : periodo === 'semana' ? 'Vendas na Semana' : 'Vendas no Mês'}
          valor={formatarMoeda(resumo?.[periodo]?.valor)}
          sub={`${resumo?.[periodo]?.vendas || 0} pedidos`}
          icone={ShoppingCart}
          cor="from-blue-500 to-blue-600"
        />
        <MetricCard
          titulo="Leads Hoje"
          valor={resumo?.dia?.leads || 0}
          sub={`${resumo?.mes?.leads || 0} no mês`}
          icone={Users}
          cor="from-amber-500 to-orange-500"
        />
        <MetricCard
          titulo="Taxa de Conversão"
          valor={`${resumo?.geral?.taxaConversao || 0}%`}
          sub={`${resumo?.geral?.totalClientes || 0} leads total`}
          icone={TrendingUp}
          cor="from-purple-500 to-violet-600"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-primary-600" /> Vendas por Chip
          </h3>
          {comparativo.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparativo} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="chip" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatarMoeda(v)} width={80} />
                <Tooltip formatter={(value) => formatarMoeda(value)} />
                <Bar dataKey="valor" fill="#22c55e" radius={[6, 6, 0, 0]}>
                  {comparativo.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px] text-gray-400">
              <BarChart2 size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Sem dados para exibir</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={16} className="text-primary-600" /> Leads por Chip
          </h3>
          {comparativo.filter(c => c.leads > 0).length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={comparativo.filter(c => c.leads > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="leads"
                  nameKey="chip"
                >
                  {comparativo.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [v, 'Leads']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px] text-gray-400">
              <Users size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Sem dados</p>
            </div>
          )}
        </div>
      </div>

      {/* Cards de Chips */}
      {chipsResumo.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Smartphone size={16} className="text-primary-600" /> Performance por Chip
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {chipsResumo.map((chip, i) => (
              <ChipCard key={chip.id} chip={chip} cor={CORES[i % CORES.length]} formatarMoeda={formatarMoeda} />
            ))}
          </div>
        </div>
      )}

      {/* Vendas recentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Vendas Recentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium">Chip</th>
                <th className="pb-3 font-medium">Valor</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {vendasRecentes.map((venda) => (
                <tr key={venda.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 font-medium text-gray-800">{venda.cliente?.nome || venda.cliente?.telefone || 'Sem nome'}</td>
                  <td className="py-3 text-gray-600">{venda.chip?.nome}</td>
                  <td className="py-3 font-semibold text-green-700">{formatarMoeda(venda.valor)}</td>
                  <td className="py-3">
                    <StatusBadge status={venda.status} />
                  </td>
                  <td className="py-3 text-gray-400 text-xs">
                    {new Date(venda.criadoEm).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {vendasRecentes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    Nenhuma venda encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ titulo, valor, sub, icone: Icone, cor, destaque }) {
  return (
    <div className={`rounded-xl shadow-sm overflow-hidden ${destaque ? 'ring-2 ring-green-400 ring-offset-1' : 'border border-gray-200'}`}>
      <div className={`bg-gradient-to-br ${cor} p-4 text-white`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-white/80">{titulo}</p>
          <div className="bg-white/20 p-1.5 rounded-lg">
            <Icone size={14} />
          </div>
        </div>
        <p className="text-xl font-bold truncate">{valor}</p>
        <p className="text-xs text-white/70 mt-1 flex items-center gap-1">
          <ArrowUp size={10} /> {sub}
        </p>
      </div>
    </div>
  );
}

function ChipCard({ chip, cor, formatarMoeda }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: cor }} />
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{chip.nome}</p>
          <p className="text-xs text-gray-400">{chip.numero}</p>
        </div>
        <div className="ml-auto">
          <Smartphone size={16} className="text-gray-300" />
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <div className="p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Hoje</p>
          <p className="font-bold text-gray-800 text-sm">{formatarMoeda(chip.dia?.valor)}</p>
          <p className="text-xs text-gray-500">{chip.dia?.vendas || 0} vendas</p>
          <p className="text-xs text-blue-500">{chip.dia?.leads || 0} leads</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">7 dias</p>
          <p className="font-bold text-green-700 text-sm">{formatarMoeda(chip.semana?.valor)}</p>
          <p className="text-xs text-gray-500">{chip.semana?.vendas || 0} vendas</p>
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
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}
