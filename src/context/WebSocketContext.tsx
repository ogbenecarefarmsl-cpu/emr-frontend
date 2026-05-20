import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationService } from '@/services/notificationService';
import { soundService } from '@/services/soundService';
import { normalizeApiBaseUrl } from '@/services/apiUrl';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectedClients: number;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  connectedClients: 0,
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState(0);

  useEffect(() => {
    if (!user) return;

    const hasRole = (...allowedRoles: string[]) =>
      roles.some((role) => allowedRoles.includes(role));

    const getPatientName = (payload: any) => {
      const patient = payload?.patient || payload?.patientId || payload?.patient_id;
      if (patient?.firstName || patient?.lastName) {
        return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
      }
      if (payload?.patientName) return payload.patientName;
      return 'Unknown patient';
    };

    const getVisitNumber = (visit: any) =>
      visit?.visitNumber || visit?.visit_number || visit?.id || visit?._id || 'Visit';

    const invalidateClinicalFlow = () => {
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['patients'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['results'], exact: false });
    };

    // Get backend URL from environment or use LAN IP
    const backendUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_URL || 'http://localhost:3000');
    const token = localStorage.getItem('access_token'); // Use same key as in api.ts

    // Create socket connection
    const newSocket = io(`${backendUrl}/realtime`, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'], // Try both transports
    });

    // Connection events
    newSocket.on('connect', () => {
      setIsConnected(true);
      toast.success('Real-time updates connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      toast.warning('Real-time updates disconnected');
    });

    newSocket.on('connected', (data) => {
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      console.error('Error details:', error.message, (error as any).description, (error as any).context);
      setIsConnected(false);
      
      // Don't show toast for every connection attempt
      if (error.message.includes('Authentication')) {
        toast.error('WebSocket authentication failed');
      }
    });

    newSocket.on('clients:count', ({ count }: { count: number }) => {
      setConnectedClients(count);
    });

    // ── Notification Event Handlers ──────────────────────────────────────

    // Critical result alert
    newSocket.on('result:critical', (result: any) => {
      if (import.meta.env.DEV) {
        console.log('Critical result received:', result);
      }
      
      // Play urgent sound (3 repetitions)
      soundService.play('urgent-order');
      
      // Show browser notification
      notificationService.show({
        title: 'Critical result',
        body: `${result.testCode}: ${result.value} ${result.unit || ''}`.trim(),
        tag: `critical-${result._id || result.id || result.testCode}`,
        sound: 'urgent-order',
        requireInteraction: true,
      });
      
      // Show toast
      toast.error(
        `🚨 CRITICAL RESULT: ${result.testCode} = ${result.value} ${result.unit || ''}`,
        {
          duration: 15000,
          important: true,
        }
      );
    });

    // New order created
    newSocket.on('order:created', (order: any) => {
      if (import.meta.env.DEV) {
        console.log('New order created:', order.orderNumber);
      }
      
      // Invalidate ALL order-related queries so all pages see the new order
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['patients'], exact: false });
      
      // Play LOUD new order sound
      soundService.play('new-order');
      
      // Show toast to ALL users
      const patientName = order.patient?.firstName 
        ? `${order.patient.firstName} ${order.patient.lastName || ''}`.trim()
        : 'Unknown Patient';
      const testCount = order.order_tests?.length || order.tests?.length || 0;
      
      toast.success(`NEW ORDER: ${order.orderNumber}`, {
        description: `${patientName} — ${testCount} test(s)`,
        duration: 10000,
        important: true,
      });
      
      // Browser notification for reception staff
      if (hasRole('receptionist')) {
        notificationService.notifyNewOrder(order.orderNumber, patientName);
      }
    });

    // Sample collected
    newSocket.on('sample:collected', (sample: any) => {
      if (import.meta.env.DEV) {
        console.log('Sample collected:', sample);
      }
      
      // Invalidate so queues update everywhere
      queryClient.invalidateQueries({ queryKey: ['samples'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      
      // Play sample ready sound
      soundService.play('sample-collected');
      
      // Show notification for lab staff
      if (hasRole('lab_tech', 'admin')) {
        notificationService.notifySampleCollected(
          sample.orderNumber || 'Unknown',
          sample.patientName || 'Unknown',
        );
        
        toast.success('Sample collected and ready for processing', {
          description: `Order: ${sample.orderNumber}`,
        });
      }
    });

    // Unmatched result from analyzer
    newSocket.on('result:unmatched', (result: any) => {
      if (import.meta.env.DEV) {
        console.log('Unmatched result:', result);
      }
      
      // Play warning sound
      soundService.play('urgent-order');
      
      // Show notification for lab staff
      if (user?.roles?.includes('lab_tech') || user?.roles?.includes('admin')) {
        notificationService.show({
          title: 'Unmatched analyzer result',
          body: `${result.testCode}: ${result.value} from ${result.machineName || 'Unknown machine'}`,
          tag: `unmatched-${result._id || result.testCode}`,
          sound: 'urgent-order',
        });
        
        toast.warning('Unmatched result requires manual matching', {
          description: `${result.testCode} from ${result.machineName}`,
          duration: 10000,
        });
      }
    });

    // Machine status changed
    newSocket.on('machine:updated', (machine: any) => {
      if (import.meta.env.DEV) {
        console.log('Machine status changed:', machine);
      }
      
      // Play error sound if machine has error
      if (machine.status === 'error' || machine.status === 'maintenance') {
        soundService.play('urgent-order');
        
        notificationService.show({
          title: `Machine alert: ${machine.name}`,
          body: `${machine.status}: ${machine.statusMessage || 'Status changed'}`,
          tag: `machine-${machine._id || machine.id || machine.name}`,
          sound: 'urgent-order',
        });
        
        toast.error(`Machine Alert: ${machine.name}`, {
          description: `Status: ${machine.status}`,
        });
      }
    });

    // Result created — invalidate globally
    newSocket.on('result:created', (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['results'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });

      // Play loud sound when results come from analyzer
      if (result.source === 'automated') {
        soundService.play('results-ready');
        toast.success('Results received from analyzer', {
          description: `${result.testCode}: ${result.value} — Order ${result.orderNumber || ''}`,
          duration: 5000,
        });
      }
    });

    // Machine received results batch
    newSocket.on('machine:result_received', (data: any) => {
      if (import.meta.env.DEV) {
        console.log('Machine result received:', data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['results'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      
      // Play loud alert sound
      soundService.play('results-ready');
      
      toast.success(`${data.resultCount} results from ${data.machineName}`, {
        description: data.orderNumber ? `Order ${data.orderNumber}` : 'Results ready for review',
        duration: 8000,
      });
    });

    // Result verified
    newSocket.on('result:verified', (result: any) => {
      if (import.meta.env.DEV) {
        console.log('Result verified:', result);
      }
      
      // Invalidate so report pages and order lists update
      queryClient.invalidateQueries({ queryKey: ['results'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      
      // Play success sound
      soundService.play('results-ready');
      
      toast.success('Result verified', {
        description: `${result.testCode} for order ${result.orderId?.orderNumber}`,
      });
    });

    // Order status changed
    newSocket.on('order:status_changed', (data: any) => {
      if (import.meta.env.DEV) {
        console.log('Order status changed:', data);
      }
      
      // Invalidate ALL order queries so the status change is reflected everywhere
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      
      toast.info('Order status updated', {
        description: `${data.orderNumber}: ${data.status}`,
      });
    });

    newSocket.on('order:updated', (order: any) => {
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payment-history'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'], exact: false });

      const patientName = getPatientName(order);
      const orderNumber = order?.orderNumber || order?.order_number || 'Clinical order';
      const isPaid = order?.paymentStatus === 'paid' || order?.payment_status === 'paid';

      if (isPaid && order?.orderType === 'lab' && hasRole('lab_tech', 'admin')) {
        soundService.play('payment-received');
        toast.success('Paid lab order ready', {
          description: `${orderNumber} - ${patientName}`,
          duration: 8000,
        });
      }

      if (isPaid && order?.orderType === 'pharmacy' && hasRole('pharmacist', 'admin')) {
        soundService.play('payment-received');
        toast.success('Paid pharmacy order ready', {
          description: `${orderNumber} - ${patientName}`,
          duration: 8000,
        });
      }
    });

    newSocket.on('visit:status_updated', (payload: any) => {
      invalidateClinicalFlow();
      const status = payload?.status;

      if (status === 'results_ready' && hasRole('doctor', 'admin')) {
        soundService.play('results-ready');
        toast.success('New result available', {
          description: 'A patient visit has results ready for doctor review',
          duration: 10000,
        });
      }

      if (status === 'awaiting_dispensing' && hasRole('pharmacist', 'admin')) {
        soundService.play('payment-received');
        toast.success('Prescription ready to dispense', {
          description: 'A paid prescription has entered the pharmacy queue',
          duration: 10000,
        });
      }

      if (status === 'awaiting_doctor_review' && hasRole('doctor', 'admin')) {
        toast.success('Patient ready for doctor review', {
          description: 'A department action is complete and the encounter is back with the doctor',
          duration: 10000,
        });
      }
    });

    newSocket.on('visit:created', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('receptionist', 'admin')) {
        toast.info('Visit created', {
          description: `${getVisitNumber(visit)} - ${getPatientName(visit)}`,
        });
      }
    });

    newSocket.on('visit:consultation_paid', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('doctor', 'nurse', 'admin')) {
        soundService.play('payment-received');
        toast.success(hasRole('nurse') ? 'Patient ready for triage' : 'Patient sent to nurse vitals', {
          description: `${getVisitNumber(visit)} - ${getPatientName(visit)}`,
          duration: 8000,
        });
      }
    });

    newSocket.on('visit:triage_completed', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('doctor', 'admin')) {
        soundService.play('new-order');
        toast.success('Triage completed', {
          description: `${getVisitNumber(visit)} is ready for consultation`,
          duration: 8000,
        });
      }
    });

    newSocket.on('visit:lab_ordered', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('receptionist', 'admin')) {
        soundService.play('new-order');
        toast.success('Lab payment pending', {
          description: `${getPatientName(visit)} has a doctor lab order awaiting payment`,
          duration: 10000,
        });
      }
    });

    newSocket.on('visit:pharmacy_ordered', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('receptionist', 'admin')) {
        soundService.play('new-order');
        toast.success('Pharmacy payment pending', {
          description: `${getPatientName(visit)} has a prescription awaiting payment`,
          duration: 10000,
        });
      }
    });

    newSocket.on('visit:lab_paid', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('lab_tech', 'admin')) {
        soundService.play('payment-received');
        toast.success('New paid lab order', {
          description: `${getPatientName(visit)} is ready for sample collection`,
          duration: 10000,
        });
      }
    });

    newSocket.on('visit:pharmacy_paid', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('pharmacist', 'admin')) {
        soundService.play('payment-received');
        toast.success('New paid prescription', {
          description: `${getPatientName(visit)} is ready for dispensing`,
          duration: 10000,
        });
      }
    });

    newSocket.on('visit:results_ready', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('doctor', 'admin')) {
        soundService.play('results-ready');
        notificationService.notifyResultsReady(getVisitNumber(visit), getPatientName(visit));
        toast.success('New result available', {
          description: `${getPatientName(visit)} has released lab results`,
          duration: 12000,
        });
      }
    });

    newSocket.on('visit:dispensed', (visit: any) => {
      invalidateClinicalFlow();
      if (hasRole('doctor', 'receptionist', 'admin')) {
        toast.success('Medication dispensed', {
          description: `${getPatientName(visit)} pharmacy order is complete`,
        });
      }
    });

    newSocket.on('prescription:created', (prescription: any) => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'], exact: false });
      if (hasRole('receptionist', 'admin')) {
        soundService.play('new-order');
        toast.success('Pharmacy payment pending', {
          description: `${prescription?.prescriptionNumber || 'Prescription'} - ${getPatientName(prescription)}`,
          duration: 10000,
        });
      }
    });

    newSocket.on('prescription:paid', (prescription: any) => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'], exact: false });
      if (hasRole('pharmacist', 'admin')) {
        soundService.play('payment-received');
        toast.success('Paid prescription ready', {
          description: `${prescription?.prescriptionNumber || 'Prescription'} - ${getPatientName(prescription)}`,
          duration: 10000,
        });
      }
    });

    newSocket.on('prescription:dispensed', (prescription: any) => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['medications'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      if (hasRole('doctor', 'receptionist', 'admin')) {
        toast.success('Prescription dispensed', {
          description: prescription?.prescriptionNumber || 'Medication history updated',
        });
      }
    });

    newSocket.on('admission:created', () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'], exact: false });
      invalidateClinicalFlow();
      if (hasRole('nurse', 'doctor', 'admin')) {
        toast.info('Admission created');
      }
    });

    newSocket.on('admission:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'], exact: false });
      invalidateClinicalFlow();
    });

    newSocket.on('admission:discharged', () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'], exact: false });
      invalidateClinicalFlow();
      if (hasRole('nurse', 'doctor', 'admin')) {
        toast.info('Admission discharged');
      }
    });

    newSocket.on('wallet:updated', (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['patients'], exact: false });
      if (payload?.patientId) {
        queryClient.invalidateQueries({ queryKey: ['patients', payload.patientId, 'wallet'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['patients', payload.patientId, 'wallet-transactions'], exact: false });
      }
    });

    newSocket.on('inventory:stock_received', () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['medications'], exact: false });
    });

    newSocket.on('inventory:stock_adjusted', () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['medications'], exact: false });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user, roles, queryClient]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, connectedClients }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}
