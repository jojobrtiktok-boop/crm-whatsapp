import { useState, useEffect } from 'react';
import { Copy, Plus, Trash2, Check, Globe, BookOpen, Layout } from 'lucide-react';
import api from '../api';

function CopiarBtn({ texto }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }
  return (
    <button onClick={copiar} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700 transition-colors">
      {copiado ? <><Check size={13} className="text-green-600" /> Copiado!</> : <><Copy size={13} /> Copiar</>}
    </button>
  );
}

const CV_VAZIO = () => ({ id: Date.now().toString(), nome: '', telefone: '', mensagem: 'Olá! Quero saber mais.' });

const WPP_SVG = `<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>`;

const TEMAS = {
  escuro: {
    bg: '#0a1628',
    bgGrad: 'radial-gradient(ellipse at 30% 60%, rgba(37,211,102,0.07) 0%, transparent 60%)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(37,211,102,0.18)',
    badgeBg: 'rgba(37,211,102,0.1)',
    badgeBorder: 'rgba(37,211,102,0.25)',
    badgeColor: '#25d366',
  },
  claro: {
    bg: '#f0f2f5',
    bgGrad: 'none',
    card: '#ffffff',
    cardBorder: '#e0e0e0',
    badgeBg: 'rgba(37,211,102,0.12)',
    badgeBorder: 'rgba(37,211,102,0.3)',
    badgeColor: '#128c7e',
  },
};

function gerarHtmlModelo({ telefone, textoBotao, badge, cvKey, mensagem, tema }) {
  const phone = (telefone || '').replace(/\D/g, '');
  const msg = mensagem || 'Olá! Quero saber mais.';
  const cv = cvKey || 'cv1';
  const t = TEMAS[tema] || TEMAS.escuro;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WhatsApp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${t.bg};
      background-image: ${t.bgGrad};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 20px;
    }
    .wrap { text-align: center; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: #25d366;
      color: white;
      font-size: 17px;
      font-weight: 700;
      padding: 18px 36px;
      border-radius: 100px;
      text-decoration: none;
      box-shadow: 0 4px 24px rgba(37,211,102,0.5);
      animation: pulse 2s infinite;
      transition: transform 0.1s;
    }
    .btn:active { transform: scale(0.97); }
    .btn svg { width: 24px; height: 24px; fill: white; flex-shrink: 0; }
    @keyframes pulse {
      0%,100% { box-shadow: 0 4px 24px rgba(37,211,102,0.5); }
      50% { box-shadow: 0 4px 40px rgba(37,211,102,0.8), 0 0 0 10px rgba(37,211,102,0.1); }
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: ${t.badgeBg};
      border: 1px solid ${t.badgeBorder};
      color: ${t.badgeColor};
      font-size: 12px;
      font-weight: 600;
      padding: 7px 16px;
      border-radius: 100px;
      margin-top: 20px;
    }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #25d366; animation: blink 1.5s infinite; display: inline-block; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
  </style>
</head>
<body>
  <div class="wrap">
    <a href="#" class="btn" id="wpp-btn">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${WPP_SVG}</svg>
      ${textoBotao || 'Entrar no WhatsApp'}
    </a>
    <br/>
    <span class="badge"><span class="dot"></span>${badge || 'Online agora'}</span>
  </div>
  <script>
  (function() {
    var p = new URLSearchParams(window.location.search);
    var ref = ['${cv}', p.get('utm_campaign')||'', p.get('utm_content')||'', p.get('utm_source')||''].filter(Boolean).join('|');
    document.getElementById('wpp-btn').href = 'https://api.whatsapp.com/send?phone=${phone}&text=' + encodeURIComponent('${msg} [ref:' + ref + ']');
  })();
  </script>
