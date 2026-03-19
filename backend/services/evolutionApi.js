// Cliente para WAHA (WhatsApp HTTP API) - substitui Evolution API
// Suporta @lid nativamente via engine NOWEB (Baileys)
const axios = require('axios');
const config = require('../config');

const api = axios.create({
  baseURL: config.evolution.url,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': config.evolution.apiKey,
  },
  timeout: 30000,
});

// Converte número/JID para formato WAHA (@c.us)
function formatChatId(telefone) {
  if (!telefone) return telefone;
  if (telefone.includes('@lid')) return telefone;           // @lid: manter
  if (telefone.includes('@s.whatsapp.net')) return telefone.replace('@s.whatsapp.net', '@c.us');
  if (telefone.includes('@c.us')) return telefone;
  if (telefone.includes('@g.us')) return telefone;
  return `${telefone}@c.us`;
}

// Enviar mensagem de texto
async function enviarTexto(instancia, telefone, mensagem) {
  const response = await api.post('/api/sendText', {
    chatId: formatChatId(telefone),
    text: mensagem,
    session: instancia,
  });
  return response.data;
}

// Enviar imagem
async function enviarImagem(instancia, telefone, imagemUrl, legenda = '') {
  const response = await api.post('/api/sendImage', {
    chatId: formatChatId(telefone),
    file: { url: imagemUrl },
    caption: legenda,
    session: instancia,
  });
  return response.data;
}

// Enviar áudio
async function enviarAudio(instancia, telefone, audioUrl) {
  const response = await api.post('/api/sendVoice', {
    chatId: formatChatId(telefone),
    file: { url: audioUrl },
    session: instancia,
  });
  return response.data;
}

// Enviar vídeo
async function enviarVideo(instancia, telefone, videoUrl, legenda = '') {
  const response = await api.post('/api/sendVideo', {
    chatId: formatChatId(telefone),
    file: { url: videoUrl },
    caption: legenda,
    session: instancia,
  });
  return response.data;
}

// Enviar documento/PDF
async function enviarDocumento(instancia, telefone, docUrl, nomeArquivo = 'documento.pdf') {
  const response = await api.post('/api/sendFile', {
    chatId: formatChatId(telefone),
    file: { url: docUrl, name: nomeArquivo },
    session: instancia,
  });
  return response.data;
}

// Enviar lista/botões (WAHA não tem botões nativos - envia como texto)
async function enviarBotoes(instancia, telefone, titulo, mensagem, botoes) {
  const opcoes = botoes.map((b, i) => `${i + 1}. ${b.texto}`).join('\n');
  return enviarTexto(instancia, telefone, `${mensagem}\n\n${opcoes}`);
}

// Verificar status da instância
async function verificarStatus(instancia) {
  try {
    const response = await api.get(`/api/sessions/${instancia}`);
    const status = response.data?.status;
    const state = status === 'WORKING' ? 'open' : 'close';
    return { instance: { instanceName: instancia, state }, state };
  } catch {
    return { instance: { instanceName: instancia, state: 'close' }, state: 'close' };
  }
}

// Criar instância/sessão
async function criarInstancia(nomeInstancia) {
  try {
    const response = await api.post('/api/sessions', { name: nomeInstancia });
    return response.data;
  } catch (err) {
    if (err.response?.status === 422 || err.response?.status === 409) {
      return { name: nomeInstancia };
    }
    throw err;
  }
}

// Gerar QR Code para conectar
async function gerarQRCode(instancia) {
  // Garantir que a sessão existe
  await criarInstancia(instancia).catch(() => {});

  // Buscar QR Code - WAHA usa /api/{session}/auth/qr (sem "sessions/")
  try {
    const response = await api.get(`/api/${instancia}/auth/qr`, {
      params: { format: 'image' },
      responseType: 'arraybuffer',
    });
    const base64 = `data:image/png;base64,${Buffer.from(response.data).toString('base64')}`;
    return { base64 };
  } catch {
    // Tentar formato JSON
    const response = await api.get(`/api/${instancia}/auth/qr`);
    return { base64: response.data?.value || response.data?.qr || null };
  }
}

// Gerar código de pareamento por número
async function gerarPairingCode(instancia, telefone) {
  await criarInstancia(instancia).catch(() => {});
  try {
    const response = await api.post(`/api/${instancia}/auth/request-code`, {
      phoneNumber: telefone.replace(/\D/g, ''),
    });
    return { code: response.data?.code };
  } catch (err) {
    throw err;
  }
}

// Deletar instância
async function deletarInstancia(instancia) {
  if (!instancia) return;
  try {
    const response = await api.delete(`/api/sessions/${instancia}`);
    return response.data;
  } catch {
    return null;
  }
}

// Configurar webhook da instância
async function configurarWebhook(instancia, webhookUrl) {
  try {
    const response = await api.put(`/api/sessions/${instancia}`, {
      config: {
        webhooks: [{
          url: webhookUrl,
          events: ['message', 'message.ack', 'session.status'],
        }],
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
    const response = await api.get(`/api/messages/${messageId}/download`, {
      params: { session: instancia },
    });
    return response.data;
  } catch {
    return null;
  }
}

// Buscar foto de perfil
async function buscarFotoPerfil(instancia, telefone) {
  try {
    const response = await api.get('/api/contacts/profile-picture', {
      params: { contactId: formatChatId(telefone), session: instancia },
    });
    return response.data?.profilePictureUrl || response.data?.url || null;
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
  formatChatId,
};
