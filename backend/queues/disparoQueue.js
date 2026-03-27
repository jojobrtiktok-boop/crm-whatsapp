// Processador da fila de disparos agendados para grupos WhatsApp
const { disparoQueue } = require('./setup');
const { enviarTexto } = require('../services/evolutionApi');
const { emitir } = require('../services/socketManager');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

disparoQueue.process(async (job) => {
  const { instancia, grupoId, mensagem, disparoId, contaId } = job.data;

  console.log(`[DisparoQueue] Enviando para grupo ${grupoId} via ${instancia}`);
  await enviarTexto(instancia, grupoId, mensagem);

  await prisma.disparo.update({
    where: { id: disparoId },
    data: { enviados: { increment: 1 } },
  });

  const atualizado = await prisma.disparo.findUnique({ where: { id: disparoId } });
  emitir('disparo:progresso', { id: disparoId, enviados: atualizado?.enviados || 0, total: atualizado?.totalEnvios || 0 }, contaId);

  // Se todos enviados, marcar concluido
  if (atualizado && atualizado.enviados >= atualizado.totalEnvios) {
    await prisma.disparo.update({ where: { id: disparoId }, data: { status: 'concluido' } });
    emitir('disparo:concluido', { id: disparoId }, contaId);
  }
});

disparoQueue.on('failed', (job, err) => {
  console.error(`[DisparoQueue] Job ${job.id} falhou:`, err.message);
});

module.exports = disparoQueue;
