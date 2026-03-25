import { useState, useEffect } from 'react';
import { Copy, Plus, Trash2, Check, Globe, BookOpen } from 'lucide-react';
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do chip (com DDI)</label>
                  <select value={cv.telefone} onChange={e => atualizar(idx, 'telefone', e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-sm">
                    <option value="">Selecionar chip...</option>
                    {chips.map(c => (
                      <option key={c.id} value={c.numero}>{c.nome || c.instanciaEvolution} — {c.numero}</option>
                    ))}
                    <option value="__manual">Digitar manualmente...</option>
                  </select>
                  {cv.telefone === '__manual' && (
                    <input type="text" onChange={e => atualizar(idx, 'telefone', e.target.value)}
                      placeholder="Ex: 5511999999999" className="w-full rounded-lg border-gray-300 text-sm mt-2" />
                  )}
                </div>
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
