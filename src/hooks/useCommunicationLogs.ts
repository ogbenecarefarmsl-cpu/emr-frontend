import { communicationLogsAPI, machinesAPI } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useWebSocket } from '@/context/WebSocketContext';

interface CommunicationLog {
  id: string;
  machine_id: string | null;
  direction: string;
  protocol: string;
  message_type: string | null;
  message_control_id: string | null;
  status: string;
  error_message: string | null;
  results_count: number | null;
  processing_time_ms: number | null;
  created_at: string;
  parsed_summary: Record<string, unknown> | null;
}

export function useCommunicationLogs(machineId?: string, limit = 50) {
  return useQuery({
    queryKey: ['communication-logs', machineId, limit],
    queryFn: async () => {
      const params: any = { limit };
      if (machineId) params.machineId = machineId;
      const response = await communicationLogsAPI.getLogs(params);
      // Backend returns { logs: [], total: number }
      return response.logs || [];
    },
  });
}

export function useRealtimeCommunicationLogs(machineId?: string) {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    // Initial fetch
    const fetchLogs = async () => {
      try {
        const params: any = { limit: 20 };
        if (machineId) params.machineId = machineId;
        const response = await communicationLogsAPI.getLogs(params);
        // Backend returns { logs: [], total: number }
        const data = response.logs || [];
        setLogs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching communication logs:', error);
        setLogs([]);
      }
    };
    
    fetchLogs();

    // Subscribe to realtime updates via WebSocket
    if (socket) {
      const handleNewLog = (log: CommunicationLog) => {
        if (!machineId || log.machine_id === machineId) {
          setLogs(prev => [log, ...prev].slice(0, 50));
        }
      };

      socket.on('communication-log:new', handleNewLog);

      return () => {
        socket.off('communication-log:new', handleNewLog);
      };
    }
  }, [machineId, socket]);

  return { logs, isConnected };
}

export function useMachineConnectionStatus() {
  const [machineStatuses, setMachineStatuses] = useState<Record<string, { 
    isOnline: boolean; 
    lastSeen: string | null;
    lastMessageType: string | null;
  }>>({});
  const { socket } = useWebSocket();

  useEffect(() => {
    // Initial fetch of machine statuses
    const fetchMachines = async () => {
      try {
        const data = await machinesAPI.getAll();
        
        if (data) {
          const statuses: Record<string, { isOnline: boolean; lastSeen: string | null; lastMessageType: string | null }> = {};
          for (const machine of data) {
            const lastComm = machine.lastCommunication;
            const isRecent = lastComm && (Date.now() - new Date(lastComm).getTime()) < 5 * 60 * 1000; // 5 min
            statuses[machine.id] = {
              isOnline: machine.status === 'online' && !!isRecent,
              lastSeen: lastComm,
              lastMessageType: null
            };
          }
          setMachineStatuses(statuses);
        }
      } catch (error) {
        console.error('Error fetching machines:', error);
      }
    };
    
    fetchMachines();

    // Subscribe to machine updates via WebSocket
    if (socket) {
      const handleMachineUpdate = (machine: any) => {
        const lastComm = machine.lastCommunication;
        const isRecent = lastComm && (Date.now() - new Date(lastComm).getTime()) < 5 * 60 * 1000;
        
        setMachineStatuses(prev => ({
          ...prev,
          [machine.id]: {
            isOnline: machine.status === 'online' && !!isRecent,
            lastSeen: lastComm,
            lastMessageType: prev[machine.id]?.lastMessageType || null
          }
        }));
      };

      const handleNewLog = (log: CommunicationLog) => {
        if (log.machine_id) {
          setMachineStatuses(prev => ({
            ...prev,
            [log.machine_id!]: {
              isOnline: true,
              lastSeen: log.created_at,
              lastMessageType: log.message_type
            }
          }));
        }
      };

      socket.on('machine:updated', handleMachineUpdate);
      socket.on('communication-log:new', handleNewLog);

      return () => {
        socket.off('machine:updated', handleMachineUpdate);
        socket.off('communication-log:new', handleNewLog);
      };
    }
  }, [socket]);

  return machineStatuses;
}
