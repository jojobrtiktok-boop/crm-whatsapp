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

// Detecta [ref:cv|campanha|criativo|fonte] na mensagem e salva origem do anúncio no lead
async function salvarOrigemAd(cliente, conteudo, isNovo) {
  if (!conteudo) return;
  const match = conteudo.match(/\[ref:([^\]]+)\]/);
  if (!match) return;
  // Salva sempre que vier o ref (mesmo em leads antigos que voltam com novo criativo)
  const partes = match[1].split('|');
  const origemAd = {
    cv: partes[0] || null,
    campanha: partes[1] || null,
    criativo: partes[2] || null,
    fonte: partes[3] || null,
    captadoEm: new Date().toISOString(),
  };
  try {
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { origemAd },
    });
    console.log(`[Webhook] Origem ad salva para cliente ${cliente.id}:`, origemAd);
  } catch (e) {
    console.error('[Webhook] Erro ao salvar origemAd:', e.message);
  }
}

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
      const chipStatus = await buscarChipPorInstancia(instancia);
      emitir('chip:status', { instancia, status: state === 'open' ? 'online' : 'offline' }, chipStatus?.contaId);

    // === Formato WPPConnect ===
    } else if (evento.event === 'onmessage' && evento.data) {
      console.log(`[Webhook] onmessage de ${evento.data.from} via ${instancia} fromMe=${evento.data.fromMe}`);
      if (!evento.data.fromMe) {
        await processarMensagemWPP(evento.data, instancia);
      }
    } else if (evento.event === 'onack' && evento.data) {
      await processarReciboWPP(evento.data);
    } else if (evento.event === 'onstatechange') {
      const state = evento.data === 'CONNECTED' ? 'open' : 'close';
      const chipStatusWpp = await buscarChipPorInstancia(instancia);
      emitir('chip:status', { instancia, status: state === 'open' ? 'online' : 'offline' }, chipStatusWpp?.contaId);

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

  // Buscar chip primeiro (precisamos do contaId)
  const chip = await buscarChipPorInstancia(instancia);
  if (!chip) {
    console.log(`[Webhook] Chip não encontrado para sessão: ${instancia}`);
    return;
  }

  // Verificar blacklist (scoped por conta)
  const bloqueado = await prisma.blacklist.findFirst({ where: { telefone, contaId: chip.contaId } });
  if (bloqueado) return;

  // Buscar ou criar cliente (upsert evita race condition com unique constraint)
  const nome = payload.notifyName || payload._data?.notifyName || null;
  let isNovo = false;
  let cliente = await prisma.cliente.findFirst({ where: { telefone, contaId: chip.contaId } });
  if (!cliente) {
    try {
      cliente = await prisma.cliente.create({
        data: { telefone, nome, chipOrigemId: chip.id, status: 'novo', contaId: chip.contaId },
      });
      isNovo = true;
    } catch {
      cliente = await prisma.cliente.findFirst({ where: { telefone, contaId: chip.contaId } });
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
    emitir('lead:novo', cliente, chip.contaId);
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

  // Salvar conversa e atualizar timestamp do cliente
  const [conversa] = await Promise.all([
    prisma.conversa.create({
      data: {
        clienteId: cliente.id,
        chipId: chip.id,
        tipo: 'recebida',
        conteudo,
        tipoMidia,
        midiaUrl,
      },
    }),
    prisma.cliente.update({ where: { id: cliente.id }, data: { atualizadoEm: new Date() } }),
  ]);

  emitir('mensagem:nova', { conversa, clienteId: cliente.id, chipId: chip.id }, chip.contaId);

  // Detectar origem do anúncio
  salvarOrigemAd(cliente, conteudo, isNovo);

  // Processar imagem (possível comprovante)
  if (tipoMidia === 'imagem' && payload.media?.url) {
    await processarImagemWaha(payload, instancia, cliente, chip);
  }

  // Processar resposta no funil
  await processarRespostaFunil(cliente.id, conteudo, tipoMidia);
  await verificarEIniciarFunil(chip, cliente, conteudo);
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
        const chipRecibo = await prisma.chip.findUnique({ where: { id: conversa.chipId } });
        emitir('mensagem:status', { conversaId: conversa.id, status: novoStatus, clienteId: conversa.clienteId }, chipRecibo?.contaId);
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

  const chip = await buscarChipPorInstancia(instancia);
  if (!chip) return;

  const bloqueado = await prisma.blacklist.findFirst({ where: { telefone, contaId: chip.contaId } });
  if (bloqueado) return;

  let isNovo2 = false;
  let cliente = await prisma.cliente.findFirst({ where: { telefone, contaId: chip.contaId } });
  if (!cliente) {
    try {
      cliente = await prisma.cliente.create({
        data: { telefone, nome: mensagem.pushName || null, chipOrigemId: chip.id, status: 'novo', contaId: chip.contaId },
      });
      isNovo2 = true;
    } catch {
      cliente = await prisma.cliente.findFirst({ where: { telefone, contaId: chip.contaId } });
    }
  } else if (mensagem.pushName && !cliente.nome) {
    cliente = await prisma.cliente.update({
      where: { id: cliente.id },
      data: { nome: mensagem.pushName },
    });
  }
  if (!cliente) return;
  if (isNovo2) emitir('lead:novo', cliente, chip.contaId);

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

  const [conversa] = await Promise.all([
    prisma.conversa.create({
      data: { clienteId: cliente.id, chipId: chip.id, tipo: 'recebida', conteudo, tipoMidia },
    }),
    prisma.cliente.update({ where: { id: cliente.id }, data: { atualizadoEm: new Date() } }),
  ]);

  emitir('mensagem:nova', { conversa, clienteId: cliente.id, chipId: chip.id }, chip.contaId);

  // Detectar [ref:cv|campanha|criativo|fonte] e salvar origem do anúncio
  salvarOrigemAd(cliente, conteudo, isNovo2);

  await processarRespostaFunil(cliente.id, conteudo, tipoMidia);
  await verificarEIniciarFunil(chip, cliente, conteudo);
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
          const chipRecibo2 = await prisma.chip.findUnique({ where: { id: conversa.chipId } });
          emitir('mensagem:status', { conversaId: conversa.id, status: novoStatus, clienteId: conversa.clienteId }, chipRecibo2?.contaId);
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
  const chipConn = await buscarChipPorInstancia(instancia);
  emitir('chip:status', {
    instancia,
    status: state === 'open' ? 'online' : 'offline',
  }, chipConn?.contaId);
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
  } else if (from.includes('@s.whatsapp.net')) {
    telefone = from.replace('@s.whatsapp.net', '');
  } else {
    telefone = from; // @lid ou outro formato
  }

  if (!telefone) return;

  // Buscar chip primeiro (precisamos do contaId)
  const chip = await buscarChipPorInstancia(instancia);
  if (!chip) {
    console.log(`[Webhook] Chip não encontrado para sessão: ${instancia}`);
    return;
  }

  // Verificar blacklist (scoped por conta)
  const bloqueado = await prisma.blacklist.findFirst({ where: { telefone, contaId: chip.contaId } });
  if (bloqueado) return;

  // Buscar ou criar cliente
  const nome = data.notifyName || data.chat?.contact?.name || null;
  let isNovo = false;
  let cliente = await prisma.cliente.findFirst({ where: { telefone, contaId: chip.contaId } });
  if (!cliente) {
    try {
      cliente = await prisma.cliente.create({
        data: { telefone, nome, chipOrigemId: chip.id, status: 'novo', contaId: chip.contaId },
      });
      isNovo = true;
    } catch {
      cliente = await prisma.cliente.findFirst({ where: { telefone, contaId: chip.contaId } });
    }
  } else if (nome && !cliente.nome) {
    cliente = await prisma.cliente.update({ where: { id: cliente.id }, data: { nome } });
  }
  if (!cliente) { console.log(`[Webhook] Cliente não encontrado/criado para ${telefone} conta:${chip.contaId}`); return; }
  console.log(`[Webhook] Cliente id:${cliente.id} telefone:${telefone} conta:${chip.contaId} novo:${isNovo}`);
  if (isNovo) emitir('lead:novo', cliente, chip.contaId);

  // Extrair conteúdo e tipo de mídia
  let conteudo = data.body || data.caption || '';
  let tipoMidia = null;
  const tipo = data.type || '';
  if (tipo === 'image' || tipo === 'imageMessage') tipoMidia = 'imagem';
  else if (tipo === 'audio' || tipo === 'ptt' || tipo === 'audioMessage') tipoMidia = 'audio';
  else if (tipo === 'video' || tipo === 'videoMessage') tipoMidia = 'video';
  else if (tipo === 'document' || tipo === 'documentMessage') tipoMidia = 'documento';

  // Mídia já salva pelo Baileys (data.mediaUrl) ou baixar de URL remota (WPPConnect)
  let midiaUrl = null;
  if (data.mediaUrl) {
    // Baileys: arquivo já salvo localmente, mediaUrl é o caminho relativo
    midiaUrl = data.mediaUrl;
  } else {
    const remoteUrl = data.mediaData?.url || data.clientUrl || null;
    if (tipoMidia && remoteUrl) {
      try {
        const mediaResp = await axios.get(remoteUrl, { responseType: 'arraybuffer', timeout: 15000 });
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
  }

  // Salvar conversa e atualizar timestamp do cliente
  const [conversa] = await Promise.all([
    prisma.conversa.create({
      data: { clienteId: cliente.id, chipId: chip.id, tipo: 'recebida', conteudo, tipoMidia, midiaUrl },
    }),
    prisma.cliente.update({ where: { id: cliente.id }, data: { atualizadoEm: new Date() } }),
  ]);

  console.log(`[Webhook] Conversa criada id:${conversa.id} para cliente:${cliente.id} conta:${chip.contaId}`);
  emitir('mensagem:nova', { conversa, clienteId: cliente.id, chipId: chip.id }, chip.contaId);

  // Analisar imagem com IA (possível comprovante de pagamento)
  if (tipoMidia === 'imagem' && midiaUrl) {
    const imagemPathAbs = path.join(__dirname, '..', '..', midiaUrl);
    await comprovanteQueue.add({
      clienteId: cliente.id,
      chipId: chip.id,
      imagemPath: imagemPathAbs,
      instanciaEvolution: instancia,
      telefoneCliente: cliente.telefone,
    });
  }

  // Detectar origem do anúncio
  salvarOrigemAd(cliente, conteudo);

  // Processar no funil
  await processarRespostaFunil(cliente.id, conteudo, tipoMidia);
  await verificarEIniciarFunil(chip, cliente, conteudo);
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
        const chipRecibo3 = await prisma.chip.findUnique({ where: { id: conversa.chipId } });
        emitir('mensagem:status', { conversaId: conversa.id, status: novoStatus, clienteId: conversa.clienteId }, chipRecibo3?.contaId);
      }
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar recibo WPP:', err.message);
  }
}

// ─── Helper: decide se deve iniciar funil conforme gatilho configurado ────────
async function verificarEIniciarFunil(chip, cliente, conteudo) {
  // Verificar se há execução ativa
  const execucaoAtiva = await prisma.funilExecucao.findFirst({
    where: { clienteId: cliente.id, status: 'ativo' },
  });
  if (execucaoAtiva) return; // já em andamento

  // Buscar config de vinculações do chip
  const configVinc = await prisma.configuracao.findFirst({
    where: { chave: 'funis_vinculados', contaId: chip.contaId },
  });

  let vinculacoes = [];
  if (configVinc?.valor) {
    try { vinculacoes = JSON.parse(configVinc.valor); } catch {}
  }

  const vinc = vinculacoes.find(v => v.chipId === chip.id && v.ativo !== false);

  if (!vinc) {
    // Sem vinculação configurada: comportamento legado (só nova uma vez)
    if (cliente.status === 'novo') {
      await iniciarFunil(cliente.id, chip.id, chip.contaId);
    }
    return;
  }

  const gatilho = vinc.gatilho || 'uma_vez';

  if (gatilho === 'uma_vez') {
    // Apenas se nunca teve execução
    const jaExecutou = await prisma.funilExecucao.findFirst({
      where: { clienteId: cliente.id, funilId: vinc.funilId },
    });
    if (!jaExecutou) {
      await iniciarFunil(cliente.id, chip.id, chip.contaId, vinc.funilId);
    }
  } else if (gatilho === 'sempre') {
    // Toda mensagem reinicia (desde que não haja execução ativa - já verificado acima)
    await iniciarFunil(cliente.id, chip.id, chip.contaId, vinc.funilId);
  } else if (gatilho === 'palavras') {
    const palavras = (vinc.palavras || []).map(p => p.toLowerCase().trim()).filter(Boolean);
    const msg = (conteudo || '').toLowerCase();
    const match = palavras.some(p => msg.includes(p));
    if (match) {
      await iniciarFunil(cliente.id, chip.id, chip.contaId, vinc.funilId);
    }
  }
}

module.exports = router;
