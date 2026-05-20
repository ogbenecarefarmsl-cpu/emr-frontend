import { ordersAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Patient {
  id?: string;
  _id?: string;
  patientId: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  phone?: string;
  email?: string;
  address?: string;
}

interface OrderTest {
  id?: string;
  _id?: string;
  orderId: string;
  testId: string;
  testCode: string;
  testName: string;
  price: number;
  status: string;
  // Backend snake_case format
  test_id?: string;
  test_code?: string;
  test_name?: string;
}

function normalizeOrderTest(test: any): OrderTest {
  return {
    ...test,
    id: test.id || test._id,
    orderId: test.orderId || test.order_id,
    testId: test.testId || test.test_id,
    testCode: test.testCode || test.test_code,
    testName: test.testName || test.test_name,
  };
}

function normalizePatient(patient: any): Patient | undefined {
  if (!patient) return undefined;

  return {
    ...patient,
    id: patient.id || patient._id,
    patientId: patient.patientId || patient.patient_id,
    firstName: patient.firstName || patient.first_name,
    lastName: patient.lastName || patient.last_name,
  };
}

function normalizeOrder(order: any): OrderWithDetails {
  const patient = normalizePatient(order.patient || order.patients || (typeof order.patientId === 'object' ? order.patientId : undefined));
  const orderTests = (order.order_tests || order.tests || []).map((test: any) => normalizeOrderTest(test));

  return {
    ...order,
    id: order.id || order._id,
    orderNumber: order.orderNumber || order.order_number,
    patientId: typeof order.patientId === 'string' ? order.patientId : patient || order.patientId,
    patient,
    tests: orderTests,
    order_tests: orderTests,
    status: order.status,
    priority: order.priority,
    total: order.total ?? order.totalAmount,
    totalAmount: order.totalAmount ?? order.total,
    amountPaid: order.amountPaid ?? order.paidAmount ?? 0,
    paidAmount: order.paidAmount ?? order.amountPaid ?? 0,
    balance: order.balance ?? ((order.total ?? order.totalAmount ?? 0) - (order.amountPaid ?? order.paidAmount ?? 0)),
    paymentStatus: order.paymentStatus || order.payment_status,
    paymentMethod: order.paymentMethod || order.payment_method,
    createdAt: order.createdAt || order.created_at,
    updatedAt: order.updatedAt || order.updated_at,
  };
}

interface Order {
  id?: string;
  _id?: string;
  orderNumber: string;
  patientId: string | Patient;
  status: 'awaiting_payment' | 'paid' | 'pending_collection' | 'collected' | 'processing' | 'completed' | 'cancelled';
  priority: 'routine' | 'urgent' | 'stat';
  total?: number;
  totalAmount?: number;
  subtotal?: number;
  discount?: number;
  discountType?: 'fixed' | 'percentage';
  paidAmount?: number;
  amountPaid?: number;
  balance?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  paymentMethod?: 'cash' | 'orange_money' | 'afrimoney' | 'wallet';
  notes?: string;
  referredByDoctor?: string;
  doctorId?: string | { _id: string; fullName: string; phone?: string; facility?: string };
  createdAt: string;
  updatedAt?: string;
}

export interface OrderWithDetails extends Order {
  patient?: Patient;
  tests?: OrderTest[];
  // Backend MongoDB format
  order_tests?: OrderTest[];
  patients?: Patient;
  order_number?: string;
  payment_status?: 'pending' | 'partial' | 'paid';
  payment_method?: 'cash' | 'orange_money' | 'afrimoney' | 'wallet';
  created_at?: string;
  updated_at?: string;
}

interface OrderCreate {
  patientId: string;
  visitId?: string;
  orderType?: 'consultation' | 'lab' | 'pharmacy' | 'procedure' | 'admission' | 'other';
  priority: 'routine' | 'urgent' | 'stat';
  referredByDoctor?: string;
  doctorId?: string;
  notes?: string;
  tests: Array<{
    testId: string;
    testCode: string;
    testName: string;
    price: number;
    panelCode?: string;
    panelName?: string;
  }>;
  discount?: number;
  discountType?: 'fixed' | 'percentage';
  paymentMethod?: 'cash' | 'orange_money' | 'afrimoney' | 'wallet';
  initialPaymentAmount?: number;
  initialPayments?: Array<{ amount: number; paymentMethod: string }>;
}

interface OrderUpdate {
  status?: 'awaiting_payment' | 'paid' | 'pending_collection' | 'collected' | 'processing' | 'completed' | 'cancelled';
  priority?: 'routine' | 'urgent' | 'stat';
  notes?: string;
  paidAmount?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  paymentMethod?: 'cash' | 'orange_money' | 'afrimoney' | 'wallet';
  // Backend snake_case format
  payment_status?: 'pending' | 'partial' | 'paid';
  payment_method?: 'cash' | 'orange_money' | 'afrimoney' | 'wallet';
}

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ['orders', status],
    queryFn: async () => {
      const params: any = {
        limit: 100, // Increase limit to show more orders
      };
      if (status && status !== 'all') {
        params.status = status;
      }
      const orders = await ordersAPI.getAll(params);
      return (orders || []).map((order: any) => normalizeOrder(order));
    },
    staleTime: 30 * 1000, // 30 seconds — reduce refetches on slow network
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const order = await ordersAPI.getById(id);
      return normalizeOrder(order);
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useTodayOrders() {
  return useQuery({
    queryKey: ['orders', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const orders = await ordersAPI.getAll({ date: today });
      return (orders || []).map((order: any) => normalizeOrder(order));
    },
    staleTime: 30 * 1000,
  });
}

export function usePendingCollectionOrders() {
  return useQuery({
    queryKey: ['orders', 'pending_collection'],
    queryFn: async () => {
      const orders = await ordersAPI.getPendingCollection();
      return (orders || []).map((order: any) => normalizeOrder(order));
    },
    staleTime: 30 * 1000,
  });
}

export function useProcessingOrders() {
  return useQuery({
    queryKey: ['orders', 'processing'],
    queryFn: async () => {
      const orders = await ordersAPI.getPendingResults();
      return (orders || []).map((order: any) => normalizeOrder(order));
    },
    staleTime: 10 * 1000, // 10 seconds - refresh more often for live queue
    refetchInterval: 15 * 1000, // Auto-refetch every 15 seconds
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: OrderCreate) => {
      return await ordersAPI.create(orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OrderUpdate }) => {
      return await ordersAPI.update(id, updates);
    },
    onSuccess: (_, variables) => {
      // Invalidate ALL order-related queries immediately
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['daily-income'] });

      // If marking as completed, optimistically remove from processing queue
      if (variables.updates.status === 'completed') {
        queryClient.setQueriesData(
          { queryKey: ['orders', 'processing'], exact: false },
          (old: unknown) => {
            if (!Array.isArray(old)) return old;
            return old.filter((order: any) => {
              const orderId = order.id || order._id;
              return orderId !== variables.id;
            });
          }
        );
      }
    },
  });
}

