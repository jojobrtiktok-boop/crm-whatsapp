// Rota de webhook - recebe eventos do WAHA (WhatsApp HTTP API)
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const config = require('../config');
const { buscarChipPorInstancia } = require('../services/chipDistributor');
const { iniciarFunil, processarRespostaFunil } = require('../services/funilEngine');
const { comprovanteQueue } = require('../queues/setup');
const { emitir } = require('../services/socketManager');

const prisma = new PrismaClient();

// POST /api/webhook/evolution - Recebe eventos do WAHA
router.post('/evolution', async (req, res) => {
  res.status(200).json({ recebido: true });

  try {
    const evento = req.body;
    // WAHA usa "session", Evolution usa "instance"
    const instancia = evento.session || evento.instance || evento.instanceName;

    if (!instancia) return;

    // === Formato WAHA ===
    if (evento.event === 'message' && evento.payload) {
      if (!evento.payload.fromMe) {
        await processarMensagemWaha(evento.payload, instancia);
      }
    } else if (evento.event === 'message.ack' && evento.payload) {
      await processarReciboWaha(evento.payload);
    } else if (evento.event === 'session.status' && evento.payload) {
      const state = evento.payload.status === 'WORKING' ? 'open' : 'close';
      emitir('chip:status', { instancia, status: state === 'open' ? 'online' : 'offline' });

    // === Formato WPPConnect ===
    } else if (evento.event === 'onmessage' && evento.data) {
      if (!evento.data.fromMe) {
        await processarMensagemWPP(evento.data, instancia);
      }
    } else if (evento.event === 'onack' && evento.data) {
      await processarReciboWPP(evento.data);
    } else if (evento.event === 'onstatechange') {
      const state = evento.data === 'CONNECTED' ? 'open' : 'close';
      emitir('chip:status', { instancia, status: state === 'open' ? 'online' : 'offline' });

    // === Formato Evolution API (compatibilidade) ===
    } else if (evento.event === 'messages.upsert' || evento.data?.message) {
      await processarMensagem(evento, instancia);
    } else if (evento.event === 'messages.update') {
      await processarRecibo(evento);
    } else if (evento.event === 'connection.update') {
      await processarConexao(evento, instancia);
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar evento:', err.message);
  }
});

// ─── WAHA: Processa mensagem recebida ───────────────────────────────────────
async function processarMensagemWaha(payload, instancia) {
  const remoteJid = payload.from || '';

  // Pular grupos e newsletters
  if (remoteJid.includes('@g.us') || remoteJid.includes('@newsletter')) return;

  // Extrair telefone: @c.us → número, @lid → manter completo
  let telefone;
  if (remoteJid.includes('@c.us')) {
    telefone = remoteJid.replace('@c.us', '');
  } else {
    telefone = remoteJid; // @lid ou outro formato
  }

  if (!telefone || telefone.includes('status')) return;

  // Verificar blacklist
  const bloqueado = await prisma.blacklist.findUnique({ where: { telefone } });
  if (bloqueado) return;

  // Buscar chip
  const chip = await buscarChipPorInstancia(instancia);
  if (!chip) {
    console.log(`[Webhook] Chip não encontrado para sessão: ${instancia}`);
    return;
  }

  // Buscar ou criar cliente (upsert evita race condition com unique constraint)
  const nome = payload.notifyName || payload._data?.notifyName || null;
  let isNovo = false;
  let cliente = await prisma.cliente.findUnique({ where: { telefone } });
  if (!cliente) {
    try {
      cliente = await prisma.cliente.create({
        data: { telefone, nome, chipOrigemId: chip.id, status: 'novo' },
      });
      isNovo = true;
    } catch {
      cliente = await prisma.cliente.findUnique({ where: { telefone } });
    }
  } else if (nome && !cliente.nome) {
    cliente = await prisma.cliente.update({
      where: { id: cliente.id },
      data: { nome },
    });
  }
  if (!cliente) return;
  if (isNovo) {
    console.log(`[Webhook] Novo lead: ${telefone} (${cliente.nome || 'sem nome'})`);
    emitir('lead:novo', cliente);
  }

  // Extrair conteúdo
  let conteudo = payload.body || '';
  let tipoMidia = null;

  if (payload.hasMedia || payload.type !== 'chat') {
    const tipo = payload.type;
    if (tipo === 'image') tipoMidia = 'imagem';
    else if (tipo === 'audio' || tipo === 'ptt') tipoMidia = 'audio';
    else if (tipo === 'video') tipoMidia = 'video';
    else if (tipo === 'document') tipoMidia = 'documento';
  }

  // Baixar mídia recebida e salvar localmente
  let midiaUrl = null;
  if (tipoMidia && payload.media?.url) {
    try {
      const mediaResp = await axios.get(payload.media.url, { responseType: 'arraybuffer', timeout: 15000 });
      const ext = tipoMidia === 'imagem' ? 'jpg' : tipoMidia === 'audio' ? 'ogg' : tipoMidia === 'video' ? 'mp4' : 'bin';
      const nomeArq = `recebido_${cliente.id}_${Date.now()}.${ext}`;
      const dirMidia = path.join(config.upload.path, 'recebidos');
      fs.mkdirSync(dirMidia, { recursive: true });
      fs.writeFileSync(path.join(dirMidia, nomeArq), Buffer.from(mediaResp.data));
      midiaUrl = `/uploads/recebidos/${nomeArq}`;
    } catch (e) {
      console.error('[Webhook] Erro ao baixar mídia recebida:', e.message);
    }
  }

  // Salvar conversa
  const conversa = await prisma.conversa.create({
    data: {
      clienteId: cliente.id,
      chipId: chip.id,
      tipo: 'recebida',
      conteudo,
      tipoMidia,
      midiaUrl,
    },
  });

  emitir('mensagem:nova', { conversa, clienteId: cliente.id, chipId: chip.id });

  // Processar imagem (possível comprovante)
  if (tipoMidia === 'imagem' && payload.media?.url) {
    await processarImagemWaha(payload, instancia, cliente, chip);
  }

  // Processar resposta no funil
  await processarRespostaFunil(cliente.id, conteudo, tipoMidia);

  // Iniciar funil se for novo lead
  const execucaoAtiva = await prisma.funilExecucao.findFirst({
    where: { clienteId: cliente.id, status: 'ativo' },
  });

  if (!execucaoAtiva && cliente.status === 'novo') {
    await iniciarFunil(cliente.id, chip.id);
  }
}

// ─── WAHA: Processa recibo de leitura (ack) ─────────────────────────────────
async function processarReciboWaha(payload) {
  try {
    const msgId = payload.id;
    const ack = payload.ack;

    let novoStatus = null;
    if (ack >= 4) novoStatus = 'lido';
    else if (ack === 3) novoStatus = 'entregue';

    if (novoStatus && msgId) {
      const conversa = await prisma.conversa.findFirst({ where: { wamid: msgId } });
      if (conversa) {
        await prisma.conversa.update({ where: { id: conversa.id }, data: { status: novoStatus } });
        emitir('mensagem:status', { conversaId: conversa.id, status: novoStatus, clienteId: conversa.clienteId });
        console.log(`[Webhook] Recibo WAHA: msg ${msgId} → ${novoStatus}`);
      }
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar recibo WAHA:', err.message);
  }
}

// ─── WAHA: Processa imagem (possível comprovante) ───────────────────────────
async function processarImagemWaha(payload, instancia, cliente, chip) {
  try {
    if (!payload.media?.url) return;

    const response = await axios.get(payload.media.url, { responseType: 'arraybuffer' });
    const nomeArquivo = `comprovante_${cliente.id}_${Date.now()}.jpg`;
    const caminhoArquivo = path.join(config.upload.path, 'comprovantes', nomeArquivo);

    fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });
    fs.writeFileSync(caminhoArquivo, Buffer.from(response.data));

    await comprovanteQueue.add({
      clienteId: cliente.id,
      chipId: chip.id,
      imagemPath: caminhoArquivo,
      instanciaEvolution: instancia,
      telefoneCliente: cliente.telefone,
    });

    console.log(`[Webhook] Imagem WAHA enfileirada: ${nomeArquivo}`);
  } catch (err) {
    console.error('[Webhook] Erro ao processar imagem WAHA:', err.message);
  }
}

