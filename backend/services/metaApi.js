// Client para Meta WhatsApp Business Cloud API
// Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const mime = require('mime-types');

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

// Faz request autenticado para a API da Meta
function metaClient(accessToken) {
  return axios.create({
    baseURL: GRAPH_BASE,
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 30000,
  });
}

// Normaliza resposta de envio para formato padrão { messages: [{ id: wamid }] }
function normalizarResposta(data) {
  if (data?.messages) return data;
  return { messages: [{ id: data?.id || data?.message_id || null }] };
}

// Faz upload de mídia para a Meta e retorna o media_id
async function uploadMidia(phoneNumberId, accessToken, filePath) {
  const absPath = filePath.startsWith('/uploads/')
    ? path.join(path.resolve(__dirname, '..', '..', 'uploads'), filePath.replace('/uploads/', ''))
    : filePath;

  const form = new FormData();
  form.append('file', fs.createReadStream(absPath));
  form.append('messaging_product', 'whatsapp');

  const res = await axios.post(`${GRAPH_BASE}/${phoneNumberId}/media`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 60000,
  });
  return res.data?.id;
}

// Enviar mensagem de texto
async function enviarTexto(phoneNumberId, telefone, mensagem, accessToken) {
  const client = metaClient(accessToken);
  const res = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to: telefone,
    type: 'text',
    text: { body: mensagem },
  });
  return normalizarResposta(res.data);
}

// Enviar imagem
async function enviarImagem(phoneNumberId, telefone, imagemUrl, legenda = '', accessToken) {
  const client = metaClient(accessToken);
  const isLocal = imagemUrl && !imagemUrl.startsWith('http');

  let body;
  if (isLocal) {
    const mediaId = await uploadMidia(phoneNumberId, accessToken, imagemUrl);
    body = { messaging_product: 'whatsapp', to: telefone, type: 'image', image: { id: mediaId, caption: legenda } };
  } else {
    body = { messaging_product: 'whatsapp', to: telefone, type: 'image', image: { link: imagemUrl, caption: legenda } };
  }

  const res = await client.post(`/${phoneNumberId}/messages`, body);
  return normalizarResposta(res.data);
}

// Enviar áudio
async function enviarAudio(phoneNumberId, telefone, audioUrl, accessToken) {
  const client = metaClient(accessToken);
  const isLocal = audioUrl && !audioUrl.startsWith('http');

  let body;
  if (isLocal) {
    const mediaId = await uploadMidia(phoneNumberId, accessToken, audioUrl);
    body = { messaging_product: 'whatsapp', to: telefone, type: 'audio', audio: { id: mediaId } };
  } else {
    body = { messaging_product: 'whatsapp', to: telefone, type: 'audio', audio: { link: audioUrl } };
  }

  const res = await client.post(`/${phoneNumberId}/messages`, body);
  return normalizarResposta(res.data);
}

// Enviar vídeo
async function enviarVideo(phoneNumberId, telefone, videoUrl, legenda = '', accessToken) {
  const client = metaClient(accessToken);
  const isLocal = videoUrl && !videoUrl.startsWith('http');

  let body;
  if (isLocal) {
    const mediaId = await uploadMidia(phoneNumberId, accessToken, videoUrl);
    body = { messaging_product: 'whatsapp', to: telefone, type: 'video', video: { id: mediaId, caption: legenda } };
  } else {
    body = { messaging_product: 'whatsapp', to: telefone, type: 'video', video: { link: videoUrl, caption: legenda } };
  }

  const res = await client.post(`/${phoneNumberId}/messages`, body);
  return normalizarResposta(res.data);
}

// Enviar documento/PDF
async function enviarDocumento(phoneNumberId, telefone, docUrl, nomeArquivo = 'documento.pdf', accessToken) {
  const client = metaClient(accessToken);
  const isLocal = docUrl && !docUrl.startsWith('http');

  let body;
  if (isLocal) {
    const mediaId = await uploadMidia(phoneNumberId, accessToken, docUrl);
    body = { messaging_product: 'whatsapp', to: telefone, type: 'document', document: { id: mediaId, filename: nomeArquivo } };
  } else {
    body = { messaging_product: 'whatsapp', to: telefone, type: 'document', document: { link: docUrl, filename: nomeArquivo } };
  }

  const res = await client.post(`/${phoneNumberId}/messages`, body);
  return normalizarResposta(res.data);
}

// Verificar se as credenciais são válidas (GET no phoneNumberId)
async function verificarStatus(phoneNumberId, accessToken) {
  try {
    const client = metaClient(accessToken);
    await client.get(`/${phoneNumberId}`, { params: { fields: 'id,display_phone_number' } });
    return { state: 'open', instance: { instanceName: phoneNumberId, state: 'open' } };
  } catch {
    return { state: 'close', instance: { instanceName: phoneNumberId, state: 'close' } };
  }
}

// Marcar mensagem como lida
async function marcarComoLido(phoneNumberId, accessToken, wamid) {
  try {
    const client = metaClient(accessToken);
    await client.post(`/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: wamid,
    });
  } catch {}
}

// Baixar mídia recebida via webhook
async function baixarMidia(mediaId, accessToken, ext, destDir, clienteId) {
  try {
    const client = metaClient(accessToken);
    const infoRes = await client.get(`/${mediaId}`);
    const downloadUrl = infoRes.data?.url;
    if (!downloadUrl) return null;

    const mediaRes = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 30000,
    });

    const nomeArq = `recebido_${clienteId}_${Date.now()}.${ext}`;
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, nomeArq), Buffer.from(mediaRes.data));
    return `/uploads/recebidos/${nomeArq}`;
  } catch (e) {
    console.error('[MetaApi] Erro ao baixar mídia:', e.message);
    return null;
  }
}

// Stubs para funções não aplicáveis na API oficial
async function criarInstancia() { return { ok: true }; }
async function gerarQRCode() { return { base64: null }; }
async function gerarPairingCode() { return { code: null }; }
async function deletarInstancia() { return null; }
async function listarGrupos() { return []; }
async function configurarWebhook() { return { ok: true }; }
async function listarEtiquetas() { return []; }
async function aplicarEtiqueta() { return null; }
async function registrarChavePix() { return null; }

module.exports = {
  enviarTexto,
  enviarImagem,
  enviarAudio,
  enviarVideo,
  enviarDocumento,
  verificarStatus,
  marcarComoLido,
  baixarMidia,
  criarInstancia,
  gerarQRCode,
  gerarPairingCode,
  deletarInstancia,
  configurarWebhook,
  listarGrupos,
  listarEtiquetas,
  aplicarEtiqueta,
  registrarChavePix,
};
