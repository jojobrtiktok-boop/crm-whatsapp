// Processador da fila de envio de mensagens
const { mensagemQueue } = require('./setup');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { enviarTexto, enviarImagem, enviarAudio, enviarVideo, enviarDocumento } = require('../services/whatsappDispatcher');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Processa cada job de envio de mensagem
mensagemQueue.process(async (job) => {
  const { tipo, instancia, telefone, mensagem, url, legenda, nomeArquivo, execucaoId, conversaId } = job.data;

  // Jobs de delay (apenas disparam continuação do funil)
  if (tipo === 'delay') {
    const { avancarParaProximoBloco } = require('../services/funilEngine');
    const execucao = await prisma.funilExecucao.findUnique({
      where: { id: execucaoId },
      include: { funil: true },
    });

    if (execucao && execucao.status === 'ativo') {
      await avancarParaProximoBloco(execucaoId, job.data.blocoId, execucao.funil);
    }
    return;
  }

  // Timeout do bloco esperar_resposta
  if (tipo === 'timeout_esperar_resposta') {
    const { avancarParaProximoBloco } = require('../services/funilEngine');
    const execucao = await prisma.funilExecucao.findUnique({
      where: { id: execucaoId },
      include: { funil: true },
    });

    // Só avança pelo timeout se o lead ainda estiver neste bloco (não respondeu)
    if (execucao && execucao.status === 'ativo' && execucao.blocoAtualId === job.data.blocoId) {
      await avancarParaProximoBloco(execucaoId, job.data.blocoId, execucao.funil, 'timeout');
    }
    return;
  }

  // ── Trava de envio único ──────────────────────────────────────────────────
  // O job.id é o MESMO em todas as tentativas (retry do Bull e reprocessamento
  // de job "stalled" após crash/restart do worker). Sem esta trava, qualquer
  // falha DEPOIS do envio (ex: salvar wamid no banco) fazia o Bull reprocessar
  // o job e REENVIAR a mensagem — em crash-loop isso virava 20+ mensagens
  // iguais pro cliente. Marca "enviando" no Redis ANTES de enviar (NX = só a
  // primeira tentativa consegue); tentativas seguintes pulam o envio.
  const chaveEnvio = `msg_enviada:${job.id}`;
  try {
    const primeira = await mensagemQueue.client.set(chaveEnvio, '1', 'EX', 21600, 'NX');
    if (primeira === null) {
      console.warn(`[MensagemQueue] Job ${job.id} já teve tentativa de envio — não reenvia (anti-spam)`);
      return;
    }
  } catch (e) {
    // Redis indisponível: segue e envia (perder a trava é melhor que perder a mensagem)
    console.warn(`[MensagemQueue] trava de envio indisponível: ${e.message}`);
  }

  // WAHA NOWEB suporta @lid nativamente - não ignorar mais
  console.log(`[MensagemQueue] Enviando ${tipo} para ${telefone} via ${instancia}`);

  let resultado = null;

  switch (tipo) {
    case 'texto':
      resultado = await enviarTexto(instancia, telefone, mensagem);
      break;
    case 'imagem':
      resultado = await enviarImagem(instancia, telefone, url, legenda);
      break;
    case 'audio':
      resultado = await enviarAudio(instancia, telefone, url);
      break;
    case 'video':
      resultado = await enviarVideo(instancia, telefone, url, legenda);
      break;
    case 'documento':
      resultado = await enviarDocumento(instancia, telefone, url, nomeArquivo);
      break;
    default:
      console.log(`[MensagemQueue] Tipo desconhecido: ${tipo}`);
  }

  // Delay de 2 segundos entre mensagens para não parecer robô
  if (resultado) await sleep(2000);

  // Salvar wamid para rastrear recibos de leitura.
  // BLINDADO: a mensagem JÁ FOI enviada — se o banco/socket falhar aqui, o job
  // NÃO pode falhar (falha = retry do Bull = mensagem duplicada pro cliente).
  if (resultado && conversaId) {
    try {
      const wamid = resultado?.messages?.[0]?.id || resultado?.key?.id || resultado?.id;
      if (wamid) {
        await prisma.conversa.update({
          where: { id: conversaId },
          data: { wamid },
        });
      }
      // Emitir status atualizado
      const { emitir } = require('../services/socketManager');
      const conversaParaEmit = await prisma.conversa.findUnique({ where: { id: conversaId }, include: { chip: true } });
      emitir('mensagem:status', { conversaId, status: 'enviado', wamid }, conversaParaEmit?.chip?.contaId);
    } catch (e) {
      console.error(`[MensagemQueue] pós-envio falhou (mensagem foi entregue, ignorando): ${e.message}`);
    }
  }
});

mensagemQueue.on('completed', (job) => {
  console.log(`[MensagemQueue] Job ${job.id} concluído`);
});

mensagemQueue.on('failed', async (job, err) => {
  console.error(`[MensagemQueue] Job ${job.id} falhou:`, err.message);
  // Marcar conversa como erro para mostrar X no chat
  if (job.data.conversaId) {
    try {
      await prisma.conversa.update({
        where: { id: job.data.conversaId },
        data: { status: 'erro' },
      });
      const { emitir } = require('../services/socketManager');
      const conversa = await prisma.conversa.findUnique({ where: { id: job.data.conversaId }, include: { chip: true } });
      if (conversa) emitir('mensagem:status', { conversaId: conversa.id, status: 'erro', clienteId: conversa.clienteId }, conversa.chip?.contaId);
    } catch {}
  }
});

module.exports = mensagemQueue;