</body>
</html>`;
}

function CopiarBtnHtml({ html }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(html).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }
  return (
    <button onClick={copiar}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copiado ? 'bg-green-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
      {copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar HTML</>}
    </button>
  );
}

function PageModelo() {
  const [telefone, setTelefone] = useState('');
  const [textoBotao, setTextoBotao] = useState('Entrar no WhatsApp');
  const [badge, setBadge] = useState('Online agora');
  const [cvKeys, setCvKeys] = useState(['cv1']);
  const [mensagem, setMensagem] = useState('Olá! Quero saber mais.');
  const [tema, setTema] = useState('escuro');
  const isDark = tema === 'escuro';

  function adicionarCv() {
    setCvKeys(prev => [...prev, `cv${prev.length + 1}`]);
  }

  function removerCv(idx) {
    setCvKeys(prev => prev.filter((_, i) => i !== idx));
  }

  function atualizarCv(idx, valor) {
    setCvKeys(prev => prev.map((k, i) => i === idx ? valor : k));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configurações */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Configurar página</h3>

          {/* Tema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tema</label>
            <div className="flex gap-2">
              <button onClick={() => setTema('escuro')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${!isDark ? 'border-gray-200 text-gray-500' : 'border-primary-500 bg-primary-50 text-primary-700'}`}>
                <span className="w-4 h-4 rounded-full bg-[#0a1628] border border-gray-400" /> Escuro
              </button>
              <button onClick={() => setTema('claro')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${isDark ? 'border-gray-200 text-gray-500' : 'border-primary-500 bg-primary-50 text-primary-700'}`}>
                <span className="w-4 h-4 rounded-full bg-[#f0f2f5] border border-gray-300" /> Claro
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número do WhatsApp (com DDI)</label>
            <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)}
              placeholder="5511999999999" className="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Texto do botão</label>
            <input type="text" value={textoBotao} onChange={e => setTextoBotao(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Badge (texto abaixo do botão)</label>
            <input type="text" value={badge} onChange={e => setBadge(e.target.value)}
              placeholder="Online agora" className="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem pré-preenchida</label>
            <input type="text" value={mensagem} onChange={e => setMensagem(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>
        </div>

        {/* CVs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">CVs (variações)</h3>
            <button onClick={adicionarCv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700">
              <Plus size={13} /> Adicionar CV
            </button>
          </div>
          <p className="text-xs text-gray-400">Cada CV gera uma página HTML independente — mesmo número, caminhos diferentes (ex: /cv1, /cv2).</p>

          {cvKeys.map((key, idx) => {
            const html = gerarHtmlModelo({ telefone, textoBotao, badge, cvKey: key, mensagem, tema });
            return (
              <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-md shrink-0">#{idx + 1}</span>
                <input
                  type="text"
                  value={key}
                  onChange={e => atualizarCv(idx, e.target.value)}
                  placeholder="cv1"
                  className="flex-1 rounded-lg border-gray-300 text-sm py-1.5"
                />
                <CopiarBtnHtml html={html} />
                {cvKeys.length > 1 && (
                  <button onClick={() => removerCv(idx)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 text-center">Salve cada HTML como <code className="bg-gray-100 px-1 rounded">index.html</code> na pasta do CV correspondente no servidor.</p>
      </div>

      {/* Preview mobile */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-gray-600">Preview ({cvKeys[0] || 'cv1'})</p>
        <div style={{ width: 260 }}>
          <div className="bg-gray-900 rounded-[36px] p-3 shadow-2xl border-4 border-gray-700">
            <div className="bg-gray-800 rounded-full w-14 h-4 mx-auto mb-2" />
            <div className="rounded-[22px] overflow-hidden flex items-center justify-center" style={{ height: 460, background: isDark ? '#0a1628' : '#f0f2f5' }}>
              <div className="text-center px-6">
                {/* Botão */}
                <div className="flex items-center justify-center gap-2 bg-[#25d366] text-white text-sm font-bold py-3.5 px-5 rounded-full animate-pulse"
                  style={{ boxShadow: '0 4px 20px rgba(37,211,102,0.5)' }}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0">
                    <path d={WPP_SVG.replace('<path d="', '').replace('"/>', '')} />
                  </svg>
                  <span className="truncate max-w-[120px]">{textoBotao || 'Entrar no WhatsApp'}</span>
                </div>
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-semibold"
                  style={{ color: isDark ? '#25d366' : '#128c7e' }}>
                  <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
                  {badge || 'Online agora'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WppPage() {
  const [aba, setAba] = useState('paginas');
  const [cvs, setCvs] = useState([CV_VAZIO()]);
  const [chips, setChips] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/chips'), api.get('/configuracoes')]).then(([resChips, resCfg]) => {
      setChips(resChips.data);
      if (resCfg.data.wpp_pages) {
        try { setCvs(JSON.parse(resCfg.data.wpp_pages)); } catch {}
      }
    }).catch(console.error);
  }, []);

  function atualizar(idx, campo, valor) {
    setCvs(prev => prev.map((cv, i) => i === idx ? { ...cv, [campo]: valor } : cv));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/configuracoes', { wpp_pages: JSON.stringify(cvs) });
      setSalvoOk(true);
      setTimeout(() => setSalvoOk(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  }

  // Gera o script para uma cv específica
  function gerarScript(cv, idx) {
    const cvKey = `cv${idx + 1}`;
    const phone = cv.telefone.replace(/\D/g, '');
    const msg = cv.mensagem || 'Olá!';
    return `<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var partes = [
    '${cvKey}',
    params.get('utm_campaign') || '',
    params.get('utm_content') || '',
    params.get('utm_source') || ''
  ].filter(Boolean).join('|');
  var texto = encodeURIComponent('${msg} [ref:' + partes + ']');
  var href = 'https://api.whatsapp.com/send?phone=${phone}&text=' + texto;
  document.querySelectorAll('a[href*="api.whatsapp.com"], a[href*="wa.me"]')
    .forEach(function(a) { a.href = href; });
})();
</script>`;
  }

  function gerarScriptGeral() {
    if (cvs.length === 0) return '';
    const cv = cvs[0];
    return gerarScript(cv, 0);
  }

  const abas = [
    { key: 'paginas', label: 'Minhas Páginas', icon: Globe },
    { key: 'modelo', label: 'Page Modelo', icon: Layout },
    { key: 'facebook', label: 'Guia Facebook', icon: BookOpen },
    { key: 'tiktok', label: 'Guia TikTok', icon: BookOpen },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">WPP Page</h1>
      <p className="text-sm text-gray-500">Configure suas páginas de vendas com rastreio de anúncios via WhatsApp.</p>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {abas.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${aba === a.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <a.icon size={14} /> {a.label}
          </button>
        ))}
      </div>

      {/* ─── Minhas Páginas ─────────────────────────────────────────────── */}
      {aba === 'paginas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Cada página gera um script único que detecta as UTMs do anúncio e injeta no link do WhatsApp.</p>
            <button onClick={() => setCvs(p => [...p, CV_VAZIO()])}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
              <Plus size={15} /> Nova Página
            </button>
          </div>

          {cvs.map((cv, idx) => (
            <div key={cv.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-md">cv{idx + 1}</span>
                {cvs.length > 1 && (
                  <button onClick={() => setCvs(p => p.filter((_, i) => i !== idx))}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da página</label>
                  <input type="text" value={cv.nome} onChange={e => atualizar(idx, 'nome', e.target.value)}
                    placeholder="Ex: Criativo Verão, Stories..." className="w-full rounded-lg border-gray-300 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chip</label>
                  <select value={cv.chipId || ''} onChange={e => {
                    const chip = chips.find(c => String(c.id) === e.target.value);
                    atualizar(idx, 'chipId', e.target.value);
                    if (chip?.numero) atualizar(idx, 'telefone', chip.numero);
                  }} className="w-full rounded-lg border-gray-300 text-sm">
                    <option value="">Selecionar chip...</option>
                    {chips.map(c => (
                      <option key={c.id} value={c.id}>{c.nome || c.instanciaEvolution}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número do WhatsApp (com DDI, sem + ou espaços)</label>
                <input type="text" value={cv.telefone} onChange={e => atualizar(idx, 'telefone', e.target.value)}
                  placeholder="Ex: 5511999999999" className="w-full rounded-lg border-gray-300 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Esse é o número que aparece no link do WhatsApp. Confirme com o chip selecionado.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem pré-preenchida</label>
                <input type="text" value={cv.mensagem} onChange={e => atualizar(idx, 'mensagem', e.target.value)}
                  placeholder="Ex: Olá! Quero saber mais sobre o produto." className="w-full rounded-lg border-gray-300 text-sm" />
                <p className="text-xs text-gray-400 mt-1">O código <code className="bg-gray-100 px-1 rounded">[ref:cv{idx+1}|campanha|criativo|fonte]</code> será adicionado automaticamente pelo script.</p>
              </div>

              {/* Script gerado */}
              {cv.telefone && cv.telefone !== '__manual' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Script para a página</label>
                    <CopiarBtn texto={gerarScript(cv, idx)} />
                  </div>
                  <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">{gerarScript(cv, idx)}</pre>
                  <p className="text-xs text-gray-400 mt-1">Cole esse script antes do <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> da sua landing page.</p>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={salvar} disabled={salvando}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {salvoOk ? <><Check size={16} /> Salvo!</> : salvando ? 'Salvando...' : 'Salvar todas as páginas'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Page Modelo ────────────────────────────────────────────────── */}
      {aba === 'modelo' && <PageModelo />}

      {/* ─── Guia Facebook ──────────────────────────────────────────────── */}
      {aba === 'facebook' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800 font-medium">Para rastrear vendas que vieram dos seus anúncios no Facebook/Instagram, siga os passos abaixo.</p>
          </div>

          {[
            {
              titulo: '1. Criar o Pixel (se ainda não tiver)',
              passos: [
                'Acesse business.facebook.com',
                'Menu → Events Manager → Conectar fontes de dados',
                'Escolha "Web" → dê um nome ao pixel → clique em Criar',
                'Anote o Pixel ID (número que aparece no topo)',
              ]
            },
            {
              titulo: '2. Gerar o Access Token',
              passos: [
                'No Events Manager, selecione seu pixel',
                'Clique na aba "Configurações"',
                'Role até "API de Conversões"',
                'Clique em "Gerar token de acesso"',
                'Copie o token e cole em Configurações → Eventos → Meta',
              ]
            },
            {
              titulo: '3. Configurar o anúncio',
              passos: [
                'No Gerenciador de Anúncios, crie uma campanha com objetivo "Mensagem" ou "Vendas"',
                'No campo URL de destino, coloque: seusite.com/cv1',
                'Em "Parâmetros de URL" adicione:',
              ],
              codigo: 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}',
              dicaCodigo: '{{campaign.name}} e {{ad.name}} são preenchidos automaticamente pelo Meta',
            },
            {
              titulo: '4. Ativar no CRM',
              passos: [
                'Vá em Configurações → Eventos',
                'Cole o Pixel ID e o Access Token no painel Meta',
                'Ative o toggle',
                'Clique em "Testar" para verificar a conexão',
              ]
            },
            {
              titulo: '5. Como funciona',
              passos: [
                'A pessoa vê o anúncio com utm_campaign=criativo1',
                'Clica e vai para seusite.com/cv1?utm_campaign=criativo1',
                'O script injeta [ref:cv1|criativo1|meta] na mensagem do WhatsApp',
                'O CRM salva a origem no lead automaticamente',
                'Quando o PIX é confirmado, o evento Purchase é enviado para o Meta com o valor exato',
                'O Meta cruza o telefone do cliente com quem clicou no anúncio',
              ]
            },
          ].map((bloco, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-800">{bloco.titulo}</h3>
              <ul className="space-y-1.5">
                {bloco.passos.map((p, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-primary-500 mt-0.5">→</span> {p}
                  </li>
                ))}
              </ul>
              {bloco.codigo && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Parâmetros UTM:</span>
                    <CopiarBtn texto={bloco.codigo} />
                  </div>
                  <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto">{bloco.codigo}</pre>
                  {bloco.dicaCodigo && <p className="text-xs text-gray-400 mt-1">💡 {bloco.dicaCodigo}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Guia TikTok ────────────────────────────────────────────────── */}
      {aba === 'tiktok' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-white font-medium">Para rastrear vendas que vieram dos seus anúncios no TikTok, siga os passos abaixo.</p>
          </div>

          {[
            {
              titulo: '1. Criar o Pixel no TikTok',
              passos: [
                'Acesse ads.tiktok.com',
                'Menu → Assets → Events',
                'Clique em "Web Events" → "Create Pixel"',
                'Escolha "TikTok Pixel" → "Manual setup"',
                'Anote o Pixel Code (começa com C...)',
              ]
            },
            {
              titulo: '2. Gerar o Access Token',
              passos: [
                'Na mesma tela do pixel criado, clique em "Generate Access Token"',
                'Ou vá em: Assets → Events → seu pixel → Settings → Generate Access Token',
                'Copie o token e cole em Configurações → Eventos → TikTok',
              ]
            },
            {
              titulo: '3. Configurar o anúncio',
              passos: [
                'No TikTok Ads Manager, crie uma campanha com objetivo "Mensagem" ou "Conversão"',
                'No campo URL de destino, coloque: seusite.com/cv1',
                'Em "Tracking" → "URL Parameters" adicione:',
              ],
              codigo: 'utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CREATIVE_NAME__',
              dicaCodigo: '__CAMPAIGN_NAME__ e __CREATIVE_NAME__ são preenchidos automaticamente pelo TikTok',
            },
            {
              titulo: '4. Ativar no CRM',
              passos: [
                'Vá em Configurações → Eventos',
                'Cole o Pixel Code e o Access Token no painel TikTok',
                'Ative o toggle',
                'Clique em "Testar" para verificar a conexão',
              ]
            },
            {
              titulo: '5. Como funciona',
              passos: [
                'A pessoa vê o anúncio com utm_campaign=criativo1',
                'Clica e vai para seusite.com/cv1?utm_campaign=criativo1&utm_source=tiktok',
                'O script injeta [ref:cv1|criativo1||tiktok] na mensagem do WhatsApp',
                'O CRM salva a origem no lead automaticamente',
                'Quando o PIX é confirmado, o evento PlaceAnOrder é enviado para o TikTok com o valor exato',
                'O TikTok cruza o telefone do cliente com quem clicou no anúncio',
              ]
            },
            {
              titulo: '6. Diferença dos parâmetros dinâmicos',
              passos: [
                'Meta usa: {{campaign.name}} com chaves duplas',
                'TikTok usa: __CAMPAIGN_NAME__ com underscores',
                'Ambos funcionam igual — cada plataforma preenche automaticamente com os nomes reais',
              ]
            },
          ].map((bloco, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-800">{bloco.titulo}</h3>
              <ul className="space-y-1.5">
                {bloco.passos.map((p, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 mt-0.5">→</span> {p}
                  </li>
                ))}
              </ul>
              {bloco.codigo && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Parâmetros UTM:</span>
                    <CopiarBtn texto={bloco.codigo} />
                  </div>
                  <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto">{bloco.codigo}</pre>
                  {bloco.dicaCodigo && <p className="text-xs text-gray-400 mt-1">💡 {bloco.dicaCodigo}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
