// Cliente para Evolution API v1.8.x (Baileys)
// Suporta @lid nativamente
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const config = require('../config');

const api = axios.create({
  baseURL: config.evolution.url,
  headers: {
    'Content-Type': 'application/json',
    'apikey': config.evolution.apiKey,
  },
  timeout: 30000,
});

// Formata número: remove sufixos @c.us/@s.whatsapp.net, mantém @lid e @g.us
function formatNumber(telefone) {
  if (!telefone) return telefone;
  if (telefone.includes('@lid')) return telefone;
  if (telefone.includes('@g.us')) return telefone;
  if (telefone.includes('@s.whatsapp.net')) return telefone.replace('@s.whatsapp.net', '');
  if (telefone.includes('@c.us')) return telefone.replace('@c.us', '');
  return telefone;
}

// Lê arquivo local e retorna base64
function toBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

// Enviar mensagem de texto (v1 format)
async function enviarTexto(instancia, telefone, mensagem) {
  const response = await api.post(`/message/sendText/${instancia}`, {
    number: formatNumber(telefone),
    options: { delay: 1200, presence: 'composing' },
    textMessage: { text: mensagem },
  });
  return response.data;
}

// Enviar imagem (v1 format)
async function enviarImagem(instancia, telefone, imagemUrl, legenda = '') {
  const isLocal = imagemUrl && !imagemUrl.startsWith('http');
  const mediaMessage = isLocal
    ? {
        mediatype: 'image',
        mimetype: mime.lookup(imagemUrl) || 'image/jpeg',
        caption: legenda,
        media: toBase64(imagemUrl),
        fileName: path.basename(imagemUrl),
      }
    : {
        mediatype: 'image',
        caption: legenda,
        media: imagemUrl,
      };
  const response = await api.post(`/message/sendMedia/${instancia}`, {
    number: formatNumber(telefone),
    options: { delay: 1200 },
    mediaMessage,
  });
  return response.data;
}

// Enviar áudio PTT (v1 format)
async function enviarAudio(instancia, telefone, audioUrl) {
  const isLocal = audioUrl && !audioUrl.startsWith('http');
  const response = await api.post(`/message/sendWhatsAppAudio/${instancia}`, {
    number: formatNumber(telefone),
    options: { encoding: true },
    audioMessage: {
      audio: isLocal ? toBase64(audioUrl) : audioUrl,
    },
  });
  return response.data;
}

// Enviar vídeo (v1 format)
async function enviarVideo(instancia, telefone, videoUrl, legenda = '') {
  const isLocal = videoUrl && !videoUrl.startsWith('http');
  const mediaMessage = isLocal
    ? {
        mediatype: 'video',
        mimetype: mime.lookup(videoUrl) || 'video/mp4',
        caption: legenda,
        media: toBase64(videoUrl),
        fileName: path.basename(videoUrl),
      }
    : {
        mediatype: 'video',
        caption: legenda,
        media: videoUrl,
      };
  const response = await api.post(`/message/sendMedia/${instancia}`, {
    number: formatNumber(telefone),
    options: { delay: 1200 },
    mediaMessage,
  });
  return response.data;
}

// Enviar documento/PDF (v1 format)
async function enviarDocumento(instancia, telefone, docUrl, nomeArquivo = 'documento.pdf') {
  const isLocal = docUrl && !docUrl.startsWith('http');
  const mediaMessage = isLocal
    ? {
        mediatype: 'document',
        mimetype: mime.lookup(docUrl) || 'application/pdf',
        caption: '',
        media: toBase64(docUrl),
        fileName: nomeArquivo || path.basename(docUrl),
      }
    : {
        mediatype: 'document',
        caption: '',
        media: docUrl,
        fileName: nomeArquivo,
      };
  const response = await api.post(`/message/sendMedia/${instancia}`, {
    number: formatNumber(telefone),
    options: { delay: 1200 },
    mediaMessage,
  });
  return response.data;
}

// Enviar botões como texto
async function enviarBotoes(instancia, telefone, titulo, mensagem, botoes) {
  const opcoes = botoes.map((b, i) => `${i + 1}. ${b.texto}`).join('\n');
  return enviarTexto(instancia, telefone, `${mensagem}\n\n${opcoes}`);
}

// Verificar status da instância
async function verificarStatus(instancia) {
  try {
    const response = await api.get(`/instance/connectionState/${instancia}`);
    const state = response.data?.instance?.state || 'close';
    return { instance: { instanceName: instancia, state }, state };
  } catch {
    return { instance: { instanceName: instancia, state: 'close' }, state: 'close' };
  }
}

// Criar instância
async function criarInstancia(nomeInstancia) {
  try {
    const response = await api.post('/instance/create', {
      instanceName: nomeInstancia,
      token: config.evolution.apiKey,
      qrcode: true,
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 422 || err.response?.status === 409) {
      return { instance: { instanceName: nomeInstancia } };
    }
    throw err;
  }
}

// Gerar QR Code para conectar
async function gerarQRCode(instancia) {
  await criarInstancia(instancia).catch(() => {});

  const response = await api.get(`/instance/connect/${instancia}`);
  const base64 = response.data?.base64 || response.data?.qrcode?.base64 || null;
  return { base64 };
}

// Gerar código de pareamento por número
async function gerarPairingCode(instancia, telefone) {
  await criarInstancia(instancia).catch(() => {});
  const response = await api.post(`/instance/pairingCode/${instancia}`, {
    phoneNumber: telefone.replace(/\D/g, ''),
  });
  return { code: response.data?.code };
}

// Deletar instância
async function deletarInstancia(instancia) {
  if (!instancia) return;
  try {
    const response = await api.delete(`/instance/delete/${instancia}`);
    return response.data;
  } catch {
    return null;
  }
}

// Configurar webhook da instância
async function configurarWebhook(instancia, webhookUrl) {
  try {
    const response = await api.post(`/webhook/set/${instancia}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
      },
    });
    return response.data;
  } catch {
    return { ok: true };
  }
}

// Baixar mídia de uma mensagem
async function baixarMidia(instancia, messageId) {
  try {
    const response = await api.post(`/chat/getBase64FromMediaMessage/${instancia}`, {
      message: { key: { id: messageId } },
      convertToMp4: false,
    });
    return response.data;
  } catch {
    return null;
  }
}

// Buscar foto de perfil
async function buscarFotoPerfil(instancia, telefone) {
  try {
    const response = await api.post(`/chat/fetchProfilePictureUrl/${instancia}`, {
      number: formatNumber(telefone),
    });
    return response.data?.profilePictureUrl || null;
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
  formatChatId: formatNumber,
};
