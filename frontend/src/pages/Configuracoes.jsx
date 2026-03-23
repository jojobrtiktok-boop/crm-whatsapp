import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, UserPlus, Shield, Clock, Ban, GitBranch, Play, Pause, Smartphone, CreditCard, Tag, Wifi, WifiOff, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Configuracoes() {
  const [abaAtiva, setAbaAtiva] = useState('funis');
  const { usuario } = useAuth();

  const abas = [
    { key: 'funis', label: 'Funis Ativos', icon: GitBranch },
    { key: 'pagamento', label: 'Pagamento', icon: CreditCard },
    { key: 'proxy', label: 'Proxy', icon: Globe },
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
      {abaAtiva === 'pagamento' && <ConfigPagamento />}
      {abaAtiva === 'proxy' && <ConfigProxy />}
      {abaAtiva === 'usuarios' && <ConfigUsuarios />}
      {abaAtiva === 'blacklist' && <ConfigBlacklist />}
    </div>
  );
}

function ConfigFunis() {
  const [funis, setFunis] = useState([]);
  const [chips, setChips] = useState([]);
  const [vinculacoes, setVinculacoes] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [adicionandoFunil, setAdicionandoFunil] = useState(null); // chipId
  const [expandido, setExpandido] = useState({}); // { chipId_funilIdx: bool }

  useEffect(() => { carregarDados(); }, []);

  async function carregarDados() {
    try {
      const [resFunis, resChips, resConfigs] = await Promise.all([
        api.get('/funis'),
        api.get('/chips'),
        api.get('/configuracoes'),
      ]);
      setFunis(resFunis.data);
      setChips(resChips.data);
      const vincs = resConfigs.data.funis_vinculados;
      if (vincs) {
        try { setVinculacoes(JSON.parse(vincs)); } catch { setVinculacoes([]); }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function salvarVinculacoes(novas) {
    setSalvando(true);
    try {
      await api.put('/configuracoes', { funis_vinculados: JSON.stringify(novas) });
      setVinculacoes(novas);
    } catch (err) {
      alert('Erro ao salvar: ' + (err.response?.data?.erro || err.message));
    } finally {
      setSalvando(false);
    }
  }

  function adicionarFunil(chipId, funilId) {
    const jaExiste = vinculacoes.find(v => v.chipId === chipId && v.funilId === funilId);
    if (jaExiste) return;
    const novas = [...vinculacoes, { chipId, funilId, ativo: true, gatilho: 'uma_vez', palavras: [] }];
    salvarVinculacoes(novas);
    setAdicionandoFunil(null);
  }

  function removerVinculacao(chipId, funilId) {
    salvarVinculacoes(vinculacoes.filter(v => !(v.chipId === chipId && v.funilId === funilId)));
  }

  function toggleVinculacao(chipId, funilId) {
    const novas = vinculacoes.map(v =>
      v.chipId === chipId && v.funilId === funilId ? { ...v, ativo: !v.ativo } : v
    );
    salvarVinculacoes(novas);
  }

  function atualizarVinculacao(chipId, funilId, campo, valor) {
    const novas = vinculacoes.map(v =>
      v.chipId === chipId && v.funilId === funilId ? { ...v, [campo]: valor } : v
    );
    salvarVinculacoes(novas);
  }

  function getNomeFunil(funilId) {
    return funis.find(f => f.id === funilId)?.nome || `Funil #${funilId}`;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="font-semibold text-gray-800">Funis por Chip</h3>
        <p className="text-xs text-gray-500 mt-0.5">Cada chip pode ter um ou mais funis. Quando uma mensagem chegar, os funis ativos disparam automaticamente.</p>
      </div>

      {chips.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">Nenhum chip cadastrado. Adicione chips primeiro.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chips.map((chip) => {
          const isConectado = chip.statusConexao === 'open' || chip.statusConexao === 'connected';
          const vincsDoChip = vinculacoes.filter(v => v.chipId === chip.id);
          const funisDisponiveis = funis.filter(f => !vincsDoChip.find(v => v.funilId === f.id));

          return (
            <div key={chip.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Header do chip */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className={`p-1.5 rounded-lg ${isConectado ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Smartphone size={14} className={isConectado ? 'text-green-600' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{chip.nome}</p>
                  <p className={`text-[10px] ${isConectado ? 'text-green-500' : 'text-gray-400'}`}>
                    {isConectado ? 'Conectado' : 'Desconectado'}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{vincsDoChip.length} funil{vincsDoChip.length !== 1 ? 'is' : ''}</span>
              </div>

              {/* Funis vinculados */}
              <div className="divide-y divide-gray-50">
                {vincsDoChip.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Nenhum funil ativo</p>
                )}
                {vincsDoChip.map((vinc) => {
                  const key = `${chip.id}_${vinc.funilId}`;
                  const aberto = expandido[key];
                  return (
                    <div key={vinc.funilId} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <GitBranch size={12} className="text-primary-500 shrink-0" />
                        <span className="text-sm flex-1 truncate">{getNomeFunil(vinc.funilId)}</span>
                        {/* Toggle ativo */}
                        <button
                          onClick={() => toggleVinculacao(chip.id, vinc.funilId)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${vinc.ativo ? 'bg-primary-600' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${vinc.ativo ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                        {/* Expandir config */}
                        <button
                          onClick={() => setExpandido(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button onClick={() => removerVinculacao(chip.id, vinc.funilId)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Config expandida */}
                      {aberto && (
                        <div className="mt-2 ml-5 space-y-2 bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500 w-14 shrink-0">Gatilho</label>
                            <select
                              value={vinc.gatilho || 'uma_vez'}
                              onChange={(e) => atualizarVinculacao(chip.id, vinc.funilId, 'gatilho', e.target.value)}
                              className="text-xs rounded border-gray-300 py-1 flex-1"
                            >
                              <option value="uma_vez">Uma vez por numero</option>
                              <option value="sempre">Sempre (toda mensagem)</option>
                              <option value="palavras">Palavras especificas</option>
                            </select>
                          </div>
                          {(vinc.gatilho || 'uma_vez') === 'palavras' && (
                            <div className="flex items-start gap-2">
                              <label className="text-xs text-gray-500 w-14 shrink-0 pt-1">Palavras</label>
                              <div className="flex-1">
                                <input
                                  type="text"
                                  defaultValue={(vinc.palavras || []).join(', ')}
                                  onBlur={(e) => {
                                    const palavras = e.target.value.split(',').map(p => p.trim()).filter(Boolean);
                                    atualizarVinculacao(chip.id, vinc.funilId, 'palavras', palavras);
                                  }}
                                  className="w-full text-xs rounded border-gray-300 py-1"
                                  placeholder="oi, ola, quero"
                                />
                                <p className="text-[10px] text-gray-400 mt-0.5">Separe por virgula.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Adicionar funil */}
              <div className="px-4 pb-3 pt-1">
                {adicionandoFunil === chip.id ? (
                  <div className="flex gap-2">
                    <select
                      autoFocus
                      className="flex-1 text-xs rounded-lg border-gray-300 py-1.5"
                      defaultValue=""
                      onChange={(e) => e.target.value && adicionarFunil(chip.id, parseInt(e.target.value))}
                    >
                      <option value="">Escolha um funil...</option>
                      {funisDisponiveis.map(f => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                    <button onClick={() => setAdicionandoFunil(null)} className="text-gray-400 hover:text-gray-600 text-xs px-2">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAdicionandoFunil(chip.id)}
                    disabled={funisDisponiveis.length === 0}
                    className="w-full flex items-center justify-center gap-1 text-xs text-primary-600 hover:text-primary-700 py-1.5 border border-dashed border-primary-300 rounded-lg hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} /> Adicionar Funil
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigPagamento() {
  const [chips, setChips] = useState([]);
  const [configs, setConfigs] = useState({});
  const [etiquetas, setEtiquetas] = useState([]);
  const [chipEtiqueta, setChipEtiqueta] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregandoEtiquetas, setCarregandoEtiquetas] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/chips'), api.get('/configuracoes')]).then(([resChips, resCfg]) => {
      setChips(resChips.data);
      const cfg = resCfg.data;
      setConfigs({
        msg_pagamento_confirmado: cfg.msg_pagamento_confirmado || '',
        etiqueta_pagamento_ativa: cfg.etiqueta_pagamento_ativa === 'true',
        etiqueta_pagamento_id: cfg.etiqueta_pagamento_id || '',
        etiqueta_pagamento_instancia: cfg.etiqueta_pagamento_instancia || '',
      });
      // Carregar etiquetas do chip já configurado
      if (cfg.etiqueta_pagamento_instancia) {
        const chipEncontrado = resChips.data.find(c => c.instanciaEvolution === cfg.etiqueta_pagamento_instancia);
        if (chipEncontrado) {
          setChipEtiqueta(String(chipEncontrado.id));
          buscarEtiquetas(chipEncontrado.id);
        }
      }
    }).catch(console.error);
  }, []);

  async function buscarEtiquetas(chipId) {
    if (!chipId) { setEtiquetas([]); return; }
    setCarregandoEtiquetas(true);
    try {
      const res = await api.get(`/chips/${chipId}/etiquetas`);
      setEtiquetas(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEtiquetas([]);
    } finally {
      setCarregandoEtiquetas(false);
    }
  }

  function handleChipEtiquetaChange(chipId) {
    setChipEtiqueta(chipId);
    const chip = chips.find(c => c.id === parseInt(chipId));
    setConfigs(prev => ({ ...prev, etiqueta_pagamento_instancia: chip?.instanciaEvolution || '' }));
    buscarEtiquetas(chipId);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/configuracoes', {
        msg_pagamento_confirmado: configs.msg_pagamento_confirmado,
        etiqueta_pagamento_ativa: configs.etiqueta_pagamento_ativa ? 'true' : 'false',
        etiqueta_pagamento_id: configs.etiqueta_pagamento_id,
        etiqueta_pagamento_instancia: configs.etiqueta_pagamento_instancia,
      });
      alert('Configuracoes salvas!');
    } catch {
      alert('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-6">
      {/* Mensagem de confirmação */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Mensagem de Confirmacao de Pagamento</h3>
        <p className="text-xs text-gray-500 mb-3">
          Mensagem enviada automaticamente ao cliente quando o comprovante e aprovado. Use <code className="bg-gray-100 px-1 rounded">{'{valor}'}</code> para inserir o valor pago. Se vazio, usa o idioma padrao do pais do chip.
        </p>
        <textarea
          value={configs.msg_pagamento_confirmado || ''}
          onChange={(e) => setConfigs(prev => ({ ...prev, msg_pagamento_confirmado: e.target.value }))}
          className="w-full rounded-lg border-gray-300 text-sm"
          rows={4}
          placeholder="Ex: ✅ Pagamento confirmado! Valor: {valor}. Obrigado pela sua compra!"
        />
      </div>

      {/* Etiqueta automática */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">Etiqueta Automatica no WhatsApp</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ao confirmar pagamento, etiqueta o contato no WhatsApp Business automaticamente.
            </p>
          </div>
          <button
            onClick={() => setConfigs(prev => ({ ...prev, etiqueta_pagamento_ativa: !prev.etiqueta_pagamento_ativa }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configs.etiqueta_pagamento_ativa ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configs.etiqueta_pagamento_ativa ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {configs.etiqueta_pagamento_ativa && (
          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Chip para buscar etiquetas</label>
              <select
                value={chipEtiqueta}
                onChange={(e) => handleChipEtiquetaChange(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">Selecione um chip</option>
                {chips.filter(c => c.statusConexao === 'open').map(chip => (
                  <option key={chip.id} value={chip.id}>{chip.nome} ({chip.numero})</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Apenas chips conectados. Requer conta WhatsApp Business.</p>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Etiqueta a aplicar</label>
              {carregandoEtiquetas ? (
                <p className="text-xs text-gray-400">Carregando etiquetas...</p>
              ) : etiquetas.length > 0 ? (
                <select
                  value={configs.etiqueta_pagamento_id || ''}
                  onChange={(e) => setConfigs(prev => ({ ...prev, etiqueta_pagamento_id: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 text-sm"
                >
                  <option value="">Selecione uma etiqueta</option>
                  {etiquetas.map(et => (
                    <option key={et.id} value={et.id}>{et.name || et.id}</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={configs.etiqueta_pagamento_id || ''}
                    onChange={(e) => setConfigs(prev => ({ ...prev, etiqueta_pagamento_id: e.target.value }))}
                    className="w-full rounded-lg border-gray-300 text-sm"
                    placeholder="ID ou nome da etiqueta (ex: 1)"
                  />
                  <p className="text-xs text-gray-400">
                    {chipEtiqueta ? 'Nenhuma etiqueta encontrada. Digite o ID manualmente.' : 'Selecione um chip acima para carregar etiquetas, ou digite o ID manualmente.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={salvar}
        disabled={salvando}
        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
      >
        <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Configuracoes'}
      </button>
    </div>
  );
}

function ConfigProxy() {
  const [proxyUrl, setProxyUrl] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    api.get('/configuracoes').then((res) => {
      setProxyUrl(res.data.proxy_url || '');
    }).catch(console.error);
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/configuracoes', { proxy_url: proxyUrl });
      alert('Proxy salvo!');
    } catch {
      alert('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    setTestando(true);
    setResultado(null);
    try {
      const res = await api.get('/configuracoes/proxy/test');
      setResultado(res.data);
    } catch {
      setResultado({ ok: false, erro: 'Erro ao conectar com o servidor' });
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-5">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Proxy para Chips WhatsApp</h3>
        <p className="text-xs text-gray-500">
          Use um proxy residencial ou 4G para evitar restrições do WhatsApp. Formato: <code className="bg-gray-100 px-1 rounded">http://usuario:senha@host:porta</code>
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">URL do Proxy</label>
        <input
          type="text"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          className="w-full rounded-lg border-gray-300 text-sm font-mono"
          placeholder="http://user:pass@proxy.astron.com:10000"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          onClick={testar}
          disabled={testando}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
        >
          <Globe size={14} /> {testando ? 'Testando...' : 'Testar Proxy'}
        </button>
      </div>

      {resultado && (
        <div className={`rounded-lg p-4 ${resultado.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {resultado.ok ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <Wifi size={16} /> Proxy funcionando
              </div>
              <p className="text-sm text-gray-700">IP: <strong>{resultado.ip}</strong></p>
              <p className="text-sm text-gray-700">País: <strong>{resultado.country} — {resultado.city}</strong></p>
              {resultado.org && <p className="text-sm text-gray-700">Operadora: <strong>{resultado.org}</strong></p>}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <WifiOff size={16} /> Falhou: {resultado.erro}
            </div>
          )}
        </div>
      )}
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

const PAISES = [
  { codigo: 'BR', nome: 'Brasil 🇧🇷', moeda: 'BRL', idioma: 'pt' },
  { codigo: 'AR', nome: 'Argentina 🇦🇷', moeda: 'ARS', idioma: 'es' },
  { codigo: 'MX', nome: 'México 🇲🇽', moeda: 'MXN', idioma: 'es' },
  { codigo: 'CL', nome: 'Chile 🇨🇱', moeda: 'CLP', idioma: 'es' },
  { codigo: 'CO', nome: 'Colômbia 🇨🇴', moeda: 'COP', idioma: 'es' },
  { codigo: 'UY', nome: 'Uruguai 🇺🇾', moeda: 'UYU', idioma: 'es' },
  { codigo: 'PY', nome: 'Paraguai 🇵🇾', moeda: 'PYG', idioma: 'es' },
  { codigo: 'US', nome: 'EUA 🇺🇸', moeda: 'USD', idioma: 'en' },
  { codigo: 'PT', nome: 'Portugal 🇵🇹', moeda: 'EUR', idioma: 'pt' },
];

function ConfigUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'operador', pais: 'BR' });

  useEffect(() => {
    api.get('/usuarios').then((res) => setUsuarios(res.data)).catch(console.error);
  }, []);

  async function criarUsuario() {
    try {
      await api.post('/usuarios', form);
      setModalAberto(false);
      setForm({ nome: '', email: '', senha: '', role: 'operador', pais: 'BR' });
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
              <p className="text-xs text-gray-500">{u.email} · {u.role} · {u.moeda || 'BRL'} ({u.pais || 'BR'})</p>
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">País (define moeda e idioma das confirmações)</label>
                <select
                  value={form.pais}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm"
                >
                  {PAISES.map((p) => (
                    <option key={p.codigo} value={p.codigo}>{p.nome} — {p.moeda}</option>
                  ))}
                </select>
              </div>
              {form.pais && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  Moeda: <strong>{PAISES.find(p => p.codigo === form.pais)?.moeda}</strong> · Idioma das mensagens: <strong>{PAISES.find(p => p.codigo === form.pais)?.idioma === 'pt' ? 'Português' : PAISES.find(p => p.codigo === form.pais)?.idioma === 'es' ? 'Espanhol' : 'Inglês'}</strong>
                </p>
              )}
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
