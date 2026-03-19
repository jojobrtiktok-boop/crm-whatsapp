// Processador da fila de envio de mensagens
const { mensagemQueue } = require('./setup');
const { enviarTexto, enviarImagem, enviarAudio, enviarVideo, enviarDocumento } = require('../services/evolutionApi');
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

  // Salvar wamid para rastrear recibos de leitura
  if (resultado && conversaId) {
    const wamid = resultado?.key?.id || resultado?.id;
    if (wamid) {
      await prisma.conversa.update({
        where: { id: conversaId },
        data: { wamid },
      });
    }
    // Emitir status atualizado
    const { emitir } = require('../services/socketManager');
    emitir('mensagem:status', { conversaId, status: 'enviado', wamid: resultado?.key?.id || resultado?.id });
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
      const conversa = await prisma.conversa.findUnique({ where: { id: job.data.conversaId } });
      if (conversa) emitir('mensagem:status', { conversaId: conversa.id, status: 'erro', clienteId: conversa.clienteId });
    } catch {}
  }
});

module.exports = mensagemQueue;
