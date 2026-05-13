/**
 * HL7 v2.5.1 Message Builder and Parser
 * For communication with laboratory analyzers
 */

export interface HL7Segment {
  type: string;
  fields: string[];
}

export interface PatientInfo {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYYMMDD format
  gender: 'M' | 'F' | 'O';
}

export interface TestOrder {
  orderId: string;
  sampleId: string;
  testCodes: string[];
  priority: 'R' | 'S' | 'A'; // Routine, Stat, ASAP
  collectionDateTime: string; // HL7 timestamp format
}

// HL7 field separators
const FIELD_SEPARATOR = '|';
const COMPONENT_SEPARATOR = '^';
const REPETITION_SEPARATOR = '~';
const ESCAPE_CHARACTER = '\\';
const SUBCOMPONENT_SEPARATOR = '&';
const ENCODING_CHARACTERS = `${COMPONENT_SEPARATOR}${REPETITION_SEPARATOR}${ESCAPE_CHARACTER}${SUBCOMPONENT_SEPARATOR}`;

/**
 * Generate current timestamp in HL7 format (YYYYMMDDHHMMSS)
 */
export function getHL7Timestamp(date: Date = new Date()): string {
  return date.toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
}

/**
 * Generate a unique message control ID
 */
export function generateMessageControlId(): string {
  return `MSG${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Build MSH (Message Header) segment
 */
export function buildMSH(
  messageType: string,
  sendingApp: string = 'HARBOUR',
  sendingFacility: string = 'LIS',
  receivingApp: string = '',
  receivingFacility: string = ''
): string {
  const timestamp = getHL7Timestamp();
  const controlId = generateMessageControlId();
  
  return [
    'MSH',
    ENCODING_CHARACTERS,
    sendingApp,
    sendingFacility,
    receivingApp,
    receivingFacility,
    timestamp,
    '', // Security
    messageType,
    controlId,
    'P', // Processing ID (P = Production)
    '2.5.1' // HL7 Version
  ].join(FIELD_SEPARATOR);
}

/**
 * Build PID (Patient Identification) segment
 */
export function buildPID(patient: PatientInfo): string {
  // Format DOB to HL7 format (YYYYMMDD)
  const dob = patient.dateOfBirth.replace(/-/g, '');
  
  return [
    'PID',
    '1', // Set ID
    '', // External Patient ID
    patient.patientId, // Internal Patient ID
    '', // Alternate Patient ID
    `${patient.lastName}${COMPONENT_SEPARATOR}${patient.firstName}`, // Patient Name
    '', // Mother's Maiden Name
    dob, // Date of Birth
    patient.gender, // Sex
    '', // Patient Alias
    '', // Race
    '', // Address
    '', // County Code
    '', // Phone Home
    '', // Phone Business
    '', // Primary Language
    '', // Marital Status
    '', // Religion
    '', // Patient Account Number
    '', // SSN
    '', // Driver's License
    '', // Mother's Identifier
    '', // Ethnic Group
    '', // Birth Place
    '', // Multiple Birth Indicator
    '', // Birth Order
    '', // Citizenship
    '', // Veterans Military Status
    '', // Nationality
    '', // Patient Death Date/Time
    '' // Patient Death Indicator
  ].join(FIELD_SEPARATOR);
}

/**
 * Build ORC (Common Order) segment
 */
export function buildORC(orderId: string, orderControl: string = 'NW'): string {
  return [
    'ORC',
    orderControl, // Order Control (NW = New Order, SC = Status Changed, etc.)
    orderId, // Placer Order Number
    '', // Filler Order Number
    '', // Placer Group Number
    'CM', // Order Status (CM = Order is completed)
    '', // Response Flag
    '', // Quantity/Timing
    '', // Parent
    '', // Date/Time of Transaction
    '', // Entered By
    '', // Verified By
    '', // Ordering Provider
    '' // Enterer's Location
  ].join(FIELD_SEPARATOR);
}

/**
 * Build OBR (Observation Request) segment
 */
export function buildOBR(
  setId: number,
  orderId: string,
  sampleId: string,
  testCode: string,
  testName: string,
  collectionDateTime: string,
  priority: 'R' | 'S' | 'A' = 'R'
): string {
  const priorityMap = { R: 'R', S: 'S', A: 'A' };
  
  return [
    'OBR',
    setId.toString(), // Set ID
    orderId, // Placer Order Number
    sampleId, // Filler Order Number
    `${testCode}${COMPONENT_SEPARATOR}${testName}`, // Universal Service ID
    priorityMap[priority], // Priority
    '', // Requested Date/Time
    collectionDateTime, // Observation Date/Time
    '', // Observation End Date/Time
    '', // Collection Volume
    '', // Collector Identifier
    '', // Specimen Action Code
    '', // Danger Code
    '', // Relevant Clinical Info
    '', // Specimen Received Date/Time
    '', // Specimen Source
    '', // Ordering Provider
    '', // Order Callback Phone Number
    '', // Placer Field 1
    '', // Placer Field 2
    '', // Filler Field 1
    '', // Filler Field 2
    '', // Results Rpt/Status Chng Date/Time
    '', // Charge to Practice
    '', // Diagnostic Service Section ID
    'F', // Result Status (F = Final)
    '', // Parent Result
    '', // Quantity/Timing
    '', // Result Copies To
    '', // Parent Number
    '' // Transportation Mode
  ].join(FIELD_SEPARATOR);
}

/**
 * Build a complete ORM^O01 (Order Message) for sending to analyzer
 */
export function buildOrderMessage(
  patient: PatientInfo,
  order: TestOrder,
  receivingApp: string,
  receivingFacility: string
): string {
  const segments: string[] = [];
  
  // MSH - Message Header
  segments.push(buildMSH(
    'ORM^O01^ORM_O01',
    'HARBOUR',
    'LIS',
    receivingApp,
    receivingFacility
  ));
  
  // PID - Patient Identification
  segments.push(buildPID(patient));
  
  // For each test, create ORC and OBR segments
  order.testCodes.forEach((testCode, index) => {
    // ORC - Common Order
    segments.push(buildORC(order.orderId, 'NW'));
    
    // OBR - Observation Request
    segments.push(buildOBR(
      index + 1,
      order.orderId,
      order.sampleId,
      testCode,
      testCode, // Using code as name for now
      order.collectionDateTime,
      order.priority
    ));
  });
  
  // Use carriage return as segment terminator (HL7 standard)
  return segments.join('\r') + '\r';
}

/**
 * Build a simple ACK message
 */
export function buildACK(
  originalControlId: string,
  ackCode: 'AA' | 'AE' | 'AR' = 'AA',
  errorMessage?: string
): string {
  const segments: string[] = [];
  
  segments.push(buildMSH('ACK'));
  
  const msaFields = [
    'MSA',
    ackCode, // Acknowledgment Code
    originalControlId // Message Control ID from original message
  ];
  
  if (errorMessage) {
    msaFields.push(errorMessage);
  }
  
  segments.push(msaFields.join(FIELD_SEPARATOR));
  
  return segments.join('\r') + '\r';
}

/**
 * Parse an HL7 message into segments
 */
export function parseHL7Message(rawMessage: string): HL7Segment[] {
  const segments: HL7Segment[] = [];
  
  // Normalize line endings to \r
  const lines = rawMessage
    .replace(/\r\n/g, '\r')
    .replace(/\n/g, '\r')
    .split('\r')
    .filter(line => line.trim());
  
  for (const line of lines) {
    const fields = line.split(FIELD_SEPARATOR);
    segments.push({
      type: fields[0],
      fields: fields.slice(1)
    });
  }
  
  return segments;
}

/**
 * Extract value from HL7 component (handles ^ separated values)
 */
export function extractComponent(field: string, componentIndex: number = 0): string {
  const components = field?.split(COMPONENT_SEPARATOR) || [];
  return components[componentIndex] || '';
}

/**
 * Validate HL7 message structure
 */
export function validateHL7Message(rawMessage: string): { valid: boolean; error?: string } {
  const segments = parseHL7Message(rawMessage);
  
  if (segments.length === 0) {
    return { valid: false, error: 'No segments found in message' };
  }
  
  const msh = segments.find(s => s.type === 'MSH');
  if (!msh) {
    return { valid: false, error: 'Missing MSH segment' };
  }
  
  // Check encoding characters
  if (msh.fields[0] !== ENCODING_CHARACTERS) {
    return { valid: false, error: 'Invalid encoding characters' };
  }
  
  return { valid: true };
}