export function usePaymentStats(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['payment-stats', startDate, endDate],
    queryFn: async () => {
      return await ordersAPI.getPaymentStats(startDate, endDate);
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useDailyIncome(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['daily-income', startDate, endDate],
    queryFn: async () => {
      return await ordersAPI.getDailyIncome(startDate, endDate);
    },
    staleTime: 60 * 1000,
  });
}

export function useOutstandingBalances() {
  return useQuery({
    queryKey: ['outstanding-balances'],
    queryFn: async () => {
      return await ordersAPI.getOutstandingBalances();
    },
    staleTime: 30 * 1000,
  });
}

export function useAddPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: { amount: number; paymentMethod: string; notes?: string } }) => {
      return await ordersAPI.addPayment(orderId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['daily-income'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    },
  });
}

export function useAssignDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      data,
    }: {
      orderId: string;
      data: { doctorId?: string; referredByDoctor?: string };
    }) => {
      return await ordersAPI.assignDoctor(orderId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-referral-report'] });
    },
  });
}

export function usePaymentHistory(orderId: string) {
  return useQuery({
    queryKey: ['payment-history', orderId],
    queryFn: async () => {
      return await ordersAPI.getPaymentHistory(orderId);
    },
    enabled: !!orderId,
  });
}

export function useCollectOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderId: string) => {
      return await ordersAPI.collect(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending_collection'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return await ordersAPI.delete(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
