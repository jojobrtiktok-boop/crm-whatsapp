// Cliente para a Evolution API (conexão WhatsApp)
const axios = require('axios');
const config = require('../config');

const api = axios.create({
  baseURL: config.evolution.url,
  headers: {
    'Content-Type': 'application/json',
    apikey: config.evolution.apiKey,
  },
});

// Enviar mensagem de texto
async function enviarTexto(instancia, telefone, mensagem) {
  const response = await api.post(`/message/sendText/${instancia}`, {
    number: telefone,
    text: mensagem,
  });
  return response.data;
}

// Enviar imagem
async function enviarImagem(instancia, telefone, imagemUrl, legenda = '') {
  const response = await api.post(`/message/sendMedia/${instancia}`, {
    number: telefone,
    mediatype: 'image',
    media: imagemUrl,
    caption: legenda,
  });
  return response.data;
}

// Enviar áudio
async function enviarAudio(instancia, telefone, audioUrl) {
  const response = await api.post(`/message/sendWhatsAppAudio/${instancia}`, {
    number: telefone,
    audio: audioUrl,
  });
  return response.data;
}

// Enviar vídeo
async function enviarVideo(instancia, telefone, videoUrl, legenda = '') {
  const response = await api.post(`/message/sendMedia/${instancia}`, {
    number: telefone,
    mediatype: 'video',
    media: videoUrl,
    caption: legenda,
  });
  return response.data;
}

// Enviar mensagem com botões
async function enviarBotoes(instancia, telefone, titulo, mensagem, botoes) {
  const response = await api.post(`/message/sendList/${instancia}`, {
    number: telefone,
    title: titulo,
    description: mensagem,
    buttonText: 'Escolha uma opção',
    sections: [
      {
        title: 'Opções',
        rows: botoes.map((b) => ({
          title: b.texto,
          rowId: b.valor,
        })),
      },
    ],
  });
  return response.data;
}

// Verificar status da instância
async function verificarStatus(instancia) {
  try {
    const response = await api.get(`/instance/connectionState/${instancia}`);
    return response.data;
  } catch {
    return { state: 'close' };
  }
}

// Criar instância
async function criarInstancia(nomeInstancia) {
  const response = await api.post('/instance/create', {
    instanceName: nomeInstancia,
    integration: 'WHATSAPP-BAILEYS',
  });
  return response.data;
}

// Gerar QR Code para conectar
async function gerarQRCode(instancia) {
  const response = await api.get(`/instance/connect/${instancia}`);
  return response.data;
}

// Configurar webhook da instância
async function configurarWebhook(instancia, webhookUrl) {
  const response = await api.post(`/webhook/set/${instancia}`, {
    url: webhookUrl,
    webhook_by_events: false,
    events: [
      'MESSAGES_UPSERT',
      'CONNECTION_UPDATE',
    ],
  });
  return response.data;
}

// Baixar mídia de uma mensagem
async function baixarMidia(instancia, messageId) {
  const response = await api.get(`/chat/getBase64FromMediaMessage/${instancia}`, {
    params: { messageId },
  });
  return response.data;
}

module.exports = {
  enviarTexto,
  enviarImagem,
  enviarAudio,
  enviarVideo,
  enviarBotoes,
  verificarStatus,
  criarInstancia,
  gerarQRCode,
  configurarWebhook,
  baixarMidia,
};
