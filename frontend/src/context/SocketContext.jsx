import { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { usuario } = useAuth();

  useEffect(() => {
    if (!usuario) return;

    const socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Conectado:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Desconectado');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [usuario]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
