import { useState } from 'react';
import { ChevronLeft, ChevronRight, Activity, Edit3, Check, AlertTriangle, Pill, FlaskConical, ClipboardList, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface VisitContextDrawerProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  vitalsForm: any;
  setVitalsForm: (form: any) => void;
  vitalsErrors: Record<string, string>;
  selectedVisit?: any;
  isReadOnly?: boolean;
  canWriteConsultation?: boolean;
  triageOverride: string;
  setTriageOverride: (val: string) => void;
  currentVisitOrders: any[];
  currentVisitPlans: any[];
  currentVisitPrescriptions?: any[];
  onStartEditOrder?: (order: any) => void;
  onStartEditPrescription?: (rx: any) => void;
}

export function VisitContextDrawer({
  collapsed,
  onToggleCollapse,
  vitalsForm,
  setVitalsForm,
  vitalsErrors,
  selectedVisit,
  isReadOnly,
  canWriteConsultation,
  triageOverride,
  setTriageOverride,
  currentVisitOrders = [],
  currentVisitPlans = [],
  currentVisitPrescriptions = [],
  onStartEditOrder,
  onStartEditPrescription,
}: VisitContextDrawerProps) {
  const [editingVitals, setEditingVitals] = useState(false);

  if (collapsed) {
    return (
      <aside className="shrink-0 w-10 border-l border-slate-200 bg-white flex flex-col items-center py-3 gap-4 select-none">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
          title="Expand Visit Context Drawer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="writing-vertical text-[11px] font-medium text-slate-400 tracking-wider rotate-180 uppercase">
          Visit Context
        </div>
      </aside>
    );
  }

  const tempNum = Number(vitalsForm.temperature || selectedVisit?.temperature || 0);
  const isFever = tempNum >= 38.0;

  const vitalsList = [
    { key: 'temperature', label: 'Temp', value: vitalsForm.temperature || selectedVisit?.temperature || '—', unit: '°C', alert: isFever },
    { key: 'bloodPressure', label: 'BP', value: vitalsForm.bloodPressure || selectedVisit?.bloodPressure || '—', unit: 'mmHg' },
    { key: 'heartRate', label: 'HR', value: vitalsForm.heartRate || selectedVisit?.heartRate || '—', unit: 'bpm' },
    { key: 'respiratoryRate', label: 'RR', value: vitalsForm.respiratoryRate || selectedVisit?.respiratoryRate || '—', unit: '/min' },
    { key: 'oxygenSaturation', label: 'SpO2', value: vitalsForm.oxygenSaturation || selectedVisit?.oxygenSaturation || '—', unit: '%' },
    { key: 'weight', label: 'Weight', value: vitalsForm.weight || selectedVisit?.weight || '—', unit: 'kg' },
  ];

  const orderPaymentTone = (status?: string) => {
    switch (status) {
      case 'paid': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'unpaid': return 'border-red-200 bg-red-50 text-red-700';
      case 'partial': return 'border-amber-200 bg-amber-50 text-amber-700';
      default: return 'border-slate-200 bg-slate-100 text-slate-700';
    }
  };

  return (
    <aside className="w-80 shrink-0 border-l border-slate-200 bg-slate-50/50 flex flex-col h-full overflow-hidden select-none">
      {/* Drawer Header */}
      <div className="shrink-0 h-11 px-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-teal-600" />
          Visit Context
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
          title="Collapse Drawer"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Triage Alert Banner if any */}
        {selectedVisit?.triageAlert && (
          <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs">
            <span className="font-semibold block mb-0.5">Triage Alert:</span>
            {selectedVisit.triageAlert}
          </div>
        )}

        {/* Vitals Summary Card */}
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-900">Vitals</span>
            {!isReadOnly && canWriteConsultation && (
              <button
                type="button"
                onClick={() => setEditingVitals((e) => !e)}
                className="text-[11px] font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="h-3 w-3" />
                {editingVitals ? 'Done' : 'Edit'}
              </button>
            )}
          </div>

          {editingVitals ? (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'temperature', label: 'Temp (°C)', placeholder: '36.5', type: 'number' },
                  { key: 'bloodPressure', label: 'BP (mmHg)', placeholder: '120/80', type: 'text' },
                  { key: 'heartRate', label: 'HR (bpm)', placeholder: '72', type: 'number' },
                  { key: 'respiratoryRate', label: 'RR (/min)', placeholder: '16', type: 'number' },
                  { key: 'oxygenSaturation', label: 'SpO2 (%)', placeholder: '98', type: 'number' },
                  { key: 'weight', label: 'Weight (kg)', placeholder: '70', type: 'number' },
                ].map((field) => (
                  <div key={field.key}>
                    <Label className="text-[10px] text-slate-500">{field.label}</Label>
                    <Input
                      type={field.type}
                      value={(vitalsForm as any)[field.key] || ''}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className={cn(
                        "mt-0.5 h-7 text-xs bg-slate-50",
                        vitalsErrors[field.key] && "border-red-400"
                      )}
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">Triage Priority Override</Label>
                <Select
                  value={triageOverride || selectedVisit?.triagePriority || ''}
                  onValueChange={setTriageOverride}
                >
                  <SelectTrigger className="mt-0.5 h-7 text-xs bg-slate-50">
                    <SelectValue placeholder="Set priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="esi_1_emergency">ESI 1 - Emergency (Immediate)</SelectItem>
                    <SelectItem value="esi_2_urgent">ESI 2 - Urgent</SelectItem>
                    <SelectItem value="esi_3_urgent">ESI 3 - Semi-urgent</SelectItem>
                    <SelectItem value="esi_4_less_urgent">ESI 4 - Less Urgent</SelectItem>
                    <SelectItem value="esi_5_non_urgent">ESI 5 - Non-urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {vitalsList.map((v) => (
                <div key={v.key} className="bg-slate-50 rounded-md p-1.5 text-center">
                  <span className="block text-[10px] text-slate-400 font-medium">{v.label}</span>
                  <span className={cn("block text-xs font-semibold mt-0.5", v.alert ? "text-red-600" : "text-slate-900")}>
                    {v.value}
                  </span>
                  <span className="block text-[9px] text-slate-400">{v.unit}</span>
                </div>
              ))}
            </div>
          )}

          {selectedVisit?.triageNotes && !editingVitals && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
              <span className="font-medium text-slate-700">Triage Note:</span> {selectedVisit.triageNotes}
            </div>
          )}
        </div>

        {/* Live Orders in this Visit Ledger */}
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">Orders in this Visit</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {currentVisitOrders.length + currentVisitPlans.length} items
            </span>
          </div>

          {currentVisitOrders.length === 0 && currentVisitPlans.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-3">
              No orders placed in this encounter yet. Use the top bar to prescribe or order tests.
            </p>
          ) : (
            <div className="space-y-1.5">
              {/* Lab & Clinical Orders */}
              {currentVisitOrders.map((order: any) => {
                const orderType = order.orderType || order.order_type;
                const testsCount = (order.tests || order.orderTests || []).length;
                const isPaid = (order.paymentStatus || order.payment_status) === 'paid';
                return (
                  <div
                    key={order._id || order.id}
                    className="p-2 rounded-md border border-slate-100 bg-slate-50/70 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-1.5">
                      <FlaskConical className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {orderType === 'lab' ? 'Lab Request' : 'Order'} ({testsCount} test{testsCount !== 1 ? 's' : ''})
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Le {order.totalAmount?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[9px] h-4.5 px-1.5 capitalize shrink-0 font-medium", orderPaymentTone(order.paymentStatus || order.payment_status))}>
                      {order.paymentStatus || order.payment_status || 'unpaid'}
                    </Badge>
                  </div>
                );
              })}

              {/* Treatment Plans */}
              {currentVisitPlans.map((plan: any) => (
                <div
                  key={plan._id || plan.id}
                  className="p-2 rounded-md border border-slate-100 bg-purple-50/50 text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {plan.planNumber} ({(plan.items || []).length} items)
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Le {plan.totalAmount?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 capitalize shrink-0 font-medium bg-white text-purple-700 border-purple-200">
                    {plan.status?.replace('_', ' ') || 'draft'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
