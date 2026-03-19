import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, UserPlus, Shield, Clock, Ban, GitBranch, Play, Pause, Smartphone } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Configuracoes() {
  const [abaAtiva, setAbaAtiva] = useState('funis');
  const { usuario } = useAuth();

  const abas = [
    { key: 'funis', label: 'Funis Ativos', icon: GitBranch },
    { key: 'usuarios', label: 'Usuarios', icon: Shield },
    { key: 'blacklist', label: 'Blacklist', icon: Ban },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Configuracoes</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {abas.map((aba) => (
          <button
            key={aba.key}
            onClick={() => setAbaAtiva(aba.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              abaAtiva === aba.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <aba.icon size={16} />
            {aba.label}
          </button>
        ))}
      </div>

      {abaAtiva === 'funis' && <ConfigFunis />}
      {abaAtiva === 'usuarios' && <ConfigUsuarios />}
      {abaAtiva === 'blacklist' && <ConfigBlacklist />}
    </div>
  );
}

function ConfigFunis() {
  const [funis, setFunis] = useState([]);
  const [chips, setChips] = useState([]);
  const [vinculacoes, setVinculacoes] = useState([]);
  const [chipSelecionado, setChipSelecionado] = useState('');
  const [funilSelecionado, setFunilSelecionado] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      const [resFunis, resChips, resConfigs] = await Promise.all([
        api.get('/funis'),
        api.get('/chips'),
        api.get('/configuracoes'),
      ]);
      setFunis(resFunis.data);
      setChips(resChips.data);

      // Carregar vinculacoes salvas
      const vincs = resConfigs.data.funis_vinculados;
      if (vincs) {
        try {
          setVinculacoes(JSON.parse(vincs));
        } catch {
          setVinculacoes([]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function adicionarVinculacao() {
    if (!chipSelecionado || !funilSelecionado) {
      alert('Selecione um chip e um funil');
      return;
    }

    // Verificar se ja existe vinculacao para esse chip
    const jaExiste = vinculacoes.find(v => v.chipId === parseInt(chipSelecionado));
    if (jaExiste) {
      alert('Este chip ja tem um funil vinculado. Remova primeiro.');
      return;
    }

    const novaVinculacao = {
      chipId: parseInt(chipSelecionado),
      funilId: parseInt(funilSelecionado),
      ativo: true,
    };

    const novasVinculacoes = [...vinculacoes, novaVinculacao];
    await salvarVinculacoes(novasVinculacoes);
    setChipSelecionado('');
    setFunilSelecionado('');
  }

  async function toggleVinculacao(index) {
    const novasVinculacoes = [...vinculacoes];
    novasVinculacoes[index].ativo = !novasVinculacoes[index].ativo;
    await salvarVinculacoes(novasVinculacoes);
  }

  async function removerVinculacao(index) {
    const novasVinculacoes = vinculacoes.filter((_, i) => i !== index);
    await salvarVinculacoes(novasVinculacoes);
  }

  async function salvarVinculacoes(novasVinculacoes) {
    setSalvando(true);
    try {
      await api.put('/configuracoes', {
        funis_vinculados: JSON.stringify(novasVinculacoes),
      });
      setVinculacoes(novasVinculacoes);
    } catch (err) {
      alert('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  function getNomeChip(chipId) {
    return chips.find(c => c.id === chipId)?.nome || `Chip #${chipId}`;
  }

  function getNomeFunil(funilId) {
    return funis.find(f => f.id === funilId)?.nome || `Funil #${funilId}`;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h3 className="font-semibold text-gray-800 mb-2">Ativar Funis por Chip</h3>
      <p className="text-xs text-gray-500 mb-4">
        Vincule um funil a um chip. Quando uma nova mensagem chegar nesse chip, o funil sera iniciado automaticamente para o lead (uma vez por pessoa).
      </p>

      {/* Formulario de vinculacao */}
      <div className="flex gap-2 mb-4">
        <select
          value={chipSelecionado}
          onChange={(e) => setChipSelecionado(e.target.value)}
          className="flex-1 rounded-lg border-gray-300 text-sm"
        >
          <option value="">Selecione o Chip</option>
          {chips.filter(c => c.ativo !== false).map((chip) => (
            <option key={chip.id} value={chip.id}>{chip.nome} ({chip.numero})</option>
          ))}
        </select>
        <select
          value={funilSelecionado}
          onChange={(e) => setFunilSelecionado(e.target.value)}
          className="flex-1 rounded-lg border-gray-300 text-sm"
        >
          <option value="">Selecione o Funil</option>
          {funis.map((funil) => (
            <option key={funil.id} value={funil.id}>{funil.nome}</option>
          ))}
        </select>
        <button
          onClick={adicionarVinculacao}
          disabled={salvando}
          className="bg-primary-600 text-white px-4 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Lista de vinculacoes */}
      <div className="space-y-2">
        {vinculacoes.map((vinc, index) => (
          <div key={index} className="flex items-center justify-between py-3 px-3 border border-gray-100 rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${vinc.ativo ? 'bg-green-100' : 'bg-gray-200'}`}>
                <Smartphone size={14} className={vinc.ativo ? 'text-green-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm font-medium">{getNomeChip(vinc.chipId)}</p>
                <p className="text-xs text-gray-500">
                  <GitBranch size={10} className="inline mr-1" />
                  {getNomeFunil(vinc.funilId)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleVinculacao(index)}
                className={`p-1.5 rounded-lg ${vinc.ativo ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}
                title={vinc.ativo ? 'Pausar' : 'Ativar'}
              >
                {vinc.ativo ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <span className={`text-xs px-2 py-0.5 rounded-full ${vinc.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {vinc.ativo ? 'Ativo' : 'Pausado'}
              </span>
              <button
                onClick={() => removerVinculacao(index)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {vinculacoes.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            Nenhum funil vinculado. Selecione um chip e um funil acima para ativar.
          </p>
        )}
      </div>
    </div>
  );
}

function ConfigGeral() {
  const [configs, setConfigs] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/configuracoes').then((res) => setConfigs(res.data)).catch(console.error);
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/configuracoes', configs);
      alert('Configuracoes salvas!');
    } catch (err) {
      alert('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h3 className="font-semibold text-gray-800 mb-4">Horario de Funcionamento</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Inicio</label>
            <input
              type="time"
              value={configs.horario_inicio || '08:00'}
              onChange={(e) => setConfigs({ ...configs, horario_inicio: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Fim</label>
            <input
              type="time"
              value={configs.horario_fim || '22:00'}
              onChange={(e) => setConfigs({ ...configs, horario_fim: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Dias de Funcionamento</label>
          <input
            type="text"
            value={configs.dias_funcionamento || ''}
            onChange={(e) => setConfigs({ ...configs, dias_funcionamento: e.target.value })}
            className="w-full rounded-lg border-gray-300 text-sm"
            placeholder="seg,ter,qua,qui,sex,sab"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Mensagem Fora do Horario</label>
          <textarea
            value={configs.mensagem_fora_horario || ''}
            onChange={(e) => setConfigs({ ...configs, mensagem_fora_horario: e.target.value })}
            className="w-full rounded-lg border-gray-300 text-sm"
            rows={3}
          />
        </div>
      </div>

      <button
        onClick={salvar}
        disabled={salvando}
        className="mt-4 flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
      >
        <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}

function ConfigUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'operador' });

  useEffect(() => {
    api.get('/usuarios').then((res) => setUsuarios(res.data)).catch(console.error);
  }, []);

  async function criarUsuario() {
    try {
      await api.post('/usuarios', form);
      setModalAberto(false);
      setForm({ nome: '', email: '', senha: '', role: 'operador' });
      const res = await api.get('/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao criar usuario');
    }
  }

  async function desativarUsuario(id) {
    if (!confirm('Desativar este usuario?')) return;
    try {
      await api.delete(`/usuarios/${id}`);
      const res = await api.get('/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao desativar');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Usuarios</h3>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700"
        >
          <UserPlus size={14} /> Novo
        </button>
      </div>

      <div className="space-y-2">
        {usuarios.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium">{u.nome}</p>
              <p className="text-xs text-gray-500">{u.email} - {u.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {u.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <button onClick={() => desativarUsuario(u.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Novo Usuario</h2>
            <div className="space-y-3">
              <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm" placeholder="Nome" />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm" placeholder="Email" />
              <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm" placeholder="Senha" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border-gray-300 text-sm">
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalAberto(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">Cancelar</button>
              <button onClick={criarUsuario} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigBlacklist() {
  const [lista, setLista] = useState([]);
  const [telefone, setTelefone] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    api.get('/blacklist').then((res) => setLista(res.data)).catch(console.error);
  }, []);

  async function adicionar() {
    if (!telefone) return;
    try {
      await api.post('/blacklist', { telefone, motivo });
      setTelefone('');
      setMotivo('');
      const res = await api.get('/blacklist');
      setLista(res.data);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao adicionar');
    }
  }

  async function remover(id) {
    try {
      await api.delete(`/blacklist/${id}`);
      const res = await api.get('/blacklist');
      setLista(res.data);
    } catch (err) {
      console.error('Erro ao remover:', err);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h3 className="font-semibold text-gray-800 mb-4">Numeros Bloqueados</h3>

      <div className="flex gap-2 mb-4">
        <input type="text" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="flex-1 rounded-lg border-gray-300 text-sm" placeholder="Numero" />
        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="flex-1 rounded-lg border-gray-300 text-sm" placeholder="Motivo (opcional)" />
        <button onClick={adicionar} className="bg-red-600 text-white px-4 rounded-lg text-sm hover:bg-red-700">
          <Plus size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {lista.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium">{item.telefone}</p>
              {item.motivo && <p className="text-xs text-gray-500">{item.motivo}</p>}
            </div>
            <button onClick={() => remover(item.id)} className="text-gray-400 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum numero bloqueado</p>}
      </div>
    </div>
  );
}
