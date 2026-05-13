import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../context/WebSocketContext';
import { toast } from 'sonner';

export function useRealtimePatients() {
  const { socket, isConnected } = useWebSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('patient:created', (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.info(`New patient registered: ${patient.firstName} ${patient.lastName}`);
    });

    return () => {
      socket.off('patient:created');
    };
  }, [socket, isConnected, queryClient]);
}
