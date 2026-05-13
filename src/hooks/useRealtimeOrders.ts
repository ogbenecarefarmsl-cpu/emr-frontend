import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../context/WebSocketContext';
import { toast } from 'sonner';

export function useRealtimeOrders() {
  const { socket, isConnected } = useWebSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Order created
    socket.on('order:created', (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.info(`New order: ${order.orderNumber}`, {
        description: `Patient: ${order.patientId?.firstName} ${order.patientId?.lastName}`,
      });
    });

    // Order updated
    socket.on('order:updated', (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', order._id] });
    });

    // Order status changed
    socket.on('order:status_changed', ({ orderId, status, orderNumber }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
      
      toast.info(`Order ${orderNumber}`, {
        description: `Status updated to: ${status}`,
      });
    });

    return () => {
      socket.off('order:created');
      socket.off('order:updated');
      socket.off('order:status_changed');
    };
  }, [socket, isConnected, queryClient]);
}