// ─── Evolution API: Processa mensagem (compatibilidade) ─────────────────────
async function processarMensagem(evento, instancia) {
  const mensagem = evento.data;
  if (!mensagem) return;

  if (mensagem.key?.fromMe) return;

  const remoteJid = mensagem.key?.remoteJid || '';
  if (remoteJid.includes('@g.us') || remoteJid.includes('@newsletter')) return;
  const telefone = remoteJid.includes('@s.whatsapp.net')
    ? remoteJid.replace('@s.whatsapp.net', '')
    : remoteJid;
  if (!telefone || telefone.includes('status')) return;

  const bloqueado = await prisma.blacklist.findUnique({ where: { telefone } });
  if (bloqueado) return;

  const chip = await buscarChipPorInstancia(instancia);
  if (!chip) return;

  let isNovo2 = false;
  let cliente = await prisma.cliente.findUnique({ where: { telefone } });
  if (!cliente) {
    try {
      cliente = await prisma.cliente.create({
        data: { telefone, nome: mensagem.pushName || null, chipOrigemId: chip.id, status: 'novo' },
      });
      isNovo2 = true;
    } catch {
      cliente = await prisma.cliente.findUnique({ where: { telefone } });
    }
  } else if (mensagem.pushName && !cliente.nome) {
    cliente = await prisma.cliente.update({
      where: { id: cliente.id },
      data: { nome: mensagem.pushName },
    });
  }
  if (!cliente) return;
  if (isNovo2) emitir('lead:novo', cliente);

  const msgData = mensagem.message || {};
  let conteudo = msgData.conversation
    || msgData.extendedTextMessage?.text
    || msgData.imageMessage?.caption
    || msgData.videoMessage?.caption
    || '';

  let tipoMidia = null;
  if (msgData.imageMessage) tipoMidia = 'imagem';
  else if (msgData.audioMessage) tipoMidia = 'audio';
  else if (msgData.videoMessage) tipoMidia = 'video';
  else if (msgData.documentMessage) tipoMidia = 'documento';

  const conversa = await prisma.conversa.create({
    data: { clienteId: cliente.id, chipId: chip.id, tipo: 'recebida', conteudo, tipoMidia },
  });

  emitir('mensagem:nova', { conversa, clienteId: cliente.id, chipId: chip.id });

  await processarRespostaFunil(cliente.id, conteudo, tipoMidia);

  const execucaoAtiva = await prisma.funilExecucao.findFirst({
    where: { clienteId: cliente.id, status: 'ativo' },
  });

  if (!execucaoAtiva && cliente.status === 'novo') {
    await iniciarFunil(cliente.id, chip.id);
  }
}

