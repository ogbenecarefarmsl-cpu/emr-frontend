import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, FileText, FlaskConical, Pill, BedDouble,
  AlertTriangle, UserCheck, Wallet, ClipboardList, Clock
} from 'lucide-react';
import { treatmentPlanService } from '@/services/treatmentPlanService';

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
  sections?: Array<{ label: string; value?: string }>;
  relatedSoap?: any[];
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
  treatment_plan: { icon: ClipboardList, color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
};

const EVENT_LABELS: Record<string, string> = {
  visit: 'Visits',
  soap: 'Notes',
  lab_ordered: 'Labs',
  lab_resulted: 'Results',
  prescription: 'Rx',
  admission: 'Admission',
  wallet: 'Wallet',
  triage_override: 'Triage',
  treatment_plan: 'Plans',
};

const EVENT_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'visit', label: 'Visits' },
  { value: 'soap', label: 'Notes' },
  { value: 'lab_resulted', label: 'Results' },
  { value: 'lab_ordered', label: 'Labs' },
  { value: 'prescription', label: 'Rx' },
  { value: 'treatment_plan', label: 'Plans' },
  { value: 'admission', label: 'Admissions' },
];

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

const formatDateTime = (value?: string) => {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const sameId = (a: any, b: any) => String(a?._id || a || '') === String(b?._id || b || '');

function SoapFlow({ notes }: { notes: any[] }) {
  if (!notes.length) {
    return <p className="text-sm text-muted-foreground">No SOAP notes recorded for this timeline item.</p>;
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note._id || note.createdAt} className="rounded-lg border bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SOAP note</p>
            <Badge variant={note.isSigned ? 'default' : 'outline'} className="text-[10px]">
              {note.isSigned ? 'Signed' : 'Draft'}
            </Badge>
          </div>
          <div className="grid gap-2 text-sm">
            {[
              ['Subjective', note.historyPresentIllness || note.subjective],
              ['Objective', note.physicalExamination || note.objective],
              ['Assessment', note.diagnosis || note.assessment],
              ['Plan', note.treatmentPlan || note.plan],
            ].map(([label, value]) => (
              value ? (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="whitespace-pre-wrap text-slate-900">{value}</p>
                </div>
              ) : null
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{formatDateTime(note.signedAt || note.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

function TimelineDetailDialog({ event, open, onOpenChange }: { event: TimelineEvent | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!event) return null;
  const Icon = event.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', event.bgColor)}>
              <Icon className={cn('h-4 w-4', event.color)} />
            </span>
            {event.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('border text-[10px]', event.bgColor, event.borderColor, event.color)}>
              {EVENT_LABELS[event.type] || event.type}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(event.date)}</span>
          </div>
          {event.summary && <p className="text-sm text-slate-700">{event.summary}</p>}
          {event.sections?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {event.sections.filter((section) => section.value).map((section) => (
                <div key={section.label} className="rounded-lg border bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{section.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-950">{section.value}</p>
                </div>
              ))}
            </div>
          ) : event.detail ? (
            <p className="whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-sm text-slate-900">{event.detail}</p>
          ) : null}

          {(event.relatedSoap?.length || event.type === 'soap') && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 text-sm font-semibold">SOAP flow</h4>
                <SoapFlow notes={event.type === 'soap' ? [{ _id: event.id, createdAt: event.date, isSigned: event.title.includes('signed'), historyPresentIllness: event.sections?.find(s => s.label === 'Subjective')?.value, physicalExamination: event.sections?.find(s => s.label === 'Objective')?.value, diagnosis: event.sections?.find(s => s.label === 'Assessment')?.value, treatmentPlan: event.sections?.find(s => s.label === 'Plan')?.value }] : event.relatedSoap || []} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const { data: treatmentPlans = [] } = useQuery({
    queryKey: ['treatment-plans', 'patient', patientId],
    queryFn: () => treatmentPlanService.getForPatient(patientId),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });

  const events = useMemo<TimelineEvent[]>(() => {
    const result: TimelineEvent[] = [];

    // Visits
    const soapNotes = patientChart?.soapNotes || [];
    if (patientVisits) {
      for (const v of patientVisits) {
        const cfg = EVENT_CONFIG.visit;
        const visitSoapNotes = soapNotes.filter((note: any) => sameId(note.visitId, v._id || v.id));
        result.push({
          id: `visit-${v._id}`,
          type: 'visit',
          date: v.createdAt,
          ...cfg,
          title: `Visit #${v.visitNumber || v._id?.slice(-6)}`,
          summary: v.chiefComplaint || v.status?.replace(/_/g, ' ') || 'Visit created',
          sections: [
            { label: 'Status', value: v.status?.replace(/_/g, ' ') },
            { label: 'Chief complaint', value: v.chiefComplaint },
            { label: 'Diagnosis', value: v.diagnosis },
            { label: 'Room', value: v.room },
          ],
          detail: [
            `Status: ${v.status?.replace(/_/g, ' ')}`,
            v.chiefComplaint ? `CC: ${v.chiefComplaint}` : '',
            v.diagnosis ? `Dx: ${v.diagnosis}` : '',
            v.room ? `Room: ${v.room}` : '',
          ].filter(Boolean).join('\n'),
          relatedSoap: visitSoapNotes,
        });
      }
    }

    // SOAP notes from patient chart
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
        sections: [
          { label: 'Subjective', value: note.historyPresentIllness },
          { label: 'Objective', value: note.physicalExamination },
          { label: 'Assessment', value: note.diagnosis },
          { label: 'Plan', value: note.treatmentPlan },
        ],
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

    // Treatment plans
    for (const plan of treatmentPlans) {
      const cfg = EVENT_CONFIG.treatment_plan;
      result.push({
        id: `tp-${plan._id}`,
        type: 'treatment_plan',
        date: plan.createdAt,
        ...cfg,
        title: `Treatment Plan ${plan.planNumber}`,
        summary: `${plan.createdByName} (${plan.createdByRole}) · ${plan.status.replace(/_/g, ' ')} · ${(plan.items || []).length} item(s)`,
        detail: (plan.items || []).map((i: any) => `${i.description} — Le ${i.amount?.toLocaleString()}`).join('\n') || 'No items',
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
  }, [patientChart, patientVisits, patientOrders, patientPrescriptions, treatmentPlans, onNavigate]);

  const visibleEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    return events.filter((event) => event.type === activeFilter);
  }, [events, activeFilter]);

  const grouped = useMemo(() => groupByDate(visibleEvents), [visibleEvents]);
  const eventCounts = useMemo(() => {
    return events.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
  }, [events]);

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
  const latestEvent = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/70">
      <div className="border-b bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950">Patient timeline</h3>
              <Badge variant="outline" className="bg-slate-50 text-[10px]">{events.length} events</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Full chart activity across visits, orders, results, prescriptions, admissions, and treatment plans.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right sm:min-w-[360px]">
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Visits</p>
              <p className="text-lg font-bold text-slate-950">{eventCounts.visit || 0}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Results</p>
              <p className="text-lg font-bold text-slate-950">{eventCounts.lab_resulted || 0}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Latest</p>
              <p className="truncate text-xs font-semibold text-slate-950">{latestEvent ? EVENT_LABELS[latestEvent.type] || latestEvent.type : '-'}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {EVENT_FILTERS.map((filter) => {
            const count = filter.value === 'all' ? events.length : eventCounts[filter.value] || 0;
            return (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={activeFilter === filter.value ? 'default' : 'outline'}
                className={cn('h-8 shrink-0 rounded-full px-3 text-xs', activeFilter === filter.value && 'bg-slate-900 text-white hover:bg-slate-800')}
                onClick={() => setActiveFilter(filter.value)}
                disabled={count === 0}
              >
                {filter.label}
                <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]', activeFilter === filter.value ? 'bg-white/15' : 'bg-slate-100 text-slate-600')}>{count}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          No events match this timeline filter.
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
            {sortedDates.map((dateLabel) => (
              <div key={dateLabel} className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
                <div className="md:pt-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{dateLabel}</h3>
                  <p className="mt-1 text-[10px] text-muted-foreground">{grouped[dateLabel].length} event{grouped[dateLabel].length !== 1 ? 's' : ''}</p>
                </div>
                <div className="relative space-y-3 border-l-2 border-slate-200 pl-5">
                  {grouped[dateLabel]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((event) => {
                      const Icon = event.icon;
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            'relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300',
                            'cursor-pointer hover:shadow-md'
                          )}
                          onClick={() => event.onClick ? event.onClick() : setSelectedEvent(event)}
                        >
                          <span className={cn('absolute -left-[31px] top-4 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-sm', event.bgColor)}>
                            <Icon className={cn('h-3.5 w-3.5', event.color)} />
                          </span>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn('border text-[10px]', event.bgColor, event.borderColor, event.color)}>
                                  {EVENT_LABELS[event.type] || event.type}
                                </Badge>
                                <p className="truncate text-sm font-semibold text-slate-950">{event.title}</p>
                              </div>
                              {event.type === 'soap' ? (
                                <div className="mt-1"><SoapCompact event={event} /></div>
                              ) : (
                                event.summary && <p className="mt-1 text-xs text-muted-foreground">{event.summary}</p>
                              )}
                            </div>
                            <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {event.detail && event.type !== 'soap' && (
                            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">{event.detail}</p>
                          )}
                          <button
                            type="button"
                            className="mt-2 block text-[10px] font-semibold text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (event.onClick) event.onClick();
                              else setSelectedEvent(event);
                            }}
                          >
                            {event.onClick ? 'Open related results' : 'Open timeline detail'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      <TimelineDetailDialog event={selectedEvent} open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)} />
    </div>
  );
}
