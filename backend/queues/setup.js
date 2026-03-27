// Configuração das filas Bull + Redis
const Queue = require('bull');
const config = require('../config');

const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
};

// Fila de envio de mensagens WhatsApp
const mensagemQueue = new Queue('mensagens', { redis: redisConfig });

// Fila de análise de comprovantes com IA
const comprovanteQueue = new Queue('comprovantes', { redis: redisConfig });

// Fila de variação de mensagens com IA
const iaQueue = new Queue('ia', { redis: redisConfig });

// Fila de disparos agendados para grupos
const disparoQueue = new Queue('disparo', { redis: redisConfig });

// Configuração padrão de retry
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,  // Mantém os últimos 100 jobs completos
  removeOnFail: 50,       // Mantém os últimos 50 jobs com falha
};

// Aplicar configuração padrão
disparoQueue.defaultJobOptions = {
  attempts: 2,
  backoff: { type: 'fixed', delay: 5000 },
  removeOnComplete: 200,
  removeOnFail: 50,
};
mensagemQueue.defaultJobOptions = {
  ...defaultJobOptions,
  limiter: { max: 10, duration: 1000 }, // Rate limit: 10 msgs/segundo por fila
};
comprovanteQueue.defaultJobOptions = defaultJobOptions;
iaQueue.defaultJobOptions = defaultJobOptions;

// Log de eventos das filas
[mensagemQueue, comprovanteQueue, iaQueue, disparoQueue].forEach((queue) => {
  queue.on('error', (err) => console.error(`[Fila ${queue.name}] Erro:`, err.message));
  queue.on('failed', (job, err) => console.error(`[Fila ${queue.name}] Job ${job.id} falhou:`, err.message));
});

module.exports = { mensagemQueue, comprovanteQueue, iaQueue, disparoQueue };
