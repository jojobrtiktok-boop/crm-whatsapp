import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, UserPlus, Shield, Clock, Ban, GitBranch, Play, Pause, Smartphone, CreditCard, Tag, ChevronDown, ChevronUp, Film, Type, FileText, Image, Mic, Zap, GripVertical, Bell } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function Configuracoes() {
  const [abaAtiva, setAbaAtiva] = useState('funis');
  const { usuario } = useAuth();

  const abas = [
    { key: 'funis', label: 'Funis Ativos', icon: GitBranch },
    { key: 'upsell', label: 'Upsell', icon: Zap },
    { key: 'pagamento', label: 'Pagamento', icon: CreditCard },
    { key: 'notificacoes', label: 'Notificações', icon: Bell },
    { key: 'usuarios', label: 'Usuarios', icon: Shield },
    { key: 'blacklist', label: 'Blacklist', icon: Ban },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>

      {/* Mobile: grid 2x3 de botões */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {abas.map((aba) => (
          <button
            key={aba.key}
            onClick={() => setAbaAtiva(aba.key)}
            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-medium transition-all border ${
              abaAtiva === aba.key
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            <aba.icon size={18} />
            <span className="leading-tight text-center">{aba.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop: abas horizontais */}
      <div className="hidden md:flex gap-1 border-b border-gray-200">
        {abas.map((aba) => (
          <button
            key={aba.key}
            onClick={() => setAbaAtiva(aba.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              abaAtiva === aba.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <aba.icon size={15} />
            {aba.label}
          </button>
        ))}
      </div>

      {abaAtiva === 'funis' && <ConfigFunis />}
      {abaAtiva === 'upsell' && <ConfigUpsell />}
      {abaAtiva === 'pagamento' && <ConfigPagamento />}
      {abaAtiva === 'notificacoes' && <ConfigNotificacoes />}
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

function novaConfirmacaoConfig() {
  return { id: Date.now().toString(), nome: '', chipId: '', msg: '', msg_delay: 0, pdf_ativo: false, pdfs: [], pdf_delay: 0 };
}

function ConfigPagamento() {
  const [confirmacaoConfigs, setConfirmacaoConfigs] = useState([novaConfirmacaoConfig()]);
  const [configs, setConfigs] = useState({});
  const [chips, setChips] = useState([]);
  const [etiquetas, setEtiquetas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [carregandoEtiquetas, setCarregandoEtiquetas] = useState(false);
  const [uploadandoPdf, setUploadandoPdf] = useState({});

  useEffect(() => {
    Promise.all([api.get('/chips'), api.get('/configuracoes')]).then(([resChips, resCfg]) => {
      const chipsConectados = resChips.data.filter(c => c.statusConexao === 'open' || c.statusConexao === 'connected');
      setChips(chipsConectados);
      const cfg = resCfg.data;
      setConfigs({
        etiqueta_pagamento_ativa: cfg.etiqueta_pagamento_ativa === 'true',
        etiqueta_pagamento_id: cfg.etiqueta_pagamento_id || '',
      });
      // Carregar confirmacao_configs (novo formato)
      if (cfg.confirmacao_configs) {
        try {
          const parsed = JSON.parse(cfg.confirmacao_configs);
          if (parsed.length > 0) { setConfirmacaoConfigs(parsed); return; }
        } catch {}
      }
      // Migrar formato legado para novo
      if (cfg.msg_pagamento_confirmado || cfg.confirmacao_pdfs || cfg.confirmacao_pdf_url) {
        let pdfsLegados = [];
        if (cfg.confirmacao_pdfs) { try { pdfsLegados = JSON.parse(cfg.confirmacao_pdfs); } catch {} }
        else if (cfg.confirmacao_pdf_url) { pdfsLegados = [{ url: cfg.confirmacao_pdf_url, nome: 'PDF de confirmação' }]; }
        setConfirmacaoConfigs([{ ...novaConfirmacaoConfig(), msg: cfg.msg_pagamento_confirmado || '', pdf_ativo: cfg.confirmacao_pdf_ativo === 'true', pdfs: pdfsLegados }]);
      }
      if (chipsConectados.length > 0) buscarEtiquetas(chipsConectados[0].id);
    }).catch(console.error);
  }, []);

  async function buscarEtiquetas(chipId) {
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

  async function uploadPdf(cfgIdx, files) {
    setUploadandoPdf(prev => ({ ...prev, [cfgIdx]: true }));
    try {
      const novos = [...confirmacaoConfigs[cfgIdx].pdfs];
      for (const file of files) {
        const fd = new FormData();
        fd.append('arquivo', file);
        const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        novos.push({ url: window.location.origin + res.data.url, nome: file.name });
      }
      atualizarConfig(cfgIdx, 'pdfs', novos);
    } catch { alert('Erro ao fazer upload do PDF'); }
    finally { setUploadandoPdf(prev => ({ ...prev, [cfgIdx]: false })); }
  }

  function atualizarConfig(idx, campo, valor) {
    setConfirmacaoConfigs(prev => prev.map((c, i) => i === idx ? { ...c, [campo]: valor } : c));
  }

  function adicionarConfig() {
    setConfirmacaoConfigs(prev => [...prev, novaConfirmacaoConfig()]);
  }

  function removerConfig(idx) {
    setConfirmacaoConfigs(prev => prev.filter((_, i) => i !== idx));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/configuracoes', {
        etiqueta_pagamento_ativa: configs.etiqueta_pagamento_ativa ? 'true' : 'false',
        etiqueta_pagamento_id: configs.etiqueta_pagamento_id,
        confirmacao_configs: JSON.stringify(confirmacaoConfigs),
      });
      alert('Configurações salvas!');
    } catch {
      alert('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Configs de confirmação */}
      {confirmacaoConfigs.map((cfg, idx) => (
        <div key={cfg.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Configuração {idx + 1}</h3>
            {confirmacaoConfigs.length > 1 && (
              <button onClick={() => removerConfig(idx)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Chips */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Chips que enviam a confirmação</label>
            <div className="space-y-1.5">
              {/* Opção "Todos" */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!cfg.chipIds?.length}
                  onChange={() => atualizarConfig(idx, 'chipIds', [])}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-xs text-gray-700">Todos os chips (mesmo que recebeu)</span>
              </label>
              {chips.map(c => {
                const selecionado = cfg.chipIds?.includes(String(c.id));
                return (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => {
                        const atual = cfg.chipIds || [];
                        const novo = selecionado
                          ? atual.filter(id => id !== String(c.id))
                          : [...atual, String(c.id)];
                        atualizarConfig(idx, 'chipIds', novo);
                      }}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    <span className="text-xs text-gray-700">{c.nome || c.instanciaEvolution}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mensagem de confirmação — use <code className="bg-gray-100 px-1 rounded">{'{valor}'}</code>
            </label>
            <textarea
              value={cfg.msg}
              onChange={(e) => atualizarConfig(idx, 'msg', e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm"
              rows={3}
              placeholder="Ex: ✅ Pagamento confirmado! Valor: {valor}. Obrigado!"
            />
          </div>

          {/* Delay mensagem */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Clock size={12} /> Aguardar antes de enviar a mensagem
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={cfg.msg_delay || 0}
                onChange={(e) => atualizarConfig(idx, 'msg_delay', parseInt(e.target.value) || 0)}
                className="w-24 rounded-lg border-gray-300 text-sm"
              />
              <span className="text-xs text-gray-500">segundos (0 = imediato)</span>
            </div>
          </div>

          {/* PDF */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1"><FileText size={13} /> Enviar PDF(s)</span>
              <button
                onClick={() => atualizarConfig(idx, 'pdf_ativo', !cfg.pdf_ativo)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${cfg.pdf_ativo ? 'bg-primary-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${cfg.pdf_ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {cfg.pdf_ativo && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {cfg.pdfs.map((pdf, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <FileText size={13} className="text-red-500 shrink-0" />
                    <span className="text-xs flex-1 truncate">{pdf.nome}</span>
                    <button onClick={() => atualizarConfig(idx, 'pdfs', cfg.pdfs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <div>
                  <input type="file" id={`pdf-upload-${idx}`} accept=".pdf" multiple className="hidden"
                    onChange={(e) => { if (e.target.files?.length) { uploadPdf(idx, Array.from(e.target.files)); e.target.value = ''; } }} />
                  <label htmlFor={`pdf-upload-${idx}`}
                    className="flex items-center justify-center gap-1 w-full py-2 rounded-lg border border-dashed border-red-300 text-red-500 text-xs cursor-pointer hover:bg-red-50">
                    {uploadandoPdf[idx] ? 'Enviando...' : <><Plus size={12} /> Adicionar PDF(s)</>}
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Clock size={12} /> Aguardar antes de enviar o PDF
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={cfg.pdf_delay || 0}
                      onChange={(e) => atualizarConfig(idx, 'pdf_delay', parseInt(e.target.value) || 0)}
                      className="w-24 rounded-lg border-gray-300 text-sm" />
                    <span className="text-xs text-gray-500">segundos</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <button onClick={adicionarConfig}
        className="flex items-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-primary-300 text-primary-600 text-sm justify-center hover:bg-primary-50 transition-colors">
        <Plus size={15} /> Adicionar configuração para outro chip
      </button>

      {/* Etiqueta automática */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Etiqueta Automática no WhatsApp</h3>
            <p className="text-xs text-gray-500 mt-0.5">Etiqueta o contato em todos os chips ao confirmar pagamento.</p>
          </div>
          <button onClick={() => setConfigs(prev => ({ ...prev, etiqueta_pagamento_ativa: !prev.etiqueta_pagamento_ativa }))}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${configs.etiqueta_pagamento_ativa ? 'bg-primary-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${configs.etiqueta_pagamento_ativa ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {configs.etiqueta_pagamento_ativa && (
          <div>
            {carregandoEtiquetas ? <p className="text-xs text-gray-400">Carregando...</p>
              : etiquetas.length > 0 ? (
                <select value={configs.etiqueta_pagamento_id || ''} onChange={(e) => setConfigs(prev => ({ ...prev, etiqueta_pagamento_id: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 text-sm">
                  <option value="">Selecione uma etiqueta</option>
                  {etiquetas.map(et => <option key={et.id} value={et.id}>{et.name || et.id}</option>)}
                </select>
              ) : (
                <input type="text" value={configs.etiqueta_pagamento_id || ''}
                  onChange={(e) => setConfigs(prev => ({ ...prev, etiqueta_pagamento_id: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 text-sm" placeholder="ID da etiqueta" />
              )}
          </div>
        )}
      </div>

      <button onClick={salvar} disabled={salvando}
        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
        <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Configurações'}
      </button>
    </div>
  );
}

const TIPOS_BLOCO = [
  { tipo: 'texto',  label: 'Texto',   icon: Type,     cor: 'blue'   },
  { tipo: 'video',  label: 'Vídeo',   icon: Film,     cor: 'purple' },
  { tipo: 'imagem', label: 'Imagem',  icon: Image,    cor: 'green'  },
  { tipo: 'audio',  label: 'Áudio',   icon: Mic,      cor: 'orange' },
  { tipo: 'pdf',    label: 'PDF',     icon: FileText, cor: 'red'    },
  { tipo: 'delay',  label: 'Delay',   icon: Clock,    cor: 'gray'   },
];

const COR_MAP = {
  blue:   { text: '#3b82f6', border: 'rgba(59,130,246,0.3)',  bg: 'rgba(59,130,246,0.07)'  },
  purple: { text: '#8b5cf6', border: 'rgba(139,92,246,0.3)', bg: 'rgba(139,92,246,0.07)' },
  green:  { text: '#10b981', border: 'rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.07)' },
  orange: { text: '#f59e0b', border: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.07)' },
  red:    { text: '#ef4444', border: 'rgba(239,68,68,0.3)',   bg: 'rgba(239,68,68,0.07)'  },
  gray:   { text: '#64748b', border: 'rgba(100,116,139,0.3)', bg: 'rgba(100,116,139,0.07)' },
};

function BlocoInput({ bloco, idx, onChange, onRemove }) {
  const def = TIPOS_BLOCO.find(t => t.tipo === bloco.tipo) || TIPOS_BLOCO[0];
  const cor = COR_MAP[def.cor];
  const Icon = def.icon;
  const [uploading, setUploading] = useState(false);
  const fileId = `bloco-${idx}-${bloco.tipo}`;

  const acceptMap = { video: 'video/*', imagem: 'image/*', audio: 'audio/*', pdf: '.pdf' };

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const base = window.location.origin.replace(':5173', ':3001');
      onChange(base + res.data.url);
    } catch { alert('Erro ao fazer upload'); }
    finally { setUploading(false); e.target.value = ''; }
  }

  return (
    <div style={{ background: cor.bg, border: `1px solid ${cor.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color: cor.text }} />
        <span className="text-xs font-semibold" style={{ color: cor.text }}>{def.label}</span>
        <button onClick={onRemove} className="ml-auto" style={{ color: '#475569' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#475569'}>
          <Trash2 size={13} />
        </button>
      </div>

      {bloco.tipo === 'texto' && (
        <textarea value={bloco.valor} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border-gray-300 text-sm" rows={3}
          placeholder="Texto da mensagem..." />
      )}
      {(bloco.tipo === 'video' || bloco.tipo === 'imagem' || bloco.tipo === 'audio' || bloco.tipo === 'pdf') && (
        <div className="space-y-1.5">
          <input type="text" value={bloco.valor} onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg border-gray-300 text-sm"
            placeholder="URL ou faça upload abaixo" />
          <div className="flex items-center gap-2">
            <input type="file" id={fileId} className="hidden"
              accept={acceptMap[bloco.tipo]}
              onChange={handleUpload} />
            <label htmlFor={fileId}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ border: `1px solid ${cor.border}`, color: cor.text, background: 'white' }}>
              {uploading ? 'Enviando...' : '↑ Upload do PC'}
            </label>
            {bloco.valor && !bloco.valor.startsWith('http') === false && (
              <span className="text-[10px] text-gray-400 truncate max-w-[120px]">✓ arquivo salvo</span>
            )}
          </div>
        </div>
      )}
      {bloco.tipo === 'delay' && (
        <div className="flex gap-2">
          <input type="number" min="1" value={bloco.valor || '1'}
            onChange={e => onChange(e.target.value)}
            className="w-20 rounded-lg border-gray-300 text-sm" />
          <select value={bloco.unidade || 'minutos'}
            onChange={e => onChange(bloco.valor || '1', e.target.value)}
            className="flex-1 rounded-lg border-gray-300 text-sm">
            <option value="segundos">Segundos</option>
            <option value="minutos">Minutos</option>
            <option value="horas">Horas</option>
          </select>
        </div>
      )}
    </div>
  );
}

function ConfigUpsell() {
  const [upsells, setUpsells] = useState([]);
  const [chips, setChips] = useState([]);
  const [expandido, setExpandido] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/chips'), api.get('/configuracoes')]).then(([resChips, resCfg]) => {
      setChips(resChips.data);
      const cfg = resCfg.data;
      if (cfg.upsells) {
        try { setUpsells(JSON.parse(cfg.upsells)); } catch { setUpsells([]); }
      }
    }).catch(console.error);
  }, []);

  async function salvarLista(lista) {
    setSalvando(true);
    try {
      await api.put('/configuracoes', { upsells: JSON.stringify(lista) });
    } catch { alert('Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  function novoUpsell() {
    const novo = { id: Date.now().toString(36), nome: `Upsell ${upsells.length + 1}`, ativo: true, tempo: '30', unidade: 'minutos', chipIds: [], blocos: [] };
    const lista = [...upsells, novo];
    setUpsells(lista);
    setExpandido(prev => ({ ...prev, [novo.id]: true }));
    salvarLista(lista);
  }

  function update(id, campo, valor) {
    const lista = upsells.map(u => u.id === id ? { ...u, [campo]: valor } : u);
    setUpsells(lista);
    return lista;
  }

  function remover(id) {
    if (!confirm('Excluir este upsell?')) return;
    const lista = upsells.filter(u => u.id !== id);
    setUpsells(lista);
    salvarLista(lista);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Upsells Automáticos</h3>
          <p className="text-xs text-gray-500 mt-0.5">Cada upsell dispara uma sequência de mensagens após a confirmação do pagamento.</p>
        </div>
        <button onClick={novoUpsell}
          className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={14} /> Criar Upsell
        </button>
      </div>

      {upsells.length === 0 && (
        <div className="text-center py-14 border border-dashed border-gray-200 rounded-xl">
          <Zap size={28} style={{ color: '#334155', margin: '0 auto 8px' }} />
          <p className="text-sm text-gray-500">Nenhum upsell criado</p>
          <p className="text-xs text-gray-400">Clique em "Criar Upsell" para começar</p>
        </div>
      )}

      <div className="space-y-3">
        {upsells.map(up => {
          const aberto = expandido[up.id];
          return (
            <div key={up.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--bg-surface)', borderBottom: aberto ? '1px solid #1a2d4a' : 'none' }}>
                <button onClick={() => { const l = update(up.id, 'ativo', !up.ativo); salvarLista(l); }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${up.ativo ? 'bg-primary-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${up.ativo ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <input value={up.nome}
                  onChange={e => update(up.id, 'nome', e.target.value)}
                  onBlur={() => salvarLista(upsells)}
                  className="flex-1 bg-transparent text-sm font-semibold outline-none border-none" />
                <span className="text-[10px] text-gray-400 hidden sm:block">{up.blocos?.length || 0} blocos</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                  {up.chipIds?.length === 0 ? 'Todos chips' : `${up.chipIds?.length} chip(s)`}
                </span>
                <span className="text-[10px] text-gray-400">{up.tempo}{up.unidade === 'horas' ? 'h' : 'min'}</span>
                <button onClick={() => setExpandido(p => ({ ...p, [up.id]: !p[up.id] }))} style={{ color: '#475569' }}>
                  {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button onClick={() => remover(up.id)} style={{ color: '#334155' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#334155'}>
                  <Trash2 size={14} />
                </button>
              </div>

              {aberto && (
                <div className="p-4 space-y-4">
                  {/* Delay */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <label className="block text-xs text-gray-500 mb-2 flex items-center gap-1"><Clock size={11} /> Enviar após confirmação</label>
                    <div className="flex gap-2">
                      <input type="number" min="1" value={up.tempo}
                        onChange={e => update(up.id, 'tempo', e.target.value)}
                        onBlur={() => salvarLista(upsells)}
                        className="w-24 rounded-lg border-gray-300 text-sm" />
                      <select value={up.unidade}
                        onChange={e => { const l = update(up.id, 'unidade', e.target.value); salvarLista(l); }}
                        className="flex-1 rounded-lg border-gray-300 text-sm">
                        <option value="minutos">Minutos</option>
                        <option value="horas">Horas</option>
                      </select>
                    </div>
                  </div>

                  {/* Chips */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 flex items-center gap-1"><Smartphone size={11} /> Chips que enviam este upsell</label>
                    <div className="flex flex-wrap gap-2">
                      {chips.map(chip => {
                        const marcado = up.chipIds?.includes(chip.id);
                        return (
                          <button key={chip.id}
                            onClick={() => {
                              const atual = up.chipIds || [];
                              const novo = marcado ? atual.filter(id => id !== chip.id) : [...atual, chip.id];
                              const l = update(up.id, 'chipIds', novo);
                              salvarLista(l);
                            }}
                            style={{
                              padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                              border: marcado ? '1px solid rgba(99,102,241,0.5)' : '1px solid #1a2d4a',
                              background: marcado ? 'rgba(99,102,241,0.15)' : 'transparent',
                              color: marcado ? '#818cf8' : '#64748b',
                            }}>
                            {chip.nome}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {up.chipIds?.length === 0 ? 'Nenhum selecionado = dispara em todos os chips' : `${up.chipIds?.length} chip(s) selecionado(s)`}
                    </p>
                  </div>

                  {/* Blocos */}
                  {up.blocos?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Sequência de envio</p>
                      {up.blocos.map((bloco, idx) => (
                        <BlocoInput key={idx} bloco={bloco} idx={idx}
                          onChange={(v, u) => {
                            const nb = up.blocos.map((b, i) => i === idx ? { ...b, valor: v, ...(u !== undefined ? { unidade: u } : {}) } : b);
                            update(up.id, 'blocos', nb);
                          }}
                          onRemove={() => { const nb = up.blocos.filter((_, i) => i !== idx); const l = update(up.id, 'blocos', nb); salvarLista(l); }} />
                      ))}
                    </div>
                  )}

                  {/* Add bloco */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Adicionar bloco</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TIPOS_BLOCO.map(({ tipo, label, icon: Icon, cor }) => {
                        const c = COR_MAP[cor];
                        return (
                          <button key={tipo}
                            onClick={() => { const nb = [...(up.blocos || []), { tipo, valor: '', unidade: 'minutos' }]; const l = update(up.id, 'blocos', nb); salvarLista(l); }}
                            style={{ color: c.text, border: `1px dashed ${c.border}`, borderRadius: 10, background: 'transparent' }}
                            className="flex items-center justify-center gap-1.5 py-2 text-xs"
                            onMouseEnter={e => e.currentTarget.style.background = c.bg}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Icon size={13} /> + {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={() => salvarLista(upsells)} disabled={salvando}
                    className="flex items-center gap-2 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-primary-700 disabled:opacity-50">
                    <Save size={13} /> {salvando ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigNotificacoes() {
  const { supported: suportado, permission: permissao, subscribed: inscrito, loading, subscribe: inscrever, unsubscribe: desinscrever } = usePushNotifications();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-5">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Notificações Push</h3>
        <p className="text-xs text-gray-500">
          Receba notificações no celular/computador quando uma venda for confirmada, mesmo com o app fechado.
        </p>
      </div>

      {!suportado && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          Seu navegador não suporta notificações push. Use Chrome ou Safari no iOS 16.4+.
        </div>
      )}

      {suportado && permissao === 'denied' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          Permissão de notificação bloqueada. Vá nas configurações do navegador e permita notificações para este site.
        </div>
      )}

      {suportado && permissao !== 'denied' && (
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${inscrito ? 'bg-green-100' : 'bg-gray-200'}`}>
              <Bell size={20} className={inscrito ? 'text-green-600' : 'text-gray-500'} />
            </div>
            <div>
              <p className="font-medium text-sm text-gray-800">
                {inscrito ? 'Notificações ativas' : 'Notificações desativadas'}
              </p>
              <p className="text-xs text-gray-500">
                {inscrito ? 'Você receberá alertas de vendas confirmadas' : 'Ative para receber alertas de vendas'}
              </p>
            </div>
          </div>
          <button
            onClick={inscrito ? desinscrever : inscrever}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              inscrito
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {loading ? 'Aguarde...' : inscrito ? 'Desativar' : 'Ativar Notificações'}
          </button>
        </div>
      )}

      <div className="text-xs text-gray-400 space-y-1">
        <p>• Notificações são enviadas quando uma venda é confirmada via comprovante ou manualmente.</p>
        <p>• Cada dispositivo precisa ativar separadamente.</p>
        <p>• No iPhone, adicione o site à tela inicial (PWA) antes de ativar.</p>
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

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <input type="text" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="flex-1 rounded-lg border-gray-300 text-sm" placeholder="Número" />
          <button onClick={adicionar} className="bg-red-600 text-white px-4 rounded-lg text-sm hover:bg-red-700">
            <Plus size={16} />
          </button>
        </div>
        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm" placeholder="Motivo (opcional)" />
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
