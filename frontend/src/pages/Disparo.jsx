import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Download, Upload, Trash2, CheckCircle2, Clock, AlertTriangle, Info, Users, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api';
import { useSocketEvent } from '../hooks/useSocket';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const linhas = text.trim().split('\n');
  if (linhas.length < 2) return [];
  const headers = linhas[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return linhas.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const cols = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      cols.push(cur.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = (cols[i] || '').replace(/^"|"$/g, '').trim(); });
      return row;
    })
    .filter(r => r.mensagem);
}

function downloadTemplate() {
  const csv = `mensagem,horario
"🔥 Produto 1 - Oferta imperdível! R$99 ➡ SEU_LINK",09:00
"⚡ Produto 2 - 50% OFF hoje apenas! R$49 ➡ SEU_LINK",10:00
"🛍️ Produto 3 - Frete grátis! R$79 ➡ SEU_LINK",11:00
"💥 Produto 4 - Últimas unidades! R$129 ➡ SEU_LINK",12:00
"✨ Produto 5 - Mais vendido da semana! R$59 ➡ SEU_LINK",13:00`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-disparo.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  const map = {
    enviando:     { label: 'Enviando',    cls: 'bg-blue-100 text-blue-700' },
    agendado:     { label: 'Agendado',    cls: 'bg-purple-100 text-purple-700' },
    concluido:    { label: 'Concluído',   cls: 'bg-green-100 text-green-700' },
    erro_parcial: { label: 'Parcial',     cls: 'bg-yellow-100 text-yellow-700' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ─── Painel de Grupos ────────────────────────────────────────────────────────

function GruposPanel({ chips, onGruposChange, onChipChange }) {
  const [chipId, setChipId] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [expandido, setExpandido] = useState(true);

  async function carregarGrupos(id) {
    if (!id) return;
    setCarregando(true);
    setSelecionados([]);
    setGrupos([]);
    try {
      const res = await api.get(`/disparo/grupos/${id}`);
      const lista = (res.data || []).sort((a, b) => a.nome?.localeCompare(b.nome));
      setGrupos(lista);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao listar grupos. Verifique se o chip está conectado.');
    } finally {
      setCarregando(false);
    }
  }

  function toggleGrupo(grupo) {
    setSelecionados(prev => {
      const existe = prev.find(g => g.id === grupo.id);
      const novo = existe ? prev.filter(g => g.id !== grupo.id) : [...prev, grupo];
      onGruposChange(novo);
      return novo;
    });
  }

  function selecionarTodos() {
    setSelecionados(grupos);
    onGruposChange(grupos);
  }

  function desmarcarTodos() {
    setSelecionados([]);
    onGruposChange([]);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Users size={16} className="text-primary-500" /> Chip e Grupos
        </h3>
        {grupos.length > 0 && (
          <button onClick={() => setExpandido(e => !e)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            {expandido ? <><ChevronUp size={13} /> Recolher</> : <><ChevronDown size={13} /> Expandir ({selecionados.length}/{grupos.length})</>}
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Chip WhatsApp</label>
        <select
          value={chipId}
          onChange={e => {
            setChipId(e.target.value);
            onChipChange(e.target.value);
            carregarGrupos(e.target.value);
          }}
          className="w-full rounded-lg border-gray-300 text-sm"
        >
          <option value="">Selecionar chip...</option>
          {chips.map(c => <option key={c.id} value={c.id}>{c.nome || c.instanciaEvolution}</option>)}
        </select>
      </div>

      {carregando && <p className="text-sm text-gray-500 animate-pulse">Carregando grupos...</p>}

      {grupos.length > 0 && expandido && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={selecionarTodos} className="text-xs text-primary-600 hover:underline">Selecionar todos ({grupos.length})</button>
            <span className="text-gray-300">·</span>
            <button onClick={desmarcarTodos} className="text-xs text-gray-500 hover:underline">Desmarcar</button>
            {selecionados.length > 0 && <span className="text-xs font-semibold text-primary-600 ml-auto">{selecionados.length} selecionado(s)</span>}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {grupos.map(g => {
              const sel = selecionados.some(s => s.id === g.id);
              return (
                <label key={g.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <input type="checkbox" checked={sel} onChange={() => toggleGrupo(g)} className="rounded text-primary-600" />
                  <span className="text-sm text-gray-800 flex-1 truncate">{g.nome}</span>
                  <span className="text-xs text-gray-400 shrink-0">{g.participantes} membros</span>
                </label>
              );
            })}
          </div>
        </>
      )}

      {grupos.length > 0 && !expandido && (
        <p className="text-xs text-gray-500">{selecionados.length} de {grupos.length} grupos selecionados</p>
      )}
    </div>
  );
}

// ─── Campo de Delay ──────────────────────────────────────────────────────────

function DelayInput({ value, onChange }) {
  const [showDica, setShowDica] = useState(false);
  const abaixoRisco = parseInt(value) < 15;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium text-gray-700">Delay entre grupos (segundos)</label>
        <button onClick={() => setShowDica(d => !d)} className="text-gray-400 hover:text-gray-600">
          <Info size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min="5"
          max="300"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-28 rounded-lg border-gray-300 text-sm"
        />
        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
          Recomendado: 20-30s
        </span>
      </div>

      {abaixoRisco && (
        <div className="flex items-center gap-1.5 mt-1.5 text-yellow-700 text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} />
          Abaixo de 15s aumenta o risco de ban do número.
        </div>
      )}

      {showDica && (
        <div className="mt-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 space-y-1">
          <p className="font-semibold text-blue-800">Recomendações anti-ban (pesquisa):</p>
          <p>• <strong>20-30s</strong> entre grupos é o ideal para evitar ban</p>
          <p>• Máximo <strong>30 grupos/hora</strong> por chip</p>
          <p>• Envie entre <strong>8h e 22h</strong> para simular comportamento humano</p>
          <p>• Varie levemente o texto entre grupos quando possível</p>
        </div>
      )}
    </div>
  );
}

// ─── Aba Disparo Imediato ────────────────────────────────────────────────────

function DisparoImediato({ chips }) {
  const [chipId, setChipId] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [delay, setDelay] = useState(20);
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(null); // {id, enviados, total}

  const handleProgresso = useCallback((data) => {
    setProgresso(p => p?.id === data.id ? { ...p, enviados: data.enviados, total: data.total } : p);
  }, []);

  const handleConcluido = useCallback((data) => {
    setProgresso(p => p?.id === data.id ? { ...p, concluido: true } : p);
    setEnviando(false);
  }, []);

  useSocketEvent('disparo:progresso', handleProgresso);
  useSocketEvent('disparo:concluido', handleConcluido);

  async function disparar() {
    if (!chipId) return alert('Selecione um chip.');
    if (!grupos.length) return alert('Selecione ao menos um grupo.');
    if (!mensagem.trim()) return alert('Digite a mensagem.');

    setEnviando(true);
    setProgresso(null);
    try {
      const res = await api.post('/disparo', {
        nome: nome || undefined,
        chipId: parseInt(chipId),
        grupos,
        mensagem,
        delaySegundos: parseInt(delay),
      });
      setProgresso({ id: res.data.id, enviados: 0, total: grupos.length, concluido: false });
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao iniciar disparo');
      setEnviando(false);
    }
  }

  const pct = progresso ? Math.round((progresso.enviados / progresso.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <GruposPanel chips={chips} onGruposChange={setGrupos} onChipChange={setChipId} />

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Mensagem</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do disparo (opcional)</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Ex: Promoção Semana Santa" className="w-full rounded-lg border-gray-300 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem para enviar</label>
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            rows={4}
            placeholder="Digite a mensagem que será enviada para todos os grupos selecionados..."
            className="w-full rounded-lg border-gray-300 text-sm resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{mensagem.length} caracteres</p>
        </div>

        <DelayInput value={delay} onChange={setDelay} />
      </div>

      {/* Progresso */}
      {progresso && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              {progresso.concluido ? '✅ Disparo concluído!' : '⏳ Disparando...'}
            </span>
            <span className="font-semibold text-primary-600">{progresso.enviados}/{progresso.total} grupos</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="bg-primary-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400">{pct}% concluído · delay de {delay}s entre grupos</p>
        </div>
      )}

      <button
        onClick={disparar}
        disabled={enviando || !grupos.length || !mensagem.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Send size={16} />
        {enviando ? 'Disparando...' : `Disparar para ${grupos.length} grupo${grupos.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

// ─── Aba Disparo por Planilha ────────────────────────────────────────────────

function DisparoPlanilha({ chips }) {
  const [chipId, setChipId] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [delay, setDelay] = useState(20);
  const [nome, setNome] = useState('');
  const [agendando, setAgendando] = useState(false);
  const [agendado, setAgendado] = useState(null);
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result);
      setLinhas(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function agendar() {
    if (!chipId) return alert('Selecione um chip.');
    if (!grupos.length) return alert('Selecione ao menos um grupo.');
    if (!linhas.length) return alert('Faça upload de um CSV válido.');

    setAgendando(true);
    try {
      const res = await api.post('/disparo/agendar', {
        nome: nome || undefined,
        chipId: parseInt(chipId),
        grupos,
        linhas,
        delaySegundos: parseInt(delay),
      });
      setAgendado(res.data);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao agendar disparo');
    } finally {
      setAgendando(false);
    }
  }

  const totalEnvios = linhas.length * grupos.length;

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-800">Planilha CSV com mensagem e horário</p>
          <p className="text-xs text-blue-600 mt-0.5">Colunas: <code className="bg-blue-100 px-1 rounded">mensagem</code> e <code className="bg-blue-100 px-1 rounded">horario</code> (HH:MM). Sem limite de linhas — 30, 40, 50+ funcionam normalmente.</p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shrink-0">
          <Download size={13} /> Baixar modelo
        </button>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-gray-800">Upload da Planilha</h3>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50 transition-all"
        >
          <Upload size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">Clique para selecionar o CSV</p>
          <p className="text-xs text-gray-400 mt-1">Formato: mensagem,horario</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        {linhas.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-green-700">✅ {linhas.length} mensagem(ns) carregada(s)</p>
              <button onClick={() => { setLinhas([]); fileRef.current.value = ''; }} className="text-xs text-red-400 hover:text-red-600">Remover</button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Mensagem</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium w-16">Horário</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-gray-700 truncate max-w-xs">{l.mensagem}</td>
                      <td className="px-3 py-1.5 font-mono text-primary-600">{l.horario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <GruposPanel chips={chips} onGruposChange={setGrupos} onChipChange={setChipId} />

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do disparo (opcional)</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Ex: Afiliados ML - Segunda" className="w-full rounded-lg border-gray-300 text-sm" />
        </div>
        <DelayInput value={delay} onChange={setDelay} />
      </div>

      {agendado && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-medium">
          <CheckCircle2 size={16} />
          {agendado.jobsAgendados} envios agendados com sucesso para hoje!
        </div>
      )}

      {linhas.length > 0 && grupos.length > 0 && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
          Resumo: <strong>{linhas.length}</strong> mensagens × <strong>{grupos.length}</strong> grupos = <strong>{totalEnvios} envios</strong> ao longo do dia
        </div>
      )}

      <button
        onClick={agendar}
        disabled={agendando || !grupos.length || !linhas.length}
        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <Clock size={16} />
        {agendando ? 'Agendando...' : `Agendar ${totalEnvios || 0} envio${totalEnvios !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

// ─── Histórico ───────────────────────────────────────────────────────────────

function Historico({ reload }) {
  const [disparos, setDisparos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try {
      const res = await api.get('/disparo');
      setDisparos(res.data || []);
    } catch {}
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, [reload]);

  async function deletar(id) {
    if (!confirm('Remover este registro do histórico?')) return;
    try {
      await api.delete(`/disparo/${id}`);
      setDisparos(prev => prev.filter(d => d.id !== id));
    } catch {}
  }

  if (carregando) return <p className="text-sm text-gray-400 animate-pulse">Carregando histórico...</p>;
  if (!disparos.length) return <p className="text-sm text-gray-400">Nenhum disparo realizado ainda.</p>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Histórico de Disparos</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Chip</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Enviados</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {disparos.map(d => (
              <tr key={d.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">{d.nome}</td>
                <td className="px-4 py-3 text-gray-600">{d.chip?.nome || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.tipo === 'agendado' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {d.tipo === 'agendado' ? 'Agendado' : 'Imediato'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{d.enviados}/{d.totalEnvios}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(d.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deletar(d.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function Disparo() {
  const [aba, setAba] = useState('imediato');
  const [chips, setChips] = useState([]);
  const [reloadHist, setReloadHist] = useState(0);

  useEffect(() => {
    api.get('/chips').then(r => setChips(r.data || [])).catch(console.error);
  }, []);

  // Recarregar histórico quando disparo concluir
  const handleConcluido = useCallback(() => {
    setReloadHist(n => n + 1);
  }, []);
  useSocketEvent('disparo:concluido', handleConcluido);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Disparo para Grupos</h1>
        <p className="text-sm text-gray-500 mt-1">Envie mensagens para múltiplos grupos WhatsApp — imediato ou agendado por planilha.</p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'imediato', label: 'Disparo Imediato' },
          { key: 'planilha', label: 'Disparo por Planilha' },
        ].map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${aba === a.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {aba === 'imediato' && <DisparoImediato chips={chips} />}
        {aba === 'planilha' && <DisparoPlanilha chips={chips} />}
      </div>

      <div className="max-w-4xl">
        <Historico reload={reloadHist} />
      </div>
    </div>
  );
}
