/**
 * Order Helper Functions
 * Utilities for safely accessing order and patient data across different formats
 */

interface PatientLike {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  patientId?: string;
  patient_id?: string;
  age?: number | string;
  ageValue?: number | string;
  age_value?: number | string;
  ageUnit?: string;
  age_unit?: string;
  phone?: string;
  [key: string]: any;
}

interface OrderLike {
  patient?: PatientLike;
  patients?: PatientLike;
  patientId?: PatientLike | string;
  [key: string]: any;
}

/**
 * Safely get patient object from order
 */
export function getPatient(order: OrderLike): PatientLike | null {
  // Check all possible locations for patient data
  const patient = order.patient || order.patients || order.patientId;
  
  if (!patient || typeof patient !== 'object') {
    return null;
  }
  
  return patient as PatientLike;
}

/**
 * Get patient full name from order
 */
export function getPatientName(order: OrderLike): string {
  const patient = getPatient(order);
  
  if (!patient) {
    return 'Unknown Patient';
  }
  
  const firstName = patient.firstName || patient.first_name || '';
  const lastName = patient.lastName || patient.last_name || '';
  
  return `${firstName} ${lastName}`.trim() || 'Unknown Patient';
}

/**
 * Get patient full name directly from patient object
 */
export function getPatientFullName(patient: PatientLike | null | undefined): string {
  if (!patient) {
    return 'Unknown Patient';
  }
  
  const firstName = patient.firstName || patient.first_name || '';
  const lastName = patient.lastName || patient.last_name || '';
  
  return `${firstName} ${lastName}`.trim() || 'Unknown Patient';
}

/**
 * Get patient ID from order
 */
export function getPatientId(order: OrderLike): string {
  const patient = getPatient(order);
  
  if (!patient) {
    return 'Unknown ID';
  }
  
  // The patient object has a patientId field (the actual patient ID like LAB-20260211-0001)
  // Don't confuse with order.patientId which is the populated patient object
  return patient.patientId || patient.patient_id || 'Unknown ID';
}

/**
 * Get patient phone from order
 */
export function getPatientPhone(order: OrderLike): string | undefined {
  const patient = getPatient(order);
  return patient?.phone;
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

/**
 * Get patient age display using DB fields only.
 * Requires explicit ageValue + ageUnit (no fallback to normalized age).
 */
export function getPatientAgeDisplay(patient: PatientLike | null | undefined): string {
  if (!patient) {
    return '-';
  }

  const ageValue = parseFiniteNumber(patient.ageValue ?? patient.age_value);
  const rawUnit = patient.ageUnit ?? patient.age_unit;
  const ageUnit = typeof rawUnit === 'string' ? rawUnit.trim() : '';

  if (ageValue === undefined || !ageUnit) {
    return '-';
  }

  return `${ageValue} ${ageUnit}`;
}

/**
 * Get order number
 */
export function getOrderNumber(order: any): string {
  return order.orderNumber || order.order_number || 'Unknown Order';
}

/**
 * Get order tests array
 */
export function getOrderTests(order: any): any[] {
  return order.tests || order.order_tests || [];
}

/**
 * Get test codes as comma-separated string
 */
export function getTestCodes(order: any): string {
  const tests = getOrderTests(order);
  
  if (!Array.isArray(tests) || tests.length === 0) {
    return 'No tests';
  }
  
  return tests.map(t => t.testCode || t.test_code || 'Unknown Test').join(', ');
}

/**
 * Get tests grouped by panel name
 * Tests with panel names are grouped, tests without panels are listed individually
 * @param hideCount - If true, don't show component count in parentheses
 */
export function getGroupedTestsByPanel(order: any, hideCount = false): string {
  const tests = getOrderTests(order);
  
  if (!Array.isArray(tests) || tests.length === 0) {
    return 'No tests';
  }
  
  // Separate tests with panels from tests without panels
  const panelGroups = new Map<string, string[]>();
  const individualTests: string[] = [];
  
  tests.forEach(test => {
    const panelName = test.panelName || test.panel_name;
    const testCode = test.testCode || test.test_code || 'Unknown';
    const testName = test.testName || test.test_name || testCode;
    
    if (panelName) {
      // Has a panel - group it
      if (!panelGroups.has(panelName)) {
        panelGroups.set(panelName, []);
      }
      panelGroups.get(panelName)!.push(testName);
    } else {
      // No panel - list individually
      individualTests.push(testName);
    }
  });
  
  // Format panels as "Panel Name (count)" or just "Panel Name"
  const panelSummaries = Array.from(panelGroups.entries()).map(([panelName, codes]) => {
    return hideCount ? panelName : `${panelName} (${codes.length})`;
  });
  
  // Combine panel summaries with individual tests
  const allItems = [...panelSummaries, ...individualTests];
  
  return allItems.join(', ');
}

/**
 * Get test count where panels count as 1 test (not individual components)
 * For example, FBC with 24 components counts as 1 test, not 24
 */
export function getPanelTestCount(order: any): number {
  const tests = getOrderTests(order);
  
  if (!Array.isArray(tests) || tests.length === 0) {
    return 0;
  }
  
  // Count unique panels + individual tests
  const uniquePanels = new Set<string>();
  let individualCount = 0;
  
  tests.forEach(test => {
    const panelName = test.panelName || test.panel_name;
    if (panelName) {
      uniquePanels.add(panelName);
    } else {
      individualCount++;
    }
  });
  
  return uniquePanels.size + individualCount;
}

/**
 * Get order ID (handles both id and _id)
 */
export function getOrderId(order: any): string {
  return order.id || order._id || '';
}

/**
 * Get order total amount
 */
export function getOrderTotal(order: any): number {
  return order.total || order.totalAmount || 0;
}

/**
 * Get order status
 */
export function getOrderStatus(order: any): string {
  return order.status || order.order_status || 'unknown';
}

/**
 * Get order priority
 */
export function getOrderPriority(order: any): string {
  return order.priority?.toUpperCase() || 'ROUTINE';
}

/**
 * Get created timestamp
 */
export function getCreatedAt(order: any): string {
  return order.createdAt || order.created_at || new Date().toISOString();
}
