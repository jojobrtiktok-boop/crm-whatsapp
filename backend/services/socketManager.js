// Gerenciador de conexões WebSocket
let ioInstance = null;

// Inicializa o Socket.io e configura eventos
function inicializarSocketManager(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);

    // Operador assume atendimento
    socket.on('atendimento:assumir', (data) => {
      console.log(`[Socket] Operador assumiu atendimento: ${data.atendimentoId}`);
      socket.join(`atendimento:${data.atendimentoId}`);
    });

    // Operador envia mensagem no chat
    socket.on('atendimento:mensagem', (data) => {
      io.to(`atendimento:${data.atendimentoId}`).emit('mensagem:nova', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Cliente desconectado: ${socket.id}`);
    });
  });
}

// Emite evento para todos os clientes conectados
function emitir(evento, dados) {
  if (ioInstance) {
    ioInstance.emit(evento, dados);
  }
}

// Emite evento para uma sala específica
function emitirParaSala(sala, evento, dados) {
  if (ioInstance) {
    ioInstance.to(sala).emit(evento, dados);
  }
}

module.exports = { inicializarSocketManager, emitir, emitirParaSala };
