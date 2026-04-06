// Configurações centralizadas da aplicação
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  // Servidor
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'chave_padrao_dev',

  // PostgreSQL (via Prisma - usa DATABASE_URL do .env automaticamente)
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },

  // Evolution API
  evolution: {
    url: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || '',
  },

  // Claude API
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  // Upload
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
  },

  // URL pública do servidor (usada para configurar webhooks)
  publicUrl: process.env.PUBLIC_URL || null,

  // Meta Cloud API
  meta: {
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'crm_meta_verify',
  },
};
