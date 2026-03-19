// Processador da fila de envio de mensagens
const { mensagemQueue } = require('./setup');
const { enviarTexto, enviarImagem, enviarAudio, enviarVideo } = require('../services/evolutionApi');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Processa cada job de envio de mensagem
mensagemQueue.process(async (job) => {
  const { tipo, instancia, telefone, mensagem, url, legenda, execucaoId } = job.data;

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

  console.log(`[MensagemQueue] Enviando ${tipo} para ${telefone} via ${instancia}`);

  switch (tipo) {
    case 'texto':
      await enviarTexto(instancia, telefone, mensagem);
      break;
    case 'imagem':
      await enviarImagem(instancia, telefone, url, legenda);
      break;
    case 'audio':
      await enviarAudio(instancia, telefone, url);
      break;
    case 'video':
      await enviarVideo(instancia, telefone, url, legenda);
      break;
    default:
      console.log(`[MensagemQueue] Tipo desconhecido: ${tipo}`);
  }
});

mensagemQueue.on('completed', (job) => {
  console.log(`[MensagemQueue] Job ${job.id} concluído`);
});

module.exports = mensagemQueue;
