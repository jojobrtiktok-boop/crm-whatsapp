// Rota de webhook - recebe eventos da Evolution API
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

// POST /api/webhook/evolution - Recebe eventos da Evolution API
router.post('/evolution', async (req, res) => {
  // Responder imediatamente para não travar o webhook
  res.status(200).json({ recebido: true });

  try {
    const evento = req.body;
    const instancia = evento.instance || evento.instanceName;

    if (!instancia) return;

    // Verificar tipo de evento
    if (evento.event === 'messages.upsert' || evento.data?.message) {
      await processarMensagem(evento, instancia);
    } else if (evento.event === 'connection.update') {
      await processarConexao(evento, instancia);
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar evento:', err.message);
  }
});

// Processa mensagem recebida do WhatsApp
async function processarMensagem(evento, instancia) {
  const mensagem = evento.data;
  if (!mensagem) return;

  // Ignorar mensagens enviadas pelo próprio bot
  if (mensagem.key?.fromMe) return;

  const remoteJid = mensagem.key?.remoteJid || '';
  // Pular grupos e newsletters
  if (remoteJid.includes('@g.us') || remoteJid.includes('@newsletter')) return;
  // Para @s.whatsapp.net: extrair só o número. Para @lid: guardar JID completo (não tem número real)
  const telefone = remoteJid.includes('@s.whatsapp.net')
    ? remoteJid.replace('@s.whatsapp.net', '')
    : remoteJid;
  if (!telefone || telefone.includes('status')) return;

  // Verificar blacklist
  const bloqueado = await prisma.blacklist.findUnique({ where: { telefone } });
  if (bloqueado) {
    console.log(`[Webhook] Número bloqueado: ${telefone}`);
    return;
  }

  // Buscar chip que recebeu
  const chip = await buscarChipPorInstancia(instancia);
  if (!chip) {
    console.log(`[Webhook] Chip não encontrado para instância: ${instancia}`);
    return;
  }

  // Buscar ou criar cliente
  let cliente = await prisma.cliente.findUnique({ where: { telefone } });
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        telefone,
        nome: mensagem.pushName || null,
        chipOrigemId: chip.id,
        status: 'novo',
      },
    });
    console.log(`[Webhook] Novo lead: ${telefone} (${mensagem.pushName || 'sem nome'})`);
    emitir('lead:novo', cliente);
  } else if (mensagem.pushName && !cliente.nome) {
    // Atualizar nome se não tinha
    cliente = await prisma.cliente.update({
      where: { id: cliente.id },
      data: { nome: mensagem.pushName },
    });
  }

  // Extrair conteúdo da mensagem
  const msgData = mensagem.message || {};
  let conteudo = msgData.conversation
    || msgData.extendedTextMessage?.text
    || msgData.imageMessage?.caption
    || msgData.videoMessage?.caption
    || '';

  let tipoMidia = null;
  let midiaUrl = null;

  if (msgData.imageMessage) {
    tipoMidia = 'imagem';
  } else if (msgData.audioMessage) {
    tipoMidia = 'audio';
  } else if (msgData.videoMessage) {
    tipoMidia = 'video';
  } else if (msgData.documentMessage) {
    tipoMidia = 'documento';
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

  // Emitir nova mensagem via WebSocket
  emitir('mensagem:nova', {
    conversa,
    clienteId: cliente.id,
    chipId: chip.id,
  });

  // Se é imagem, enviar para IA analisar (pode ser comprovante ou não)
  if (tipoMidia === 'imagem') {
    await processarImagem(evento, instancia, cliente, chip, mensagem);
  }

  // Se é documento PDF, extrair texto e analisar
  if (tipoMidia === 'documento' && msgData.documentMessage?.mimetype === 'application/pdf') {
    await processarPDF(evento, instancia, cliente, chip, mensagem);
  }

  // Processar resposta dentro do funil (se houver execução ativa)
  await processarRespostaFunil(cliente.id, conteudo, tipoMidia);

  // Se é novo lead sem funil ativo, iniciar funil
  const execucaoAtiva = await prisma.funilExecucao.findFirst({
    where: { clienteId: cliente.id, status: 'ativo' },
  });

  if (!execucaoAtiva && cliente.status === 'novo') {
    await iniciarFunil(cliente.id, chip.id);
  }
}

// Processa imagem recebida (possível comprovante)
async function processarImagem(evento, instancia, cliente, chip, mensagem) {
  try {
    // Tentar baixar a mídia via Evolution API
    const mediaUrl = `${config.evolution.url}/chat/getBase64FromMediaMessage/${instancia}`;
    const response = await axios.post(
      mediaUrl,
      { message: mensagem },
      { headers: { apikey: config.evolution.apiKey } }
    );

    if (response.data?.base64) {
      // Salvar imagem
      const nomeArquivo = `comprovante_${cliente.id}_${Date.now()}.jpg`;
      const caminhoArquivo = path.join(config.upload.path, 'comprovantes', nomeArquivo);

      // Garantir que o diretório existe
      fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });

      const buffer = Buffer.from(response.data.base64, 'base64');
      fs.writeFileSync(caminhoArquivo, buffer);

      // Adicionar à fila de processamento de comprovantes
      await comprovanteQueue.add({
        clienteId: cliente.id,
        chipId: chip.id,
        imagemPath: caminhoArquivo,
        instanciaEvolution: instancia,
        telefoneCliente: cliente.telefone,
      });

      console.log(`[Webhook] Imagem salva e enfileirada para análise: ${nomeArquivo}`);
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar imagem:', err.message);
  }
}

// Processa PDF recebido (possível comprovante)
async function processarPDF(evento, instancia, cliente, chip, mensagem) {
  try {
    const mediaUrl = `${config.evolution.url}/chat/getBase64FromMediaMessage/${instancia}`;
    const response = await axios.post(
      mediaUrl,
      { message: mensagem },
      { headers: { apikey: config.evolution.apiKey } }
    );

    if (response.data?.base64) {
      const nomeArquivo = `documento_${cliente.id}_${Date.now()}.pdf`;
      const caminhoArquivo = path.join(config.upload.path, 'comprovantes', nomeArquivo);

      fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });

      const buffer = Buffer.from(response.data.base64, 'base64');
      fs.writeFileSync(caminhoArquivo, buffer);

      // Extrair texto do PDF
      let textoPDF = '';
      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(buffer);
        textoPDF = pdfData.text;
        console.log(`[Webhook] Texto extraído do PDF (${textoPDF.length} chars)`);
      } catch (err) {
        console.error('[Webhook] Erro ao extrair texto do PDF:', err.message);
        return;
      }

      if (textoPDF.trim()) {
        await comprovanteQueue.add({
          clienteId: cliente.id,
          chipId: chip.id,
          imagemPath: caminhoArquivo,
          instanciaEvolution: instancia,
          telefoneCliente: cliente.telefone,
          textoPDF,
        });
        console.log(`[Webhook] PDF enfileirado para análise: ${nomeArquivo}`);
      }
    }
  } catch (err) {
    console.error('[Webhook] Erro ao processar PDF:', err.message);
  }
}

// Processa atualização de conexão do chip
async function processarConexao(evento, instancia) {
  const state = evento.data?.state || evento.state;
  console.log(`[Webhook] Status da conexão ${instancia}: ${state}`);

  emitir('chip:status', {
    instancia,
    status: state === 'open' ? 'online' : 'offline',
  });
}

module.exports = router;
