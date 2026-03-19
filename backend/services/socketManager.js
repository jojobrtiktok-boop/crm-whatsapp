// Gerenciador de conexões WebSocket com isolamento por conta
let ioInstance = null;

// Inicializa o Socket.io e configura eventos
function inicializarSocketManager(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Colocar socket na sala da sua conta (contaId vem do frontend)
    const contaId = socket.handshake.query.contaId;
    if (contaId) {
      socket.join(`conta:${contaId}`);
      console.log(`[Socket] Cliente conectado: ${socket.id} (conta ${contaId})`);
    } else {
      console.log(`[Socket] Cliente conectado: ${socket.id} (sem conta)`);
    }

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

// Emite evento para a sala de uma conta específica (ou global se sem contaId)
function emitir(evento, dados, contaId = null) {
  if (!ioInstance) return;
  if (contaId) {
    const sala = `conta:${contaId}`;
    const sockets = ioInstance.sockets.adapter.rooms.get(sala);
    console.log(`[Socket] Emitindo "${evento}" para ${sala} (${sockets?.size || 0} cliente(s))`);
    ioInstance.to(sala).emit(evento, dados);
  } else {
    console.log(`[Socket] Emitindo "${evento}" global`);
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
