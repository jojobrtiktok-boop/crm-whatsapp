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

// Converte arquivo local para base64 com data URI
function toDataUri(filePath) {
  const data = fs.readFileSync(filePath).toString('base64');
  const mimetype = mime.lookup(filePath) || 'application/octet-stream';
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

// Enviar áudio PTT
async function enviarAudio(sessao, telefone, audioUrl) {
  const api = await apiFor(sessao);
  const isLocal = audioUrl && !audioUrl.startsWith('http');
  const response = await api.post(`/api/${sessao}/send-voice`, {
    phone: formatPhone(telefone),
    base64: isLocal ? toDataUri(audioUrl) : audioUrl,
  });
  return response.data;
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
  await criarInstancia(sessao).catch(() => {});
  const api = await apiFor(sessao);
  const response = await api.get(`/api/${sessao}/qrcode-session`);
  const base64 = response.data?.base64 || response.data?.qrcode || null;
  return { base64 };
}

// Gerar código de pareamento
async function gerarPairingCode(sessao, telefone) {
  // WPPConnect não suporta pairing code nativamente - fallback para QR
  return gerarQRCode(sessao);
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
  verificarStatus,
  criarInstancia,
  gerarQRCode,
  gerarPairingCode,
  deletarInstancia,
  configurarWebhook,
  baixarMidia,
  buscarFotoPerfil,
  formatChatId: formatPhone,
};
