import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GitBranch, Copy, Trash2, Edit2, Pencil } from 'lucide-react';
import api from '../api';

export default function Funis() {
  const [funis, setFunis] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', descricao: '' });
  const [renomeando, setRenomeando] = useState(null); // { id, nome }
  const navigate = useNavigate();

  async function carregarFunis() {
    try {
      const res = await api.get('/funis');
      setFunis(res.data);
    } catch (err) {
      console.error('Erro ao carregar funis:', err);
    }
  }

  useEffect(() => { carregarFunis(); }, []);

  async function criarFunil() {
    try {
      const res = await api.post('/funis', form);
      setModalAberto(false);
      setForm({ nome: '', descricao: '' });
      navigate(`/funis/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao criar funil');
    }
  }

  async function toggleFunil(id) {
    try {
      await api.put(`/funis/${id}/toggle`);
      carregarFunis();
    } catch (err) {
      console.error('Erro ao alterar funil:', err);
    }
  }

  async function duplicarFunil(id) {
    try {
      await api.post(`/funis/${id}/duplicar`);
      carregarFunis();
    } catch (err) {
      console.error('Erro ao duplicar funil:', err);
    }
  }

  async function salvarNome() {
    if (!renomeando?.nome.trim()) return;
    try {
      await api.put(`/funis/${renomeando.id}`, { nome: renomeando.nome.trim() });
      setRenomeando(null);
      carregarFunis();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao renomear');
    }
  }

  async function deletarFunil(id) {
    if (!confirm('Deseja realmente deletar este funil?')) return;
    try {
      await api.delete(`/funis/${id}`);
      carregarFunis();
    } catch (err) {
      console.error('Erro ao deletar funil:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Funis de Automação</h1>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Plus size={16} /> Novo Funil
        </button>
      </div>

      {/* Lista de funis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {funis.map((funil) => (
          <div key={funil.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-50">
                  <GitBranch className="text-primary-600" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  {renomeando?.id === funil.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={renomeando.nome}
                        onChange={(e) => setRenomeando({ ...renomeando, nome: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); if (e.key === 'Escape') setRenomeando(null); }}
                        className="text-sm font-semibold border-b border-primary-400 bg-transparent outline-none w-full"
                      />
                      <button onClick={salvarNome} className="text-xs text-primary-600 font-medium shrink-0">OK</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <h3 className="font-semibold text-gray-800 truncate">{funil.nome}</h3>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenomeando({ id: funil.id, nome: funil.nome }); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-600"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                  {funil.descricao && (
                    <p className="text-xs text-gray-500 mt-0.5">{funil.descricao}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <span>{funil._count?.execucoes || 0} execuções</span>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => navigate(`/funis/${funil.id}`)}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary-50 text-primary-600 rounded-lg text-xs hover:bg-primary-100"
              >
                <Edit2 size={12} /> Editar
              </button>
              <button
                onClick={() => duplicarFunil(funil.id)}
                className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 rounded-lg"
                title="Duplicar"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => deletarFunil(funil.id)}
                className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-lg"
                title="Deletar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {funis.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <GitBranch size={48} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum funil criado ainda</p>
          </div>
        )}
      </div>

      {/* Modal de criação */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Novo Funil</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                  placeholder="Funil de Vendas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                  rows={3}
                  placeholder="Descrição do funil..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalAberto(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                Cancelar
              </button>
              <button onClick={criarFunil} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                Criar e Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
