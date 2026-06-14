import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, FileText, FlaskConical, Pill, BedDouble,
  AlertTriangle, Activity, CreditCard, UserCheck, Stethoscope, Wallet
} from 'lucide-react';

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
}

const EVENT_CONFIG: Record<string, { icon: any; color: string; bgColor: string; borderColor: string }> = {
  visit: { icon: UserCheck, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  soap: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  lab_ordered: { icon: FlaskConical, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  lab_resulted: { icon: FlaskConical, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  prescription: { icon: Pill, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  admission: { icon: BedDouble, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
  wallet: { icon: Wallet, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  triage_override: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
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

function SoapCompact({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const summary = event.summary || '';
  const detail = event.detail || '';

  return (
    <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
      {expanded ? (
        <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{detail || summary}</div>
      ) : (
        <p className="text-xs text-foreground truncate">{summary}</p>
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
  const events = useMemo<TimelineEvent[]>(() => {
    const result: TimelineEvent[] = [];

    // Visits
    if (patientVisits) {
      for (const v of patientVisits) {
        const cfg = EVENT_CONFIG.visit;
        result.push({
          id: `visit-${v._id}`,
          type: 'visit',
          date: v.createdAt,
          ...cfg,
          title: `Visit #${v.visitNumber || v._id?.slice(-6)}`,
          summary: v.chiefComplaint || v.status?.replace(/_/g, ' ') || 'Visit created',
          detail: [
            `Status: ${v.status?.replace(/_/g, ' ')}`,
            v.chiefComplaint ? `CC: ${v.chiefComplaint}` : '',
            v.diagnosis ? `Dx: ${v.diagnosis}` : '',
            v.room ? `Room: ${v.room}` : '',
          ].filter(Boolean).join('\n'),
        });
      }
    }

    // SOAP notes from patient chart
    const soapNotes = patientChart?.soapNotes || [];
    for (const note of soapNotes) {
      const cfg = EVENT_CONFIG.soap;
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

      result.push({
        id: `soap-${note._id}`,
        type: 'soap',
        date: note.createdAt || note.signedAt,
        ...cfg,
        title: note.isSigned ? 'SOAP Note (signed)' : 'SOAP Note',
        summary: summaryParts.join(' | ') || 'SOAP note recorded',
        detail: parts.join('\n') || 'No details',
      });
    }

    // Lab orders
    if (patientOrders) {
      for (const order of patientOrders) {
        const type = order.orderType || order.order_type;
        if (type === 'lab') {
          const testNames = (order.order_tests || order.tests || []).map((t: any) => t.testName || t.testCode).join(', ');
          const cfg = EVENT_CONFIG.lab_ordered;
          const hasResults = order.status === 'completed';
          result.push({
            id: `lab-${order._id}`,
            type: 'lab_ordered',
            date: order.createdAt,
            ...cfg,
            title: `Lab Order: ${testNames || 'Tests ordered'}`,
            summary: `Priority: ${order.priority || 'routine'} · Status: ${order.paymentStatus || order.payment_status || 'pending'}`,
            detail: [
              `Tests: ${testNames}`,
              `Priority: ${order.priority || 'routine'}`,
              `Payment: ${order.paymentStatus || order.payment_status || 'pending'}`,
              `Status: ${order.status || 'pending'}`,
            ].join('\n'),
            onClick: hasResults && onNavigate ? () => onNavigate('lab-results') : undefined,
          });
        }
      }
    }

    // Lab results from patient chart
    const labResults = patientChart?.labResults || [];
    for (const r of labResults) {
      const cfg = EVENT_CONFIG.lab_resulted;
      result.push({
        id: `result-${r._id}`,
        type: 'lab_resulted',
        date: r.resulted_at || r.createdAt,
        ...cfg,
        title: `${r.testName}: ${r.value}${r.unit ? ' ' + r.unit : ''}`,
        summary: r.flag && r.flag !== 'normal' ? `Flag: ${r.flag.replace(/_/g, ' ')}` : 'Normal',
        detail: [
          `Value: ${r.value}${r.unit ? ' ' + r.unit : ''}`,
          r.referenceRange || r.reference_range ? `Ref: ${r.referenceRange || r.reference_range}` : '',
          `Flag: ${r.flag || 'normal'}`,
        ].filter(Boolean).join('\n'),
        onClick: onNavigate ? () => onNavigate('lab-results') : undefined,
      });
    }

    // Prescriptions
    if (patientPrescriptions) {
      for (const rx of patientPrescriptions) {
        const cfg = EVENT_CONFIG.prescription;
        const medNames = (rx.items || []).map((i: any) => i.medicationName).join(', ');
        result.push({
          id: `rx-${rx._id}`,
          type: 'prescription',
          date: rx.createdAt,
          ...cfg,
          title: `Prescription: ${medNames || 'Medications'}`,
          summary: `${(rx.items || []).length} medication(s) · ${rx.isPaid ? 'Paid' : 'Pending payment'}`,
          detail: (rx.items || [])
            .map((i: any) => `${i.medicationName} ${i.dosage || ''} ${i.frequency || ''}`.trim())
            .join('\n') || 'No items',
        });
      }
    }

    // Admissions from patient chart
    const admissions = patientChart?.admissions || [];
    for (const adm of admissions) {
      const cfg = EVENT_CONFIG.admission;
      result.push({
        id: `adm-${adm._id}`,
        type: 'admission',
        date: adm.createdAt,
        ...cfg,
        title: `Admission: ${adm.wardType || 'General'} ward`,
        summary: adm.admissionReason || adm.diagnosis || 'Admitted',
        detail: [
          `Ward: ${adm.wardType}`,
          adm.bedNumber ? `Bed: ${adm.bedNumber}` : '',
          `Reason: ${adm.admissionReason || 'N/A'}`,
          adm.diagnosis ? `Dx: ${adm.diagnosis}` : '',
          `Status: ${adm.status || 'active'}`,
        ].filter(Boolean).join('\n'),
      });
    }

    // Triage overrides
    for (const v of (patientVisits || [])) {
      if (v.triageOverride_priority || v.triageOverridePriority) {
        const cfg = EVENT_CONFIG.triage_override;
        result.push({
          id: `triage-${v._id}`,
          type: 'triage_override',
          date: v.updatedAt || v.createdAt,
          ...cfg,
          title: `Triage Override: ${(v.triageOverride_priority || v.triageOverridePriority).replace(/_/g, ' ')}`,
          summary: v.triageNotes || 'Doctor adjusted triage priority',
          detail: `New priority: ${(v.triageOverride_priority || v.triageOverridePriority).replace(/_/g, ' ')}`,
        });
      }
    }

    return result;
  }, [patientChart, patientVisits, patientOrders, patientPrescriptions, onNavigate]);

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
                        {event.type === 'soap' ? (
                          <SoapCompact event={event} />
                        ) : (
                          event.summary && <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.summary}</p>
                        )}
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
