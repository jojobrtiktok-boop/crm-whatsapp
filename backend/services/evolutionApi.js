// Cliente para WPPConnect Server
// Suporta mídia e @lid via WhatsApp Web injection
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const config = require('../config');

const BASE_URL = config.evolution.url;
const SECRET_KEY = config.evolution.apiKey;

// Cache de tokens por sessão
const tokenCache = {};

// Formata número para WPPConnect (mantém @lid, converte outros)
function formatPhone(telefone) {
  if (!telefone) return telefone;
  if (telefone.includes('@lid')) return telefone;
  if (telefone.includes('@g.us')) return telefone;
  if (telefone.includes('@s.whatsapp.net')) return telefone.replace('@s.whatsapp.net', '@c.us');
  if (telefone.includes('@c.us')) return telefone;
  return `${telefone}@c.us`;
}

// Obtém token da sessão (gera se não existir)
// WPPConnect: secretKey vai na URL - POST /api/:session/:secretkey/generate-token
async function getToken(sessao) {
  if (tokenCache[sessao]) return tokenCache[sessao];

  const response = await axios.post(
    `${BASE_URL}/api/${sessao}/${SECRET_KEY}/generate-token`,
    {},
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  const token = response.data?.token;
  if (token) tokenCache[sessao] = token;
  return token;
}

// Cria cliente axios autenticado para uma sessão
async function apiFor(sessao) {
  const token = await getToken(sessao);
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    timeout: 30000,
  });
}

// Diretório base de uploads (crm-whatsapp/uploads)
const UPLOAD_BASE = path.resolve(__dirname, '..', '..', 'uploads');

// Converte URL relativa de upload (/uploads/funil/...) para caminho absoluto no disco
function resolveUploadPath(urlOrPath) {
  if (!urlOrPath || urlOrPath.startsWith('http')) return urlOrPath;
  if (urlOrPath.startsWith('/uploads/')) {
    return path.join(UPLOAD_BASE, urlOrPath.replace('/uploads/', ''));
  }
  return urlOrPath; // já é caminho absoluto
}

// Converte arquivo local para base64 com data URI
function toDataUri(filePath) {
  const absPath = resolveUploadPath(filePath);
  const data = fs.readFileSync(absPath).toString('base64');
  const mimetype = mime.lookup(absPath) || 'application/octet-stream';
  return `data:${mimetype};base64,${data}`;
}

// Enviar mensagem de texto
async function enviarTexto(sessao, telefone, mensagem) {
  const api = await apiFor(sessao);
  const response = await api.post(`/api/${sessao}/send-message`, {
    phone: formatPhone(telefone),
    message: mensagem,
    isGroup: false,
  });
  return response.data;
}

// Enviar imagem
async function enviarImagem(sessao, telefone, imagemUrl, legenda = '') {
  const api = await apiFor(sessao);
  const isLocal = imagemUrl && !imagemUrl.startsWith('http');
  const body = isLocal
    ? {
        phone: formatPhone(telefone),
        base64: toDataUri(imagemUrl),
        filename: path.basename(imagemUrl),
        caption: legenda,
      }
    : {
        phone: formatPhone(telefone),
        path: imagemUrl,
        caption: legenda,
      };
  const response = await api.post(`/api/${sessao}/send-image`, body);
  return response.data;
}

// Enviar áudio (PTT para OGG/Opus, ou áudio regular para MP3/WAV/M4A)
async function enviarAudio(sessao, telefone, audioUrl) {
  const api = await apiFor(sessao);
  const isLocal = audioUrl && !audioUrl.startsWith('http');
  const ext = path.extname(audioUrl || '').toLowerCase();
  const isOgg = ['.ogg', '.opus'].includes(ext);

  if (isOgg) {
    const response = await api.post(`/api/${sessao}/send-voice`, {
      phone: formatPhone(telefone),
      base64: isLocal ? toDataUri(audioUrl) : audioUrl,
    });
    return response.data;
  } else {
    // MP3, WAV, M4A etc → send-file-base64 como áudio
    const filename = path.basename(audioUrl || 'audio.mp3');
    const response = await api.post(`/api/${sessao}/send-file-base64`, {
      phone: formatPhone(telefone),
      base64: isLocal ? toDataUri(audioUrl) : audioUrl,
      filename,
      caption: '',
    });
    return response.data;
  }
}

