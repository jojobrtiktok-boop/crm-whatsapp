// Servidor principal da aplicação CRM WhatsApp
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { Server } = require('socket.io');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const { inicializarSocketManager } = require('./services/socketManager');

// Registrar processadores das filas
require('./queues/mensagemQueue');
require('./queues/comprovanteQueue');

const app = express();
const server = http.createServer(app);

// Socket.io com CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'] 
});

// Middlewares globais
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (uploads e frontend em produção)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Disponibilizar io para as rotas
app.set('io', io);

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/chips', require('./routes/chips'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/funis', require('./routes/funis'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/atendimento', require('./routes/atendimento'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/configuracoes', require('./routes/configuracoes'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/blacklist', require('./routes/blacklist'));
app.use('/api/upload', require('./routes/upload'));

// Servir frontend em produção
if (config.nodeEnv === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tratamento global de erros
app.use(errorHandler);

// Inicializar WebSocket
inicializarSocketManager(io);

// Iniciar servidor
server.listen(config.port, () => {
  console.log(`\n🚀 CRM WhatsApp rodando na porta ${config.port}`);
  console.log(`📊 Ambiente: ${config.nodeEnv}`);
  console.log(`🔗 http://localhost:${config.port}\n`);
});

module.exports = { app, server, io };
