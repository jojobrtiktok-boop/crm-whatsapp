import { useContext, useEffect } from 'react';
import { SocketContext } from '../context/SocketContext';

export function useSocket() {
  return useContext(SocketContext);
}

// Hook para escutar evento específico do socket
export function useSocketEvent(evento, callback) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !evento) return;

    socket.on(evento, callback);

    return () => {
      socket.off(evento, callback);
    };
  }, [socket, evento, callback]);
}