// ─── Evolution API: Recibos de leitura ──────────────────────────────────────
async function processarRecibo(evento) {
  try {
    const updates = Array.isArray(evento.data) ? evento.data : [evento.data];
    for (const upd of updates) {
      const wamid = upd?.key?.id || upd?.id;
      const status = upd?.update?.status || upd?.status;
      if (!wamid || !status) continue;

      let novoStatus = null;
      if (status === 'DELIVERY_ACK') novoStatus = 'entregue';
      else if (status === 'READ' || status === 'PLAYED') novoStatus = 'lido';

      if (novoStatus) {
        const conversa = await prisma.conversa.findFirst({ where: { wamid } });
        if (conversa) {
          await prisma.conversa.update({ where: { id: conversa.id }, data: { status: novoStatus } });
          emitir('mensagem:status', { conversaId: conversa.id, status: novoStatus, clienteId: conversa.clienteId });
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar recibo:', err.message);
  }
}

// ─── Evolution API: Status de conexão ───────────────────────────────────────
async function processarConexao(evento, instancia) {
  const state = evento.data?.state || evento.state;
  emitir('chip:status', {
    instancia,
    status: state === 'open' ? 'online' : 'offline',
  });
}

// ─── WPPConnect: Processa mensagem recebida ──────────────────────────────────
async function processarMensagemWPP(data, instancia) {
  const from = data.from || data.author || '';

  // Pular grupos, status e mensagens próprias
  if (from.includes('@g.us') || from.includes('status') || data.isGroupMsg) return;

  // Extrair telefone
  let telefone;
  if (from.includes('@c.us')) {
    telefone = from.replace('@c.us', '');
  } else {
    telefone = from; // @lid ou outro formato
  }

  if (!telefone) return;

  // Verificar blacklist
  const bloqueado = await prisma.blacklist.findUnique({ where: { telefone } });
  if (bloqueado) return;

  // Buscar chip
  const chip = await buscarChipPorInstancia(instancia);
  if (!chip) {
    console.log(`[Webhook] Chip não encontrado para sessão: ${instancia}`);
    return;
  }

  // Buscar ou criar cliente
  const nome = data.notifyName || data.chat?.contact?.name || null;
  let isNovo = false;
  let cliente = await prisma.cliente.findUnique({ where: { telefone } });
  if (!cliente) {
    try {
      cliente = await prisma.cliente.create({
        data: { telefone, nome, chipOrigemId: chip.id, status: 'novo' },
      });
      isNovo = true;
    } catch {
      cliente = await prisma.cliente.findUnique({ where: { telefone } });
    }
  } else if (nome && !cliente.nome) {
    cliente = await prisma.cliente.update({ where: { id: cliente.id }, data: { nome } });
  }
  if (!cliente) return;
  if (isNovo) {
    console.log(`[Webhook] Novo lead WPP: ${telefone} (${cliente.nome || 'sem nome'})`);
    emitir('lead:novo', cliente);
  }

  // Extrair conteúdo e tipo de mídia
  let conteudo = data.body || data.caption || '';
  let tipoMidia = null;
  if (data.hasMedia || data.type !== 'chat') {
    if (data.type === 'image') tipoMidia = 'imagem';
    else if (data.type === 'audio' || data.type === 'ptt') tipoMidia = 'audio';
    else if (data.type === 'video') tipoMidia = 'video';
    else if (data.type === 'document') tipoMidia = 'documento';
  }

  // Baixar mídia recebida se disponível
  let midiaUrl = null;
  const mediaUrl = data.mediaData?.url || data.clientUrl || null;
  if (tipoMidia && mediaUrl) {
    try {
      const mediaResp = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const ext = tipoMidia === 'imagem' ? 'jpg' : tipoMidia === 'audio' ? 'ogg' : tipoMidia === 'video' ? 'mp4' : 'bin';
      const nomeArq = `recebido_${cliente.id}_${Date.now()}.${ext}`;
      const dirMidia = path.join(config.upload.path, 'recebidos');
      fs.mkdirSync(dirMidia, { recursive: true });
      fs.writeFileSync(path.join(dirMidia, nomeArq), Buffer.from(mediaResp.data));
      midiaUrl = `/uploads/recebidos/${nomeArq}`;
    } catch (e) {
      console.error('[Webhook] Erro ao baixar mídia WPP:', e.message);
    }
  }

  // Salvar conversa
  const conversa = await prisma.conversa.create({
    data: { clienteId: cliente.id, chipId: chip.id, tipo: 'recebida', conteudo, tipoMidia, midiaUrl },
  });

  emitir('mensagem:nova', { conversa, clienteId: cliente.id, chipId: chip.id });

  // Processar no funil
  await processarRespostaFunil(cliente.id, conteudo, tipoMidia);

  const execucaoAtiva = await prisma.funilExecucao.findFirst({
    where: { clienteId: cliente.id, status: 'ativo' },
  });
  if (!execucaoAtiva && cliente.status === 'novo') {
    await iniciarFunil(cliente.id, chip.id);
  }
}

// ─── WPPConnect: Processa recibo de leitura ──────────────────────────────────
async function processarReciboWPP(data) {
  try {
    const msgId = data.id;
    const ack = data.ack;
    let novoStatus = null;
    if (ack >= 3) novoStatus = 'lido';
    else if (ack === 2) novoStatus = 'entregue';

    if (novoStatus && msgId) {
      const conversa = await prisma.conversa.findFirst({ where: { wamid: msgId } });
      if (conversa) {
        await prisma.conversa.update({ where: { id: conversa.id }, data: { status: novoStatus } });
        emitir('mensagem:status', { conversaId: conversa.id, status: novoStatus, clienteId: conversa.clienteId });
      }
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar recibo WPP:', err.message);
  }
}

module.exports = router;
