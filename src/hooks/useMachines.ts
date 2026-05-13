import { communicationLogsAPI, machinesAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Machine {
  id: string;
  name: string;
  modelName: string;
  serialNumber: string;
  manufacturer: string;
  status: 'online' | 'offline' | 'error' | 'processing';
  ipAddress?: string;
  port?: number;
  protocol: 'HL7' | 'ASTM' | 'LIS2_A2' | 'FHIR';
  testsSupported?: string[];
  lastCommunication?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MachineCreate {
  name: string;
  modelName: string;
  serialNumber: string;
  manufacturer: string;
  ipAddress?: string;
  port?: number;
  protocol: 'HL7' | 'ASTM' | 'LIS2_A2' | 'FHIR';
  testsSupported?: string[];
}

interface MachineUpdate {
  name?: string;
  modelName?: string;
  serialNumber?: string;
  manufacturer?: string;
  status?: 'online' | 'offline' | 'error' | 'processing';
  ipAddress?: string;
  port?: number;
  protocol?: 'HL7' | 'ASTM' | 'LIS2_A2' | 'FHIR';
  testsSupported?: string[];
}

interface MaintenanceRecord {
  id: string;
  machineId: string;
  maintenanceType: 'preventive' | 'corrective' | 'calibration' | 'validation';
  description: string;
  performedBy: string;
  performedAt: string;
  nextDueDate?: string;
  cost?: number;
  notes?: string;
}

export interface MaintenanceCreate {
  maintenanceType: 'preventive' | 'corrective' | 'calibration' | 'validation';
  description: string;
  performedBy: string;
  performedAt: string;
  nextDueDate?: string;
  cost?: number;
  notes?: string;
}

function normalizeMachine(m: any): Machine {
  return {
    ...m,
    id: m.id || m._id,
  };
}

export function useMachines() {
  return useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const data = await machinesAPI.getAll();
      return (Array.isArray(data) ? data : []).map(normalizeMachine);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — machine list changes infrequently
  });
}

export function useMachine(id: string) {
  return useQuery({
    queryKey: ['machines', id],
    queryFn: async () => {
      const data = await machinesAPI.getById(id);
      return normalizeMachine(data);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMachine() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (machine: MachineCreate) => {
      const data = await machinesAPI.create(machine);
      return normalizeMachine(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
    },
  });
}

export function useUpdateMachine() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: MachineUpdate }) => {
      const data = await machinesAPI.update(id, updates);
      return normalizeMachine(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
    },
  });
}

export function useDeleteMachine() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return await machinesAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
    },
  });
}

export function useMachineMaintenance(machineId: string) {
  return useQuery({
    queryKey: ['machines', machineId, 'maintenance'],
    queryFn: async () => {
      return await machinesAPI.getMaintenance(machineId);
    },
    enabled: !!machineId,
  });
}

export function useAddMaintenance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ machineId, maintenance }: { machineId: string; maintenance: MaintenanceCreate }) => {
      return await machinesAPI.addMaintenance(machineId, maintenance);
    },
    onSuccess: (_, { machineId }) => {
      queryClient.invalidateQueries({ queryKey: ['machines', machineId, 'maintenance'] });
    },
  });
}

export function useTestMachineConnection() {
  return useMutation({
    mutationFn: async ({ machineId }: { machineId: string }) => {
      return await machinesAPI.testConnection(machineId) as { success: boolean; message: string; latency?: number; listenerActive?: boolean; analyzerReachable?: boolean };
    },
  });
}

export function useSendOrderToMachine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, machineId }: { orderId: string; machineId: string }) => {
      return await communicationLogsAPI.sendOrderToMachine(orderId, machineId) as { success: boolean; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
    },
  });
}

export function useRestartListener() {
  return useMutation({
    mutationFn: async ({ machineId }: { machineId: string }) => {
      return await communicationLogsAPI.restartListener(machineId) as { success: boolean; message: string };
    },
  });
}

export function useListenerStatus() {
  return useQuery({
    queryKey: ['listener-status'],
    queryFn: async () => {
      return await communicationLogsAPI.getListenerStatus() as Array<{ machineId: string; listening: boolean }>;
    },
    refetchInterval: 30000,
  });
}