// Enviar vídeo
async function enviarVideo(sessao, telefone, videoUrl, legenda = '') {
  const api = await apiFor(sessao);
  const isLocal = videoUrl && !videoUrl.startsWith('http');
  const response = await api.post(`/api/${sessao}/send-file-base64`, {
    phone: formatPhone(telefone),
    base64: isLocal ? toDataUri(videoUrl) : videoUrl,
    filename: path.basename(videoUrl || 'video.mp4'),
    caption: legenda,
  });
  return response.data;
}

// Enviar documento/PDF
async function enviarDocumento(sessao, telefone, docUrl, nomeArquivo = 'documento.pdf') {
  const api = await apiFor(sessao);
  const isLocal = docUrl && !docUrl.startsWith('http');
  const response = await api.post(`/api/${sessao}/send-file-base64`, {
    phone: formatPhone(telefone),
    base64: isLocal ? toDataUri(docUrl) : docUrl,
    filename: nomeArquivo || path.basename(docUrl),
    caption: '',
  });
  return response.data;
}

// Enviar botões como texto
async function enviarBotoes(sessao, telefone, titulo, mensagem, botoes) {
  const opcoes = botoes.map((b, i) => `${i + 1}. ${b.texto}`).join('\n');
  return enviarTexto(sessao, telefone, `${mensagem}\n\n${opcoes}`);
}

// Mapa: tipo do CRM → keyType WPPConnect (1=phone, 2=CPF, 3=CNPJ, 4=email, 5=random)
const PIX_KEY_TYPE = { telefone: 1, cpf: 2, cnpj: 3, email: 4, aleatoria: 5 };

// Enviar card PIX nativo do WhatsApp (botão "Copiar chave Pix")
// Requer WhatsApp Business + conta BR
async function enviarPix(sessao, telefone, chave, tipo, nomeMerchant = '', cidade = 'Brasil', mensagem = '') {
  const api = await apiFor(sessao);
  const keyType = PIX_KEY_TYPE[tipo] || 2;
  try {
    // Tenta o endpoint nativo do WPPConnect
    const response = await api.post(`/api/${sessao}/send-pix`, {
      phone: formatPhone(telefone),
      key: chave,
      keyType,
      amount: 0,
      name: nomeMerchant || 'Pagamento',
      city: cidade,
    });
    // Se havia mensagem introdutória, envia antes
    if (mensagem) {
      await api.post(`/api/${sessao}/send-message`, {
        phone: formatPhone(telefone),
        message: mensagem,
        isGroup: false,
      });
    }
    return response.data;
  } catch (err) {
    // Fallback: envia como texto formatado caso o endpoint não exista na versão
    const TIPO_LABEL = { telefone: 'Telefone', cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', aleatoria: 'Chave Aleatória' };
    const intro = mensagem ? mensagem + '\n\n' : '';
    const txt = `${intro}💳 *Pagamento via PIX*\n\nTipo: *${TIPO_LABEL[tipo] || 'Chave'}*\n\n${chave}\n\n_Copie a chave acima e pague pelo app do seu banco_ ✅`;
    return enviarTexto(sessao, telefone, txt);
  }
}

// Verificar status da sessão
async function verificarStatus(sessao) {
  try {
    const api = await apiFor(sessao);
    const response = await api.get(`/api/${sessao}/status-session`);
    const status = response.data?.status;
    const state = status === 'CONNECTED' ? 'open' : 'close';
    return { instance: { instanceName: sessao, state }, state };
  } catch {
    return { instance: { instanceName: sessao, state: 'close' }, state: 'close' };
  }
}

// Criar/iniciar sessão
async function criarInstancia(nomeSessao) {
  try {
    const token = await getToken(nomeSessao);
    const api = axios.create({
      baseURL: BASE_URL,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      timeout: 30000,
    });
    const response = await api.post(`/api/${nomeSessao}/start-session`, {
      webhook: null,
      waitQrCode: false,
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 422 || err.response?.status === 409) {
      return { session: nomeSessao };
    }
    throw err;
  }
}

// Gerar QR Code
async function gerarQRCode(sessao) {
  // Forçar token fresco
  delete tokenCache[sessao];

  const token = await getToken(sessao);
  if (!token) throw new Error('Falha ao obter token da sessao');

  const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    timeout: 15000,
  });

  // Garantir sessão iniciada (entra em estado QRCODE)
  await api.post(`/api/${sessao}/start-session`, { webhook: null, waitQrCode: false }).catch(() => {});

  // Aguardar QR ficar disponível (até 5 tentativas × 2s = 10s)
  for (let attempt = 1; attempt <= 5; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const response = await api.get(`/api/${sessao}/qrcode-session`);
      const base64 = response.data?.base64 || response.data?.qrcode || null;
      if (base64) {
        console.log(`[QR] ${sessao} obtido na tentativa ${attempt}`);
        return { base64 };
      }
      console.log(`[QR] ${sessao} tentativa ${attempt}: sem base64, status=${JSON.stringify(response.data?.status)}`);
    } catch (e) {
      console.log(`[QR] ${sessao} tentativa ${attempt} erro:`, e.response?.status, e.response?.data || e.message);
    }
  }

  console.log(`[QR] ${sessao} nao obteve QR em 5 tentativas`);
  return { base64: null };
}

