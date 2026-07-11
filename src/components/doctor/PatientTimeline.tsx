import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, FileText, FlaskConical, Pill, BedDouble,
  AlertTriangle, Activity, CreditCard, UserCheck, Stethoscope, Wallet,
  ClipboardList, Heart, ArrowRightLeft, LogOut, StickyNote
} from 'lucide-react';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import api from '@/services/api';

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  title: string;
  summary?: string;
  detail?: string;
  onClick?: () => void;
  vitals?: Record<string, any>;
}

const EVENT_CONFIG: Record<string, { icon: any; color: string; bgColor: string; borderColor: string }> = {
  visit: { icon: UserCheck, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  soap: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  lab_ordered: { icon: FlaskConical, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  lab_resulted: { icon: FlaskConical, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  prescription: { icon: Pill, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  admission: { icon: BedDouble, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
  discharge: { icon: LogOut, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  wallet: { icon: Wallet, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  payment: { icon: CreditCard, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  triage_override: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  treatment_plan: { icon: ClipboardList, color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  vitals: { icon: Heart, color: 'text-rose-500', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
  referral: { icon: ArrowRightLeft, color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  note: { icon: StickyNote, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
};

function groupByDate(events: TimelineEvent[]) {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    const d = new Date(event.date);
    const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }
  return groups;
}

function hasVitalsData(vitals: Record<string, any>): boolean {
  return ['bloodPressure', 'temperature', 'heartRate', 'respiratoryRate', 'weight', 'height', 'oxygenSaturation']
    .some((k) => vitals[k] !== undefined && vitals[k] !== null && vitals[k] !== '');
}

function VitalsInline({ vitals }: { vitals: Record<string, any> }) {
  const items = [
    { label: 'BP', value: vitals.bloodPressure, unit: 'mmHg' },
    { label: 'HR', value: vitals.heartRate, unit: 'bpm' },
    { label: 'Temp', value: vitals.temperature, unit: '°C' },
    { label: 'RR', value: vitals.respiratoryRate, unit: '/min' },
    { label: 'SpO2', value: vitals.oxygenSaturation, unit: '%' },
    { label: 'Wt', value: vitals.weight, unit: 'kg' },
  ].filter((v) => v.value !== undefined && v.value !== null && v.value !== '');

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {items.map((v) => (
        <span key={v.label} className="inline-flex items-center gap-1 rounded bg-white/80 border border-white px-1.5 py-0.5 text-[10px] font-mono">
          <span className="font-semibold text-slate-700">{v.label}</span>
          <span className="text-slate-900">{v.value}</span>
          <span className="text-muted-foreground">{v.unit}</span>
        </span>
      ))}
    </div>
  );
}

function DetailBlock({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const summary = event.summary || '';
  const detail = event.detail || '';

  return (
    <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
      {event.vitals && hasVitalsData(event.vitals) && (
        <VitalsInline vitals={event.vitals} />
      )}
      {expanded ? (
        <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed mt-1">{detail || summary}</div>
      ) : (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
      )}
      {detail && detail.length > 80 && (
        <span className="text-[10px] text-primary font-medium mt-0.5 block">{expanded ? 'Click to collapse' : 'Click to expand'}</span>
      )}
    </div>
  );
}

interface PatientTimelineProps {
  patientId: string;
  patientChart: any;
  patientVisits: any[];
  patientOrders: any[];
  patientPrescriptions: any[];
  chartLoading: boolean;
  onNavigate?: (tab: string) => void;
}

export function PatientTimeline({
  patientId,
  patientChart,
  patientVisits,
  patientOrders,
  patientPrescriptions,
  chartLoading,
  onNavigate,
}: PatientTimelineProps) {
  const { data: treatmentPlans = [] } = useQuery({
    queryKey: ['treatment-plans', 'patient', patientId],
    queryFn: () => treatmentPlanService.getForPatient(patientId),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', 'patient', patientId],
    queryFn: async () => {
      const res = await api.get(`/payments/patient/${patientId}`);
      return res.data || [];
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });

  const events = useMemo<TimelineEvent[]>(() => {
    const result: TimelineEvent[] = [];

    // Visits — with doctor name, visit type, consultation fee
    if (patientVisits) {
      for (const v of patientVisits) {
        const doctorName = typeof v.doctorId === 'object' ? v.doctorId?.fullName : null;
        result.push({
          id: `visit-${v._id}`,
          type: 'visit',
          date: v.createdAt,
          ...EVENT_CONFIG.visit,
          title: `Visit #${v.visitNumber || v._id?.slice(-6)}`,
          summary: [
            v.visitType || '',
            v.chiefComplaint || v.status?.replace(/_/g, ' ') || 'Visit created',
            doctorName ? `Dr. ${doctorName}` : '',
          ].filter(Boolean).join(' · '),
          detail: [
            `Status: ${v.status?.replace(/_/g, ' ')}`,
            `Type: ${v.visitType || 'N/A'}`,
            v.chiefComplaint ? `CC: ${v.chiefComplaint}` : '',
            v.diagnosis ? `Dx: ${v.diagnosis}` : '',
            doctorName ? `Doctor: Dr. ${doctorName}` : '',
            v.room ? `Room: ${v.room}` : '',
            v.consultationFee ? `Fee: Le ${v.consultationFee.toLocaleString()}${v.consultationPaid ? ' (paid)' : ' (unpaid)'}` : '',
            v.triagePriority ? `Triage: ${v.triagePriority.replace(/_/g, ' ')}` : '',
            v.triageNotes ? `Triage notes: ${v.triageNotes}` : '',
          ].filter(Boolean).join('\n'),
        });
      }
    }

    // Vitals history from chart (triage, SOAP, admission readings)
    const vitalsHistory = patientChart?.vitalsHistory || [];
    for (const entry of vitalsHistory) {
      if (!hasVitalsData(entry.vitalSigns || {})) continue;
      const sourceLabel = entry.source === 'triage' ? 'Nurse triage'
        : entry.source === 'admission' ? 'Inpatient'
        : 'SOAP';
      const recordedBy = typeof entry.recordedBy === 'object' ? entry.recordedBy?.fullName : null;
      result.push({
        id: `vitals-${entry.source}-${entry.date || Math.random()}`,
        type: 'vitals',
        date: entry.date,
        ...EVENT_CONFIG.vitals,
        title: `Vitals (${sourceLabel})`,
        summary: [
          recordedBy ? `Recorded by ${recordedBy}` : '',
          entry.visitNumber ? `Visit ${entry.visitNumber}` : '',
        ].filter(Boolean).join(' · ') || 'Vital signs recorded',
        detail: [
          `Source: ${sourceLabel}`,
          entry.visitNumber ? `Visit: ${entry.visitNumber}` : '',
          recordedBy ? `Recorded by: ${recordedBy}` : '',
          `BP: ${entry.vitalSigns?.bloodPressure || '-'}`,
          `HR: ${entry.vitalSigns?.heartRate || '-'} bpm`,
          `Temp: ${entry.vitalSigns?.temperature || '-'} °C`,
          `RR: ${entry.vitalSigns?.respiratoryRate || '-'} /min`,
          `SpO2: ${entry.vitalSigns?.oxygenSaturation || '-'} %`,
          `Weight: ${entry.vitalSigns?.weight || '-'} kg`,
          `Height: ${entry.vitalSigns?.height || '-'} cm`,
        ].join('\n'),
        vitals: entry.vitalSigns,
      });
    }

    // SOAP notes — with doctor name, vital signs
    const soapNotes = patientChart?.soapNotes || [];
    for (const note of soapNotes) {
      const doctorName = typeof note.doctorId === 'object' ? note.doctorId?.fullName : null;
      const parts: string[] = [];
      if (note.historyPresentIllness) parts.push(`S: ${note.historyPresentIllness}`);
      if (note.physicalExamination) parts.push(`O: ${note.physicalExamination}`);
      if (note.diagnosis) parts.push(`A: ${note.diagnosis}`);
      if (note.treatmentPlan) parts.push(`P: ${note.treatmentPlan}`);

      const summaryParts: string[] = [];
      if (note.historyPresentIllness) summaryParts.push(`S: ${note.historyPresentIllness.slice(0, 60)}${note.historyPresentIllness.length > 60 ? '...' : ''}`);
      if (note.physicalExamination) summaryParts.push(`O: ${note.physicalExamination.slice(0, 40)}${note.physicalExamination.length > 40 ? '...' : ''}`);
      if (note.diagnosis) summaryParts.push(`A: ${note.diagnosis.slice(0, 60)}${note.diagnosis.length > 60 ? '...' : ''}`);
      if (note.treatmentPlan) summaryParts.push(`P: ${note.treatmentPlan.slice(0, 40)}${note.treatmentPlan.length > 40 ? '...' : ''}`);

      const soapVitals = note.vitalSigns;

      result.push({
        id: `soap-${note._id}`,
        type: 'soap',
        date: note.createdAt || note.signedAt,
        ...EVENT_CONFIG.soap,
        title: note.isSigned ? 'SOAP Note (signed)' : 'SOAP Note',
        summary: [
          summaryParts.join(' | ') || 'SOAP note recorded',
          doctorName ? `Dr. ${doctorName}` : '',
        ].filter(Boolean).join(' · '),
        detail: [
          doctorName ? `Doctor: Dr. ${doctorName}` : '',
          note.isSigned ? 'Status: Signed' : 'Status: Draft',
          ...parts,
        ].filter(Boolean).join('\n'),
        vitals: soapVitals,
      });
    }

    // Lab orders — with amount, doctor, test count
    if (patientOrders) {
      for (const order of patientOrders) {
        const type = order.orderType || order.order_type;
        if (type === 'lab') {
          const tests = order.order_tests || order.tests || [];
          const testNames = tests.map((t: any) => t.testName || t.testCode).join(', ');
          const hasResults = order.status === 'completed';
          const doctorName = typeof order.doctorId === 'object' ? order.doctorId?.fullName : (typeof order.orderedBy === 'object' ? order.orderedBy?.fullName : null);
          result.push({
            id: `lab-${order._id}`,
            type: 'lab_ordered',
            date: order.createdAt,
            ...EVENT_CONFIG.lab_ordered,
            title: `Lab Order: ${testNames || 'Tests ordered'}`,
            summary: [
              `${tests.length} test(s)`,
              order.total ? `Le ${order.total.toLocaleString()}` : '',
              `Status: ${(order.paymentStatus || order.payment_status || 'pending').replace(/_/g, ' ')}`,
              doctorName ? `Dr. ${doctorName}` : '',
            ].filter(Boolean).join(' · '),
            detail: [
              `Tests: ${testNames}`,
              `Count: ${tests.length}`,
              order.total ? `Total: Le ${order.total.toLocaleString()}` : '',
              `Priority: ${order.priority || 'routine'}`,
              `Payment: ${(order.paymentStatus || order.payment_status || 'pending').replace(/_/g, ' ')}`,
              `Status: ${(order.status || 'pending').replace(/_/g, ' ')}`,
              doctorName ? `Ordered by: Dr. ${doctorName}` : '',
            ].filter(Boolean).join('\n'),
            onClick: hasResults && onNavigate ? () => onNavigate('lab-results') : undefined,
          });
        }
      }
    }

    // Lab results from patient chart — with flags, reviewed status
    const labResults = patientChart?.labResults || [];
    for (const r of labResults) {
      const isAbnormal = r.flag && r.flag !== 'normal';
      result.push({
        id: `result-${r._id}`,
        type: 'lab_resulted',
        date: r.resulted_at || r.createdAt,
        ...EVENT_CONFIG.lab_resulted,
        title: `${r.testName}: ${r.value}${r.unit ? ' ' + r.unit : ''}`,
        summary: isAbnormal ? `Flag: ${r.flag?.replace(/_/g, ' ')}` : 'Normal',
        detail: [
          `Value: ${r.value}${r.unit ? ' ' + r.unit : ''}`,
          r.referenceRange || r.reference_range ? `Ref: ${r.referenceRange || r.reference_range}` : '',
          `Flag: ${(r.flag || 'normal').replace(/_/g, ' ')}`,
          r.resultedBy ? `Resulted by: ${typeof r.resultedBy === 'object' ? r.resultedBy?.fullName : r.resultedBy}` : '',
          r.verifiedBy ? `Verified by: ${typeof r.verifiedBy === 'object' ? r.verifiedBy?.fullName : r.verifiedBy}` : '',
        ].filter(Boolean).join('\n'),
        onClick: onNavigate ? () => onNavigate('lab-results') : undefined,
      });
    }

    // Prescriptions — with doctor, dispensing status, more detail
    if (patientPrescriptions) {
      for (const rx of patientPrescriptions) {
        const items = rx.items || [];
        const medNames = items.map((i: any) => i.medicationName).join(', ');
        const doctorName = typeof rx.doctorId === 'object' ? rx.doctorId?.fullName : null;
        const dispensedByName = typeof rx.dispensedBy === 'object' ? rx.dispensedBy?.fullName : null;
        const totalCost = items.reduce((sum: number, i: any) => sum + (i.unitPrice || 0) * (i.quantity || 0), 0);

        result.push({
          id: `rx-${rx._id}`,
          type: 'prescription',
          date: rx.createdAt,
          ...EVENT_CONFIG.prescription,
          title: `Prescription: ${medNames || 'Medications'}`,
          summary: [
            `${items.length} medication(s)`,
            totalCost > 0 ? `Le ${totalCost.toLocaleString()}` : '',
            rx.isPaid ? 'Paid' : 'Pending payment',
            rx.status === 'dispensed' ? 'Dispensed' : '',
            doctorName ? `Dr. ${doctorName}` : '',
          ].filter(Boolean).join(' · '),
          detail: [
            doctorName ? `Doctor: Dr. ${doctorName}` : '',
            `Status: ${rx.status || 'pending'}`,
            `Paid: ${rx.isPaid ? 'Yes' : 'No'}`,
            dispensedByName ? `Dispensed by: ${dispensedByName}` : '',
            totalCost > 0 ? `Total: Le ${totalCost.toLocaleString()}` : '',
            '---',
            ...items.map((i: any) => [
              `${i.medicationName}`,
              i.dosage ? `  Dose: ${i.dosage}` : '',
              i.frequency ? `  Freq: ${i.frequency}` : '',
              i.duration ? `  Duration: ${i.duration}` : '',
              i.quantity ? `  Qty: ${i.quantity}` : '',
              i.instructions ? `  Instructions: ${i.instructions}` : '',
            ].filter(Boolean).join('\n')),
          ].filter(Boolean).join('\n'),
        });
      }
    }

    // Payments — consultation, lab, prescription, pharmacy
    if (Array.isArray(payments)) {
      for (const p of payments) {
        const methodLabel = p.paymentMethod?.replace(/_/g, ' ') || 'cash';
        result.push({
          id: `payment-${p._id}`,
          type: 'payment',
          date: p.createdAt,
          ...EVENT_CONFIG.payment,
          title: `Payment: Le ${(p.amount || 0).toLocaleString()}`,
          summary: [
            (p.paymentType || 'other').replace(/_/g, ' '),
            methodLabel,
            p.notes ? p.notes.slice(0, 60) : '',
          ].filter(Boolean).join(' · '),
          detail: [
            `Amount: Le ${(p.amount || 0).toLocaleString()}`,
            `Method: ${methodLabel}`,
            `Type: ${(p.paymentType || 'other').replace(/_/g, ' ')}`,
            p.notes ? `Note: ${p.notes}` : '',
            p.isRefunded ? 'REFUNDED' : '',
          ].filter(Boolean).join('\n'),
        });
      }
    }

    // Admissions — with doctor, nursing records, discharge
    const admissions = patientChart?.admissions || [];
    for (const adm of admissions) {
      const doctorName = typeof adm.doctorId === 'object' ? adm.doctorId?.fullName : null;
      const nurseName = typeof adm.primaryNurseId === 'object' ? adm.primaryNurseId?.fullName : null;
      const isDischarged = adm.status === 'discharged';
      const isReadmitted = adm.status === 'readmitted';

      // Admission event
      result.push({
        id: `adm-${adm._id}`,
        type: isDischarged ? 'discharge' : 'admission',
        date: adm.admittedAt || adm.createdAt,
        ...(isDischarged ? EVENT_CONFIG.discharge : EVENT_CONFIG.admission),
        title: isDischarged
          ? `Discharged: ${adm.wardType || 'General'} ward`
          : `Admission: ${adm.wardType || 'General'} ward`,
        summary: [
          adm.admissionReason || adm.diagnosis || 'Admitted',
          doctorName ? `Dr. ${doctorName}` : '',
          nurseName ? `Nurse: ${nurseName}` : '',
          isDischarged ? 'Discharged' : '',
          isReadmitted ? 'Readmitted' : '',
        ].filter(Boolean).join(' · '),
        detail: [
          `Ward: ${adm.wardType}`,
          adm.admissionNumber ? `Admission #: ${adm.admissionNumber}` : '',
          adm.bedNumber ? `Bed: ${adm.bedNumber}` : '',
          `Reason: ${adm.admissionReason || 'N/A'}`,
          adm.diagnosis ? `Dx: ${adm.diagnosis}` : '',
          doctorName ? `Doctor: Dr. ${doctorName}` : '',
          nurseName ? `Primary nurse: ${nurseName}` : '',
          `Status: ${(adm.status || 'active').replace(/_/g, ' ')}`,
          adm.dischargedAt ? `Discharged: ${new Date(adm.dischargedAt).toLocaleString()}` : '',
          adm.dischargeNotes ? `Discharge notes: ${adm.dischargeNotes}` : '',
          adm.dischargeDiagnosis ? `Discharge Dx: ${adm.dischargeDiagnosis}` : '',
          adm.lengthOfStay ? `Length of stay: ${adm.lengthOfStay} day(s)` : '',
        ].filter(Boolean).join('\n'),
      });

      // Admission vitals log entries (inpatient nursing vitals)
      const vitalsLog = adm.vitalsLog || [];
      for (const reading of vitalsLog) {
        if (!hasVitalsData(reading)) continue;
        const recordedByName = typeof reading.recordedBy === 'object' ? reading.recordedBy?.fullName : null;
        result.push({
          id: `adm-vitals-${adm._id}-${reading.recordedAt || Math.random()}`,
          type: 'vitals',
          date: reading.recordedAt || adm.admittedAt,
          ...EVENT_CONFIG.vitals,
          title: `Inpatient Vitals (${adm.admissionNumber || 'Admission'})`,
          summary: [
            recordedByName ? `By ${recordedBy}` : '',
            `Ward: ${adm.wardType || 'General'}`,
          ].filter(Boolean).join(' · ') || 'Inpatient vital signs',
          detail: [
            `Admission: ${adm.admissionNumber || adm._id?.slice(-6)}`,
            `Ward: ${adm.wardType}`,
            recordedByName ? `Recorded by: ${recordedBy}` : '',
            `BP: ${reading.bloodPressure || '-'}`,
            `HR: ${reading.heartRate || '-'} bpm`,
            `Temp: ${reading.temperature || '-'} °C`,
            `RR: ${reading.respiratoryRate || '-'} /min`,
            `SpO2: ${reading.oxygenSaturation || '-'} %`,
            `Weight: ${reading.weight || '-'} kg`,
          ].filter(Boolean).join('\n'),
          vitals: reading,
        });
      }

      // Admission nursing notes
      const nursingNotes = adm.nursingNotes || [];
      for (const nNote of nursingNotes) {
        const authoredByName = typeof nNote.authoredBy === 'object' ? nNote.authoredBy?.fullName : null;
        if (!nNote.content) continue;
        result.push({
          id: `adm-note-${adm._id}-${nNote.createdAt || Math.random()}`,
          type: 'note',
          date: nNote.createdAt || adm.admittedAt,
          ...EVENT_CONFIG.note,
          title: `Nursing Note (${adm.admissionNumber || 'Admission'})`,
          summary: nNote.content?.slice(0, 80) || 'Nursing note',
          detail: [
            `Admission: ${adm.admissionNumber || adm._id?.slice(-6)}`,
            authoredByName ? `By: ${authoredByName}` : '',
            nNote.category ? `Category: ${nNote.category}` : '',
            `---`,
            nNote.content || '',
          ].filter(Boolean).join('\n'),
        });
      }
    }

    // Referral events — from visits that were referred
    for (const v of (patientVisits || [])) {
      if (v.referredToSpecialistId) {
        const specialistName = typeof v.referredToSpecialistId === 'object' ? v.referredToSpecialistId?.fullName : null;
        const referringDoctor = typeof v.doctorId === 'object' ? v.doctorId?.fullName : null;
        if (specialistName) {
          result.push({
            id: `referral-${v._id}`,
            type: 'referral',
            date: v.referredAt || v.updatedAt || v.createdAt,
            ...EVENT_CONFIG.referral,
            title: `Referral to ${specialistName}`,
            summary: [
              v.referredReason || 'Specialist consultation',
              referringDoctor ? `From Dr. ${referringDoctor}` : '',
            ].filter(Boolean).join(' · '),
            detail: [
              `Referred to: Dr. ${specialistName}`,
              referringDoctor ? `From: Dr. ${referringDoctor}` : '',
              `Visit: ${v.visitNumber || 'N/A'}`,
              `Reason: ${v.referredReason || 'N/A'}`,
              `Status: ${v.status?.replace(/_/g, ' ')}`,
            ].filter(Boolean).join('\n'),
          });
        }
      }
    }

    // Treatment plans
    for (const plan of treatmentPlans) {
      const totalAmount = (plan.items || []).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
      result.push({
        id: `tp-${plan._id}`,
        type: 'treatment_plan',
        date: plan.createdAt,
        ...EVENT_CONFIG.treatment_plan,
        title: `Treatment Plan ${plan.planNumber}`,
        summary: [
          plan.createdByName ? `${plan.createdByName}` : '',
          plan.status?.replace(/_/g, ' '),
          `${(plan.items || []).length} item(s)`,
          totalAmount > 0 ? `Le ${totalAmount.toLocaleString()}` : '',
        ].filter(Boolean).join(' · '),
        detail: [
          plan.createdByName ? `Created by: ${plan.createdByName} (${plan.createdByRole || ''})` : '',
          `Status: ${(plan.status || 'pending').replace(/_/g, ' ')}`,
          totalAmount > 0 ? `Total: Le ${totalAmount.toLocaleString()}` : '',
          '---',
          ...(plan.items || []).map((i: any) => `${i.type || 'item'}: ${i.description} — Le ${(i.amount || 0).toLocaleString()}`),
        ].filter(Boolean).join('\n'),
      });
    }

    // Patient notes from chart
    const notes = patientChart?.notes || [];
    for (const note of notes) {
      const createdByName = typeof note.createdBy === 'object' ? note.createdBy?.fullName : null;
      result.push({
        id: `note-${note._id}`,
        type: 'note',
        date: note.createdAt,
        ...EVENT_CONFIG.note,
        title: `Patient Note${note.category ? `: ${note.category}` : ''}`,
        summary: note.content?.slice(0, 80) || 'Note recorded',
        detail: [
          createdByName ? `By: ${createdByName}` : '',
          note.category ? `Category: ${note.category}` : '',
          note.priority ? `Priority: ${note.priority}` : '',
          '---',
          note.content || '',
        ].filter(Boolean).join('\n'),
      });
    }

    // Triage overrides
    for (const v of (patientVisits || [])) {
      if (v.triageOverride_priority || v.triageOverridePriority) {
        result.push({
          id: `triage-${v._id}`,
          type: 'triage_override',
          date: v.updatedAt || v.createdAt,
          ...EVENT_CONFIG.triage_override,
          title: `Triage Override: ${(v.triageOverride_priority || v.triageOverridePriority).replace(/_/g, ' ')}`,
          summary: v.doctorTriageNotes || v.triageNotes || 'Doctor adjusted triage priority',
          detail: [
            `New priority: ${(v.triageOverride_priority || v.triageOverridePriority).replace(/_/g, ' ')}`,
            v.doctorTriageNotes ? `Doctor notes: ${v.doctorTriageNotes}` : '',
            v.triageNotes ? `Triage notes: ${v.triageNotes}` : '',
          ].filter(Boolean).join('\n'),
        });
      }
    }

    return result;
  }, [patientChart, patientVisits, patientOrders, patientPrescriptions, treatmentPlans, payments, onNavigate]);

  const grouped = useMemo(() => groupByDate(events), [events]);

  if (chartLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading timeline...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No events recorded for this patient yet.
      </div>
    );
  }

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6">
        {sortedDates.map((dateLabel) => (
          <div key={dateLabel}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{dateLabel}</h3>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">{grouped[dateLabel].length} event{grouped[dateLabel].length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2 ml-2 border-l-2 border-border pl-4">
              {grouped[dateLabel]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((event) => {
                  const Icon = event.icon;
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "relative flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        event.bgColor, event.borderColor,
                        event.onClick && "cursor-pointer hover:shadow-sm"
                      )}
                      onClick={event.onClick}
                    >
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", event.bgColor)}>
                        <Icon className={cn("w-3.5 h-3.5", event.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-foreground truncate">{event.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <DetailBlock event={event} />
                        {event.onClick && (
                          <span className="text-[10px] text-primary font-medium mt-0.5 block">Click to view details</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
