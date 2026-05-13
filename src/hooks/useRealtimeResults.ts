import { useEffect, createElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../context/WebSocketContext';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export function useRealtimeResults() {
  const { socket, isConnected } = useWebSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Result created
    socket.on('result:created', (result) => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });

    // Critical result alert
    socket.on('result:critical', (result) => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      
      toast.error(`Critical Result: ${result.testName}`, {
        description: `Value: ${result.value} ${result.unit} (${result.flag})`,
        icon: createElement(AlertTriangle, { className: 'w-5 h-5' }),
        duration: 10000, // Show for 10 seconds
      });
    });

    // Result verified
    socket.on('result:verified', (result) => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    });

    return () => {
      socket.off('result:created');
      socket.off('result:critical');
      socket.off('result:verified');
    };
  }, [socket, isConnected, queryClient]);
}
