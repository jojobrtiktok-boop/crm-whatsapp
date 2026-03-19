// Processador da fila de variação de mensagens com IA
const { iaQueue } = require('./setup');
const { variarMensagem } = require('../services/claudeText');

// Processa cada job de variação de mensagem
iaQueue.process(async (job) => {
  const { mensagemBase, tom, contexto, nomeCliente } = job.data;

  console.log(`[IAQueue] Gerando variação de mensagem para ${nomeCliente || 'cliente'}`);

  const mensagemVariada = await variarMensagem(mensagemBase, tom, contexto, nomeCliente);

  return mensagemVariada;
});

iaQueue.on('completed', (job) => {
  console.log(`[IAQueue] Job ${job.id} concluído`);
});

module.exports = iaQueue;
