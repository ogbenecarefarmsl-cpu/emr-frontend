export interface Patient {
  id: string;
  patientId: string; // LAB-YYYYMMDD-#### format
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O';
  phone?: string;
  email?: string;
  address?: string;
  registeredAt: string;
  registeredBy?: string;
}

export interface TestCatalogItem {
  id?: string;
  _id?: string; // MongoDB ID
  code: string;
  name: string;
  category: 'hematology' | 'chemistry' | 'immunoassay' | 'serology' | 'urinalysis' | 'microbiology' | 'other' | 'panel';
  price: number;
  turnaroundTime: number; // in minutes
  sampleType: 'blood' | 'urine' | 'stool' | 'swab' | 'other';
  machineId?: string;
  // Panel-specific properties
  isPanel?: boolean;
  tests?: Array<{
    _id?: string;
    id?: string;
    testId?: string;
    testCode: string;
    testName: string;
  }>;
}

export interface TestOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patient: Patient;
  tests: OrderedTest[];
  priority: 'routine' | 'urgent' | 'stat';
  status: 'pending_payment' | 'pending_collection' | 'collected' | 'processing' | 'completed' | 'cancelled';
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  total: number;
  paymentMethod?: 'cash' | 'card' | 'orange_money' | 'bank_transfer';
  paymentStatus: 'pending' | 'paid' | 'partial';
  orderedAt: string;
  orderedBy: string;
  collectedAt?: string;
  collectedBy?: string;
  completedAt?: string;
  notes?: string;
}

export interface OrderedTest {
  id: string;
  testId: string;
  testCode: string;
  testName: string;
  price: number;
  status: 'pending' | 'collected' | 'processing' | 'completed';
  sampleId?: string;
  machineId?: string;
}

export interface Sample {
  id: string;
  sampleId: string; // Barcode label
  orderId: string;
  orderNumber: string;
  patientId: string;
  patientName: string;
  testIds: string[];
  sampleType: 'blood' | 'urine' | 'stool' | 'swab' | 'other';
  collectedAt: string;
  collectedBy: string;
  status: 'collected' | 'processing' | 'completed';
}

export interface TestResult {
  id: string;
  orderId: string;
  testId: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  resultedAt: string;
  resultedBy: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status: 'preliminary' | 'final' | 'amended';
}

export interface LabMachine {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  protocol: 'HL7' | 'ASTM' | 'FHIR' | 'LIS2-A2';
  ipAddress?: string;
  port?: number;
  status: 'online' | 'offline' | 'error' | 'processing';
  lastCommunication?: string;
  testsSupported: string[];
}

export interface DashboardMetrics {
  pendingOrders: number;
  inProgressOrders: number;
  completedToday: number;
  criticalResults: number;
  machinesOnline: number;
  machinesTotal: number;
  avgTurnaroundTime: number;
  revenueToday: number;
  patientsToday: number;
}

export type UserRole = 'admin' | 'receptionist' | 'lab_tech' | 'doctor' | 'specialist' | 'nurse' | 'pharmacist' | 'inventory_manager';
export type AppRole = UserRole; // Alias for compatibility

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}
