import { useState, useEffect, useCallback } from 'react';
import { Search, X, MessageCircle, ChevronRight, Trash2 } from 'lucide-react';
import api from '../api';
import { useSocketEvent } from '../hooks/useSocket';

const STATUS_COLUNAS = [
  { key: 'novo', label: 'Novo', cor: 'bg-blue-500' },
  { key: 'engajado', label: 'Engajado', cor: 'bg-yellow-500' },
  { key: 'negociando', label: 'Negociando', cor: 'bg-orange-500' },
  { key: 'comprou', label: 'Comprou', cor: 'bg-green-500' },
  { key: 'perdido', label: 'Perdido', cor: 'bg-red-500' },
];

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [tags, setTags] = useState([]);
  const [chips, setChips] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroTag, setFiltroTag] = useState('');
  const [filtroChip, setFiltroChip] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [modoVisualizacao, setModoVisualizacao] = useState('kanban'); // kanban, lista

  async function carregarDados() {
    try {
      const params = {};
      if (busca) params.busca = busca;
      if (filtroTag) params.tagId = filtroTag;
      if (filtroChip) params.chipId = filtroChip;
      params.limite = 200;

      const [resClientes, resTags, resChips] = await Promise.all([
        api.get('/clientes', { params }),
        api.get('/tags'),
        api.get('/chips'),
      ]);

      setClientes(resClientes.data.clientes);
      setTags(resTags.data);
      setChips(resChips.data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  }

  useEffect(() => { carregarDados(); }, [busca, filtroTag, filtroChip]);

  // Atualizar em tempo real
  const handleNovoLead = useCallback(() => { carregarDados(); }, []);
  useSocketEvent('lead:novo', handleNovoLead);
  useSocketEvent('lead:atualizado', handleNovoLead);

  async function abrirDetalhe(cliente) {
    setClienteSelecionado(cliente);
    try {
      const res = await api.get(`/clientes/${cliente.id}/conversas`);
      setConversas(res.data);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    }
  }

  async function excluirCliente(e, clienteId) {
    e.stopPropagation();
    if (!confirm('Excluir este lead? Todas as conversas e vendas vinculadas serão removidas.')) return;
    try {
      await api.delete(`/clientes/${clienteId}`);
      carregarDados();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao excluir');
    }
  }

  async function excluirTodos() {
    if (!confirm(`Excluir TODOS os ${clientes.length} leads? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete('/clientes/todos');
      carregarDados();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao excluir');
    }
  }

  async function mudarStatus(clienteId, novoStatus) {
    try {
      await api.put(`/clientes/${clienteId}`, { status: novoStatus });
      carregarDados();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }

  const clientesPorStatus = (status) => clientes.filter((c) => c.status === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">CRM / Leads</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setModoVisualizacao('kanban')}
            className={`px-3 py-1.5 text-sm rounded-lg ${modoVisualizacao === 'kanban' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setModoVisualizacao('lista')}
            className={`px-3 py-1.5 text-sm rounded-lg ${modoVisualizacao === 'lista' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Lista
          </button>
          {clientes.length > 0 && (
            <button
              onClick={excluirTodos}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
            >
              <Trash2 size={14} /> Excluir Todos
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou número..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border-gray-300 text-sm"
          />
        </div>
        <select
          value={filtroTag}
          onChange={(e) => setFiltroTag(e.target.value)}
          className="rounded-lg border-gray-300 text-sm"
        >
          <option value="">Todas as tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        <select
          value={filtroChip}
          onChange={(e) => setFiltroChip(e.target.value)}
          className="rounded-lg border-gray-300 text-sm"
        >
          <option value="">Todos os chips</option>
          {chips.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      {/* Kanban */}
      {modoVisualizacao === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUNAS.map((col) => (
            <div key={col.key} className="min-w-[280px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${col.cor}`}></div>
                <h3 className="font-semibold text-gray-700">{col.label}</h3>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {clientesPorStatus(col.key).length}
                </span>
              </div>
              <div className="space-y-2">
                {clientesPorStatus(col.key).map((cliente) => (
                  <div
                    key={cliente.id}
                    onClick={() => abrirDetalhe(cliente)}
                    className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-800">{cliente.nome || 'Sem nome'}</p>
                        <p className="text-xs text-gray-500">{cliente.telefone}</p>
                      </div>
                      <button
                        onClick={(e) => excluirCliente(e, cliente.id)}
                        className="shrink-0 text-gray-300 hover:text-red-500 p-0.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {cliente.chipOrigem && (
                      <p className="text-xs text-gray-400 mt-1">{cliente.chipOrigem.nome}</p>
                    )}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {cliente.tags?.map((ct) => (
                        <span
                          key={ct.tag.id}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: ct.tag.cor + '20', color: ct.tag.cor }}
                        >
                          {ct.tag.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Lista */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Chip</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{cliente.nome || 'Sem nome'}</td>
                  <td className="px-4 py-3 text-gray-600">{cliente.telefone}</td>
                  <td className="px-4 py-3 text-gray-600">{cliente.chipOrigem?.nome || '-'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={cliente.status}
                      onChange={(e) => mudarStatus(cliente.id, e.target.value)}
                      className="text-xs rounded border-gray-300"
                    >
                      {STATUS_COLUNAS.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {cliente.tags?.map((ct) => (
                        <span
                          key={ct.tag.id}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: ct.tag.cor + '20', color: ct.tag.cor }}
                        >
                          {ct.tag.nome}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirDetalhe(cliente)}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        onClick={(e) => excluirCliente(e, cliente.id)}
                        className="text-gray-300 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhe do cliente */}
      {clienteSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold">{clienteSelecionado.nome || 'Sem nome'}</h2>
                <p className="text-sm text-gray-500">{clienteSelecionado.telefone}</p>
              </div>
              <button onClick={() => setClienteSelecionado(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Status:</span>
                <select
                  value={clienteSelecionado.status}
                  onChange={(e) => {
                    mudarStatus(clienteSelecionado.id, e.target.value);
                    setClienteSelecionado({ ...clienteSelecionado, status: e.target.value });
                  }}
                  className="text-sm rounded border-gray-300"
                >
                  {STATUS_COLUNAS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Histórico de conversas */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MessageCircle size={16} /> Histórico de Conversas
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto space-y-2">
                  {conversas.length > 0 ? conversas.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.tipo === 'enviada' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                          msg.tipo === 'enviada'
                            ? 'bg-primary-500 text-white'
                            : 'bg-white border border-gray-200 text-gray-800'
                        }`}
                      >
                        <p>{msg.conteudo || `[${msg.tipoMidia}]`}</p>
                        <p className={`text-xs mt-1 ${msg.tipo === 'enviada' ? 'text-primary-100' : 'text-gray-400'}`}>
                          {new Date(msg.criadoEm).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-400 text-center text-sm">Nenhuma conversa</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
