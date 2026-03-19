import { useState, useEffect } from 'react';
import { Download, Filter, Eye, DollarSign } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Vendas() {
  const { formatarMoeda } = useAuth();
  const [vendas, setVendas] = useState([]);
  const [chips, setChips] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ status: '', chipId: '', dataInicio: '', dataFim: '' });
  const [vendaSelecionada, setVendaSelecionada] = useState(null);

  async function carregarVendas() {
    try {
      const params = { pagina, limite: 30 };
      if (filtros.status) params.status = filtros.status;
      if (filtros.chipId) params.chipId = filtros.chipId;
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;

      const [resVendas, resChips] = await Promise.all([
        api.get('/vendas', { params }),
        api.get('/chips'),
      ]);

      setVendas(resVendas.data.vendas);
      setTotal(resVendas.data.total);
      setChips(resChips.data);
    } catch (err) {
      console.error('Erro ao carregar vendas:', err);
    }
  }

  useEffect(() => { carregarVendas(); }, [pagina, filtros]);

  async function exportarCSV() {
    try {
      const params = {};
      if (filtros.status) params.status = filtros.status;
      if (filtros.chipId) params.chipId = filtros.chipId;
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;

      const res = await api.get('/vendas/exportar', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'vendas.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
  }

  async function atualizarStatus(vendaId, novoStatus) {
    try {
      await api.put(`/vendas/${vendaId}`, { status: novoStatus });
      carregarVendas();
    } catch (err) {
      console.error('Erro ao atualizar venda:', err);
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Vendas</h1>
        <button
          onClick={exportarCSV}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap bg-white p-4 rounded-xl border border-gray-200">
        <select
          value={filtros.status}
          onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
          className="rounded-lg border-gray-300 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="confirmado">Confirmado</option>
          <option value="cancelado">Cancelado</option>
          <option value="reembolsado">Reembolsado</option>
        </select>
        <select
          value={filtros.chipId}
          onChange={(e) => setFiltros({ ...filtros, chipId: e.target.value })}
          className="rounded-lg border-gray-300 text-sm"
        >
          <option value="">Todos os chips</option>
          {chips.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <input
          type="date"
          value={filtros.dataInicio}
          onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
          className="rounded-lg border-gray-300 text-sm"
          placeholder="Data início"
        />
        <input
          type="date"
          value={filtros.dataFim}
          onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
          className="rounded-lg border-gray-300 text-sm"
          placeholder="Data fim"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Chip</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((venda) => (
              <tr key={venda.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">#{venda.id}</td>
                <td className="px-4 py-3 font-medium">{venda.cliente?.nome || 'Sem nome'}</td>
                <td className="px-4 py-3 text-gray-600">{venda.chip?.nome}</td>
                <td className="px-4 py-3 font-semibold text-green-600">{formatarMoeda(venda.valor)}</td>
                <td className="px-4 py-3">
                  <select
                    value={venda.status}
                    onChange={(e) => atualizarStatus(venda.id, e.target.value)}
                    className="text-xs rounded border-gray-300"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="reembolsado">Reembolsado</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(venda.criadoEm).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setVendaSelecionada(venda)}
                    className="text-primary-600 hover:text-primary-800"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {vendas.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Nenhuma venda encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {total > 30 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPagina(Math.max(1, pagina - 1))}
            disabled={pagina === 1}
            className="px-3 py-1 text-sm bg-white border rounded-lg disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">Página {pagina}</span>
          <button
            onClick={() => setPagina(pagina + 1)}
            disabled={vendas.length < 30}
            className="px-3 py-1 text-sm bg-white border rounded-lg disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
