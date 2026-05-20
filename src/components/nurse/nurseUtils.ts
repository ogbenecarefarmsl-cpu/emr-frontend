export const ESI_LEVELS = [
  { value: '1', priority: 'emergency', label: 'ESI 1', color: 'bg-red-600', desc: 'Resuscitation - immediate life-saving' },
  { value: '2', priority: 'urgent', label: 'ESI 2', color: 'bg-orange-500', desc: 'Emergent - high risk, confused/lethargic' },
  { value: '3', priority: 'high', label: 'ESI 3', color: 'bg-yellow-500', desc: 'Urgent - multiple resources needed' },
  { value: '4', priority: 'normal', label: 'ESI 4', color: 'bg-blue-500', desc: 'Less urgent - one resource needed' },
  { value: '5', priority: 'low', label: 'ESI 5', color: 'bg-green-500', desc: 'Non-urgent - no resources needed' },
];

export function triagePriorityFromEsi(esiLevel: string) {
  return ESI_LEVELS.find((level) => level.value === esiLevel)?.priority || 'normal';
}

const VITAL_THRESHOLDS = {
  temperature: { low: 35.5, high: 38.0, criticalHigh: 39.5 },
  heartRate: { low: 50, high: 100, criticalHigh: 130, criticalLow: 40 },
  respiratoryRate: { low: 10, high: 20, criticalHigh: 30, criticalLow: 8 },
  oxygenSaturation: { low: 95, criticalLow: 90 },
};

export function checkAbnormalVitals(vitals: Record<string, string>) {
  const alerts: string[] = [];
  const temp = parseFloat(vitals.temperature);
  if (!Number.isNaN(temp)) {
    if (temp >= VITAL_THRESHOLDS.temperature.criticalHigh) alerts.push(`Critical fever: ${temp} C`);
    else if (temp > VITAL_THRESHOLDS.temperature.high) alerts.push(`Elevated temp: ${temp} C`);
    else if (temp < VITAL_THRESHOLDS.temperature.low) alerts.push(`Hypothermia: ${temp} C`);
  }

  const hr = parseInt(vitals.heartRate, 10);
  if (!Number.isNaN(hr)) {
    if (hr >= VITAL_THRESHOLDS.heartRate.criticalHigh) alerts.push(`Critical tachycardia: ${hr} bpm`);
    else if (hr > VITAL_THRESHOLDS.heartRate.high) alerts.push(`Tachycardia: ${hr} bpm`);
    else if (hr <= VITAL_THRESHOLDS.heartRate.criticalLow) alerts.push(`Critical bradycardia: ${hr} bpm`);
    else if (hr < VITAL_THRESHOLDS.heartRate.low) alerts.push(`Bradycardia: ${hr} bpm`);
  }

  const rr = parseInt(vitals.respiratoryRate, 10);
  if (!Number.isNaN(rr)) {
    if (rr >= VITAL_THRESHOLDS.respiratoryRate.criticalHigh) alerts.push(`Tachypnea: ${rr}/min`);
    else if (rr > VITAL_THRESHOLDS.respiratoryRate.high) alerts.push(`Elevated RR: ${rr}/min`);
    else if (rr <= VITAL_THRESHOLDS.respiratoryRate.criticalLow) alerts.push(`Critical bradypnea: ${rr}/min`);
  }

  const spo2 = parseInt(vitals.oxygenSaturation, 10);
  if (!Number.isNaN(spo2)) {
    if (spo2 <= VITAL_THRESHOLDS.oxygenSaturation.criticalLow) alerts.push(`Critical SpO2: ${spo2}%`);
    else if (spo2 < VITAL_THRESHOLDS.oxygenSaturation.low) alerts.push(`Low SpO2: ${spo2}%`);
  }

  return alerts;
}

export function patientName(patient: any) {
  return `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient';
}

export function admissionLocation(admission: any) {
  const parts = [admission?.wardType, admission?.bedNumber ? `Bed ${admission.bedNumber}` : ''].filter(Boolean);
  return parts.join(' - ') || 'Unassigned';
}