// Gerar código de pareamento
async function gerarPairingCode(sessao, telefone) {
  const token = await getToken(sessao);
  const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    timeout: 30000,
  });

  // Garantir que a sessão está iniciada
  await api.post(`/api/${sessao}/start-session`, { webhook: null, waitQrCode: false }).catch(() => {});

  // Solicitar pairing code (o endpoint espera a sessão entrar em QRCODE)
  const response = await api.post(`/api/${sessao}/request-pairing-code`, {
    phone: telefone.replace(/\D/g, ''),
  });
  const code = response.data?.code;
  return { code };
}

// Deletar sessão
async function deletarInstancia(sessao) {
  if (!sessao) return;
  try {
    const api = await apiFor(sessao);
    const response = await api.post(`/api/${sessao}/close-session`);
    delete tokenCache[sessao];
    return response.data;
  } catch {
    return null;
  }
}

// Configurar webhook
async function configurarWebhook(sessao, webhookUrl) {
  try {
    const api = await apiFor(sessao);
    await api.post(`/api/${sessao}/start-session`, {
      webhook: {
        url: webhookUrl,
        autoDownload: false,
        readMessage: true,
        listenAcks: true,
      },
      waitQrCode: false,
    });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// Baixar mídia (não disponível diretamente no WPPConnect)
async function baixarMidia(sessao, messageId) {
  return null;
}

// Listar etiquetas disponíveis (WhatsApp Business)
async function listarEtiquetas(sessao) {
  try {
    const api = await apiFor(sessao);
    const response = await api.get(`/api/${sessao}/list-labels`);
    return response.data?.labels || [];
  } catch {
    return [];
  }
}

// Aplicar etiqueta a um contato (WhatsApp Business)
async function aplicarEtiqueta(sessao, telefone, labelId) {
  const api = await apiFor(sessao);
  const response = await api.post(`/api/${sessao}/label-chat`, {
    phone: formatPhone(telefone),
    labelId: String(labelId),
  });
  return response.data;
}

// Buscar foto de perfil
async function buscarFotoPerfil(sessao, telefone) {
  try {
    const api = await apiFor(sessao);
    const response = await api.get(`/api/${sessao}/profile-pic`, {
      params: { phone: formatPhone(telefone) },
    });
    return response.data?.profilePic || null;
  } catch {
    return null;
  }
}

module.exports = {
  enviarTexto,
  enviarImagem,
  enviarAudio,
  enviarVideo,
  enviarDocumento,
  enviarBotoes,
  enviarPix,
  verificarStatus,
  criarInstancia,
  gerarQRCode,
  gerarPairingCode,
  deletarInstancia,
  configurarWebhook,
  baixarMidia,
  buscarFotoPerfil,
  listarEtiquetas,
  aplicarEtiqueta,
  formatChatId: formatPhone,
};
