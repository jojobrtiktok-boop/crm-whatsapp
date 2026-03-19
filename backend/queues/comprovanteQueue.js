// Processador da fila de análise de comprovantes
const { comprovanteQueue } = require('./setup');
const { processarComprovante } = require('../services/comprovanteProcessor');

// Processa cada job de análise de comprovante
comprovanteQueue.process(async (job) => {
  const { clienteId, chipId, imagemPath, instanciaEvolution, telefoneCliente } = job.data;

  console.log(`[ComprovanteQueue] Analisando comprovante do cliente ${clienteId}`);

  const resultado = await processarComprovante({
    clienteId,
    chipId,
    imagemPath,
    instanciaEvolution,
    telefoneCliente,
  });

  return resultado;
});

comprovanteQueue.on('completed', (job, resultado) => {
  console.log(`[ComprovanteQueue] Job ${job.id} concluído - Status: ${resultado?.status}`);
});

module.exports = comprovanteQueue;
