import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { visitsAPI, ordersAPI, doctorsAPI, admissionsAPI } from '@/services/api';
import { medicationService } from '@/services/medicationService';
import { prescriptionService } from '@/services/prescriptionService';
import { soapNoteService } from '@/services/soapNoteService';
import { patientService } from '@/services/patientService';
import { SoapNoteTypeEnum } from '@/types/soap-note';
import { useDoctorDashboard, useAcceptPatient, useUpdateVisit, useCompleteVisit, usePatientVisits, useReferToSpecialist } from '@/hooks/useVisits';
import { useResults } from '@/hooks/useResults';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  Loader2, Clock, CheckCircle, User, Stethoscope, FlaskConical, Pill,
  AlertTriangle, ArrowUp, ArrowDown, Search, Plus, Trash2, Save,
  Send, Heart, ClipboardList, UserCheck, BedDouble, ExternalLink, Activity,
  Pencil, ChevronRight, X, Check, AlertOctagon, Hourglass, PlusCircle, FileText, Hospital, FlaskRound, Stethoscope as StethoscopeIcon, BarChart3, Pill as PillIcon
} from 'lucide-react';

interface Visit {
  _id: string;
  id?: string;
  visitNumber: string;
  patientId: any;
  doctorId?: any;
  status: string;
  visitType: string;
  consultationFee: number;
  chiefComplaint?: string;
  notes?: string;
  temperature?: number;
  bloodPressure?: string;
  heartRate?: number;
  respiratoryRate?: number;
  weight?: number;
  height?: number;
  oxygenSaturation?: number;
  triagePriority?: string;
  triageNotes?: string;
  triagedAt?: string;
  room?: string;
  roomType?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessmentNotes?: string;
  planNotes?: string;
  diagnosis?: string;
  consultationOrderId?: string;
  orders?: { _id: string; orderType: string }[];
  createdAt: string;
  consultationStartedAt?: string;
}

interface LabResult {
  _id: string;
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  reference_range?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
  status: string;
  resulted_at?: string;
  createdAt: string;
}

interface Test {
  _id: string;
  code: string;
  name: string;
  price: number;
  category?: string;
  sampleType?: string;
  turnaroundTime?: number;
  isPanel?: boolean;
  panelComponents?: Array<{ testCode: string; testName: string }>;
}

interface Medication {
  _id: string;
  medicationCode: string;
  name: string;
  genericName: string;
  dosageForm?: string;
  strength?: string;
  unitPrice?: number;
  stockQuantity?: number;
  unit?: string;
  category?: string;
  isActive?: boolean;
  __cafProduct?: boolean;
  __cafBranchId?: string;
  packSizes?: Array<{ name: string; unit: string; quantityPerPack: number; sellingPrice: number }>;
}

const getFlagColor = (flag?: string) => {
  if (!flag || flag === 'normal') return 'text-green-700 bg-green-50 border-green-200';
  if (flag === 'low') return 'text-blue-700 bg-blue-50 border-blue-200';
  if (flag === 'high') return 'text-amber-700 bg-amber-50 border-amber-200';
  if (flag === 'critical_low' || flag === 'critical_high') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-gray-700 bg-gray-50 border-gray-200';
};

const getFlagLabel = (flag?: string) => {
  if (!flag || flag === 'normal') return 'Normal';
  if (flag === 'low') return 'Low';
  if (flag === 'high') return 'High';
  if (flag === 'critical_low') return 'Critical Low';
  if (flag === 'critical_high') return 'Critical High';
  return 'N/A';
};

const patientDisplayName = (visit?: Visit | null) => {
  const patient = visit?.patientId;
  const name = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Unnamed patient';
};

const patientInitials = (visit?: Visit | null) => {
  const p = visit?.patientId;
  const f = (p?.firstName || '').trim();
  const l = (p?.lastName || '').trim();
  return `${f[0] || ''}${l[0] || ''}`.toUpperCase() || '?';
};

const patientAgeLabel = (patient: any) => {
  if (patient?.age) return `${patient.age} yrs`;
  if (!patient?.dateOfBirth) return 'Age N/A';
  const birthDate = new Date(patient.dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return 'Age N/A';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return `${age} yrs`;
};

const statusLabel = (status?: string) => status?.replace(/_/g, ' ') || 'not set';

const triageColor = (priority?: string) => {
  const p = (priority || '').toLowerCase();
  if (p.includes('1') || p.includes('resus') || p.includes('emergency')) return { dot: 'bg-red-500', text: 'text-red-700', label: 'Resuscitation' };
  if (p.includes('2') || p.includes('urgent')) return { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Urgent' };
  if (p.includes('3')) return { dot: 'bg-yellow-500', text: 'text-yellow-700', label: 'Less Urgent' };
  if (p.includes('4') || p.includes('5') || p.includes('non')) return { dot: 'bg-green-500', text: 'text-green-700', label: 'Non-Urgent' };
  return { dot: 'bg-gray-400', text: 'text-gray-600', label: 'Not triaged' };
};

const queueBorderColor = (status?: string) => {
  if (status === 'in_consultation') return 'border-l-amber-500';
  if (status === 'in_queue' || status === 'awaiting_triage') return 'border-l-red-500';
  if (status === 'awaiting_doctor') return 'border-l-red-500';
  return 'border-l-gray-300';
};

const waitTimeLabel = (createdAt: string) => {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
};

const visitStatusTone = (status?: string) => cn(
  status === 'in_consultation' && 'bg-blue-500 text-white',
  status === 'results_ready' && 'bg-green-500 text-white',
  status === 'awaiting_lab' && 'bg-amber-500 text-white',
  status === 'awaiting_pharmacy' && 'bg-purple-500 text-white',
  status === 'awaiting_results' && 'bg-orange-500 text-white',
  status === 'awaiting_dispensing' && 'bg-fuchsia-500 text-white',
  status === 'awaiting_doctor_review' && 'bg-cyan-600 text-white',
  status === 'admitted' && 'bg-blue-600 text-white',
);

interface ConsultSectionProps {
  selectedVisit: Visit;
  vitalsForm: any;
  setVitalsForm: (v: any) => void;
  soapForm: any;
  setSoapForm: (v: any) => void;
  selectedDiagnoses: string[];
  toggleDiagnosis: (dx: string) => void;
  canContinueClinicalWork: boolean;
  currentVisitOrders: any[];
  setEditingOrder: (v: any) => void;
  setSelectedTests: (v: any) => void;
  setLabOrderModalOpen: (v: boolean) => void;
  setEditingPrescription: (v: any) => void;
  setPrescriptionItems: (v: any) => void;
  setPrescriptionModalOpen: (v: boolean) => void;
  setReferralOpen: (v: boolean) => void;
  startEditOrder: (order: any) => void;
  startEditPrescription: (rx: any) => void;
  labResults: LabResult[];
  patientVisits: Visit[];
  navigate: any;
  waitTimeLabel: (date: string) => string;
  patientDisplayName: (v: Visit | null) => string;
  statusLabel: (s?: string) => string;
  getFlagColor: (flag?: string) => string;
  cn: (...args: any[]) => string;
}

function ConsultSection({
  selectedVisit, vitalsForm, setVitalsForm, soapForm, setSoapForm,
  selectedDiagnoses, toggleDiagnosis, canContinueClinicalWork, currentVisitOrders,
  setEditingOrder, setSelectedTests, setLabOrderModalOpen,
  setEditingPrescription, setPrescriptionItems, setPrescriptionModalOpen, setReferralOpen,
  startEditOrder, startEditPrescription, labResults, patientVisits, navigate,
  waitTimeLabel, patientDisplayName, statusLabel, getFlagColor, cn,
}: ConsultSectionProps) {
  const tempVal = parseFloat(vitalsForm.temperature);
  const tempHigh = !isNaN(tempVal) && tempVal >= 38;
  return (
    <>
      {/* SOAP Editor - Left 2/3 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Subjective */}
        <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden flex flex-col">
          <div className="bg-[#f1f4fa] px-4 py-2.5 border-b border-[#dfe3e8] flex justify-between items-center">
            <h3 className="text-[14px] font-bold text-[#181c20] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#006194]" />
              Subjective
            </h3>
            <button className="text-[12px] font-medium text-[#006194] hover:bg-[#cce5ff] px-2 py-1 rounded transition-colors">
              Use Template
            </button>
          </div>
          <div className="p-4">
            <Textarea
              value={soapForm.subjective}
              onChange={(e) => setSoapForm({ ...soapForm, subjective: e.target.value })}
              placeholder="Patient reports…"
              rows={3}
              className="w-full text-[13px] border-[#dfe3e8] focus:border-[#006194] focus:ring-1 focus:ring-[#006194] resize-none"
            />
          </div>
        </div>

        {/* Objective + Assessment Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Objective */}
          <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden flex flex-col">
            <div className="bg-[#f1f4fa] px-4 py-2.5 border-b border-[#dfe3e8] flex justify-between items-center">
              <h3 className="text-[14px] font-bold text-[#181c20] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#006194]" />
                Objective
              </h3>
              <span className="text-[11px] text-[#707881]">Updated {selectedVisit.triagedAt ? waitTimeLabel(selectedVisit.triagedAt) : 'now'} ago</span>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className={cn("p-2 border rounded flex justify-between items-center", tempHigh ? "border-[#ba1a1a]/30 bg-[#ffdad6]/20" : "border-[#dfe3e8] bg-white")}>
                  <span className="text-[11px] text-[#3f4850]">Temp</span>
                  <span className={cn("text-[12px] font-mono font-bold flex items-center gap-1", tempHigh ? "text-[#ba1a1a]" : "text-[#181c20]")}>
                    {vitalsForm.temperature || '—'}°C
                    {tempHigh && <ArrowUp className="w-3 h-3" />}
                  </span>
                </div>
                <div className="p-2 border border-[#dfe3e8] bg-white rounded flex justify-between items-center">
                  <span className="text-[11px] text-[#3f4850]">BP</span>
                  <span className="text-[12px] font-mono font-bold text-[#181c20]">{vitalsForm.bloodPressure || '—'}</span>
                </div>
                <div className="p-2 border border-[#dfe3e8] bg-white rounded flex justify-between items-center">
                  <span className="text-[11px] text-[#3f4850]">HR</span>
                  <span className="text-[12px] font-mono font-bold text-[#181c20]">{vitalsForm.heartRate ? `${vitalsForm.heartRate} bpm` : '—'}</span>
                </div>
                <div className="p-2 border border-[#dfe3e8] bg-white rounded flex justify-between items-center">
                  <span className="text-[11px] text-[#3f4850]">SpO2</span>
                  <span className="text-[12px] font-mono font-bold text-[#181c20]">{vitalsForm.oxygenSaturation ? `${vitalsForm.oxygenSaturation}%` : '—'}</span>
                </div>
              </div>
              <Textarea
                value={soapForm.objective}
                onChange={(e) => setSoapForm({ ...soapForm, objective: e.target.value })}
                placeholder="Physical exam notes…"
                rows={2}
                className="w-full text-[13px] border-[#dfe3e8] focus:border-[#006194] focus:ring-1 focus:ring-[#006194] resize-none mt-1"
              />
            </div>
          </div>

          {/* Assessment */}
          <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden flex flex-col">
            <div className="bg-[#f1f4fa] px-4 py-2.5 border-b border-[#dfe3e8] flex justify-between items-center">
              <h3 className="text-[14px] font-bold text-[#181c20] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#006194]" />
                Assessment
              </h3>
            </div>
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707881]" />
                <Input
                  value={soapForm.assessment}
                  onChange={(e) => setSoapForm({ ...soapForm, assessment: e.target.value })}
                  placeholder="Search ICD-10…"
                  className="pl-8 h-9 text-[13px] border-[#dfe3e8] focus:border-[#006194] focus:ring-1 focus:ring-[#006194]"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Malaria, Unspecified', 'Typhoid Fever', 'URTI', 'Hypertension'].map((dx) => {
                  const isSel = selectedDiagnoses.includes(dx) || soapForm.diagnosis?.includes(dx);
                  return (
                    <button
                      key={dx}
                      onClick={() => {
                        setSoapForm({ ...soapForm, diagnosis: soapForm.diagnosis ? `${soapForm.diagnosis}, ${dx}` : dx });
                        toggleDiagnosis(dx);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[12px] font-medium flex items-center gap-1 border transition-colors",
                        isSel
                          ? "border-[#006194] bg-[#cce5ff] text-[#004b73] font-bold"
                          : "border-[#dfe3e8] bg-[#ebeef4] text-[#181c20] hover:bg-[#dfe3e8]"
                      )}
                    >
                      {dx}
                      {isSel ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden flex flex-col flex-1">
          <div className="bg-gradient-to-r from-[#006194] to-[#007bb9] px-4 py-3 border-b border-[#dfe3e8] flex justify-between items-center">
            <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Plan & Orders
            </h3>
            <span className="text-[10px] text-white/80 font-medium uppercase tracking-wider">Clinical Actions</span>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); }}
                disabled={!canContinueClinicalWork}
                className="group h-auto py-3 px-2 bg-[#894d00]/5 border border-[#894d00]/20 rounded-xl flex flex-col items-center gap-1.5 hover:bg-[#894d00]/10 hover:border-[#894d00]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg bg-[#894d00] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FlaskConical className="w-4 h-4 text-white" />
                </div>
                <span className="text-[12px] font-semibold text-[#181c20]">Order Labs</span>
                <span className="text-[10px] text-[#707881]">Diagnostic tests</span>
              </button>
              <button
                type="button"
                onClick={() => { setEditingPrescription(null); setPrescriptionItems([]); setPrescriptionModalOpen(true); }}
                disabled={!canContinueClinicalWork}
                className="group h-auto py-3 px-2 bg-[#006194]/5 border border-[#006194]/20 rounded-xl flex flex-col items-center gap-1.5 hover:bg-[#006194]/10 hover:border-[#006194]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg bg-[#006194] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Pill className="w-4 h-4 text-white" />
                </div>
                <span className="text-[12px] font-semibold text-[#181c20]">Prescribe</span>
                <span className="text-[10px] text-[#707881]">Medications</span>
              </button>
              <button
                type="button"
                onClick={() => setReferralOpen(true)}
                disabled={!canContinueClinicalWork}
                className="group h-auto py-3 px-2 bg-[#0d9488]/5 border border-[#0d9488]/20 rounded-xl flex flex-col items-center gap-1.5 hover:bg-[#0d9488]/10 hover:border-[#0d9488]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg bg-[#0d9488] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <span className="text-[12px] font-semibold text-[#181c20]">Refer</span>
                <span className="text-[10px] text-[#707881]">Specialist / ward</span>
              </button>
            </div>
            <Textarea
              value={soapForm.plan}
              onChange={(e) => setSoapForm({ ...soapForm, plan: e.target.value })}
              placeholder="Treatment plan, follow-up, patient education…"
              rows={3}
              className="w-full text-[13px] border-[#dfe3e8] focus:border-[#006194] focus:ring-1 focus:ring-[#006194] resize-none"
            />
            {currentVisitOrders.length > 0 && (
              <div className="border border-dashed border-[#dfe3e8] rounded-lg p-3 bg-[#f7f9ff]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#707881] mb-2">Pending Orders</p>
                <div className="space-y-1.5">
                  {currentVisitOrders.slice(0, 4).map((order: any) => {
                    const orderTests = order.order_tests || order.tests || [];
                    const orderType = order.orderType || order.order_type;
                    return orderTests.map((test: any, idx: number) => (
                      <div key={`${order._id}-${idx}`} className="flex items-center justify-between p-2 bg-white border border-[#dfe3e8] rounded text-[12px]">
                        <div className="flex items-center gap-2 min-w-0">
                          {orderType === 'lab' ? <FlaskConical className="w-3.5 h-3.5 text-[#894d00] shrink-0" /> : <Pill className="w-3.5 h-3.5 text-[#006194] shrink-0" />}
                          <span className="font-medium truncate">{test.testName || test.medicationName || 'Order item'}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{statusLabel(order.status)}</Badge>
                      </div>
                    ));
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - 1/3 */}
      <div className="w-[300px] flex flex-col gap-4 shrink-0">
        {labResults.length > 0 && (
          <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden flex flex-col">
            <div className="bg-[#f1f4fa] px-4 py-2.5 border-b border-[#dfe3e8] flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#707881] flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" />
                Lab Snapshot
              </h4>
              <button onClick={() => navigate(`/lab/reports/${selectedVisit._id || selectedVisit.id}`)} className="text-[11px] text-[#006194] font-medium hover:underline">
                View all
              </button>
            </div>
            <div className="p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
              {labResults.slice(0, 4).map((r: LabResult) => (
                <div key={r._id} className="flex items-center justify-between text-[12px]">
                  <span className="truncate flex-1">{r.testName}</span>
                  <span className={cn("font-mono font-bold px-1.5 py-0.5 rounded border", getFlagColor(r.flag))}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-[#dfe3e8] rounded-xl p-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#707881] mb-2">AI Protocol Suggestions</h4>
          <div className="bg-[#dae2fd]/30 border border-[#565e74]/20 rounded-lg p-3 hover:bg-[#dae2fd]/50 transition-colors cursor-pointer">
            <div className="flex items-start justify-between">
              <span className="text-[12px] font-bold text-[#181c20]">Standard Malaria Protocol</span>
              <span className="text-[#565e74]">⚡</span>
            </div>
            <p className="text-[11px] text-[#3f4850] mt-1 leading-snug">
              Includes RDT, FBC, and Artemisinin-based Combination Therapy if positive.
            </p>
            <button className="mt-2 text-[11px] font-bold text-[#006194] hover:underline">
              Apply Protocol
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#dfe3e8] rounded-xl flex flex-col flex-1 overflow-hidden">
          <div className="bg-[#f1f4fa] px-4 py-2.5 border-b border-[#dfe3e8]">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#707881]">Recent Encounters</h4>
          </div>
          <div className="flex-1 overflow-y-auto">
            {patientVisits.filter((v: Visit) => v._id !== selectedVisit._id).length === 0 ? (
              <p className="text-[12px] text-[#707881] text-center py-6">No prior visits</p>
            ) : (
              patientVisits
                .filter((v: Visit) => v._id !== selectedVisit._id)
                .slice(0, 6)
                .map((visit: Visit) => (
                  <div key={visit._id} className="p-3 border-b border-[#dfe3e8] hover:bg-[#f1f4fa] cursor-pointer transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12px] font-semibold">{new Date(visit.createdAt).toLocaleDateString()}</span>
                      <span className="text-[10px] text-[#707881] font-mono">{visit.doctorId?.fullName?.split(' ')[1] || 'Dr.'}</span>
                    </div>
                    <p className="text-[11px] text-[#3f4850] truncate">{visit.diagnosis || visit.chiefComplaint || 'Visit'}</p>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

interface HistorySectionProps {
  patientVisits: Visit[];
  selectedVisit: Visit;
  patientChart: any;
  chartLoading: boolean;
  historyTab: string;
  setHistoryTab: (s: string) => void;
  patientDisplayName: (v: Visit | null) => string;
  statusLabel: (s?: string) => string;
  cn: (...args: any[]) => string;
}

function HistorySection({ patientVisits, selectedVisit, patientChart, chartLoading, historyTab, setHistoryTab, statusLabel, cn }: HistorySectionProps) {
  const tabs = [
    { id: 'visits', label: 'Visits' },
    { id: 'soap', label: 'SOAP Notes' },
    { id: 'labs', label: 'Labs' },
    { id: 'meds', label: 'Medications' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'vitals', label: 'Vitals' },
  ];

  const getCount = (id: string) => {
    switch (id) {
      case 'visits': return patientVisits.filter((v: Visit) => v._id !== selectedVisit._id).length;
      case 'soap': return (patientChart?.soapNotes || []).length;
      case 'labs': return (patientChart?.orders || []).filter((o: any) => (o.orderType || o.order_type) === 'lab').length;
      case 'meds': return (patientChart?.prescriptions || []).length;
      case 'admissions': return (patientChart?.admissions || []).length;
      case 'vitals': return (patientChart?.vitalsHistory || []).length;
      default: return 0;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-white border border-[#dfe3e8] rounded-t-xl px-5 py-3 flex items-center justify-between border-b">
        <div>
          <h2 className="text-[16px] font-bold text-[#181c20]">Patient History</h2>
          <p className="text-[12px] text-[#3f4850] mt-0.5">Longitudinal record. Pick a section to view details.</p>
        </div>
        {chartLoading && <Loader2 className="w-4 h-4 animate-spin text-[#707881]" />}
      </div>
      <div className="bg-white border-l border-r border-[#dfe3e8] px-5 flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const count = getCount(t.id);
          return (
            <button
              key={t.id}
              onClick={() => setHistoryTab(t.id)}
              className={cn(
                "px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
                historyTab === t.id
                  ? "text-[#006194] border-[#006194]"
                  : "text-[#3f4850] border-transparent hover:text-[#181c20]"
              )}
            >
              {t.label}
              {count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                  historyTab === t.id ? "bg-[#006194] text-white" : "bg-[#ebeef4] text-[#3f4850]"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1 bg-white border border-t-0 border-[#dfe3e8] rounded-b-xl p-5 overflow-y-auto">
        {historyTab === 'visits' && (
          patientVisits.filter((v: Visit) => v._id !== selectedVisit._id).length === 0 ? (
            <EmptyHistoryState label="No previous visits" sublabel="This is the patient's first visit to the clinic." />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[#dfe3e8]" />
              {patientVisits.filter((v: Visit) => v._id !== selectedVisit._id).map((visit: Visit, idx: number) => (
                <div key={visit._id} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[18px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#006194] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#006194]" />
                  </div>
                  <div className="bg-gradient-to-br from-white to-[#f7f9ff] border border-[#dfe3e8] rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[13px] font-bold text-[#181c20]">{visit.visitNumber}</p>
                        <p className="text-[11px] text-[#707881] mt-0.5">
                          {new Date(visit.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {visit.visitType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">{statusLabel(visit.status)}</Badge>
                    </div>
                    {visit.chiefComplaint && (
                      <div className="mt-2 text-[12px] bg-white border-l-2 border-[#006194] pl-3 py-1">
                        <span className="font-semibold text-[#006194]">CC:</span> {visit.chiefComplaint}
                      </div>
                    )}
                    {visit.diagnosis && (
                      <div className="mt-1.5 text-[12px] bg-white border-l-2 border-[#565e74] pl-3 py-1">
                        <span className="font-semibold text-[#565e74]">Dx:</span> {visit.diagnosis}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {historyTab === 'soap' && (
          (patientChart?.soapNotes || []).length === 0 ? (
            <EmptyHistoryState label="No SOAP notes" sublabel="Clinical notes will appear here once signed." />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[#dfe3e8]" />
              {patientChart.soapNotes.map((note: any) => (
                <div key={note._id} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[18px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#0d9488] flex items-center justify-center">
                    <FileText className="w-2 h-2 text-[#0d9488]" />
                  </div>
                  <div className="bg-gradient-to-br from-white to-[#f7f9ff] border border-[#dfe3e8] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[13px] font-bold text-[#181c20] capitalize">{note.noteType?.replace(/_/g, ' ') || 'Clinical note'}</p>
                        <p className="text-[11px] text-[#707881] mt-0.5">{note.doctorId?.fullName || note.nurseId?.fullName || 'Clinical staff'} • {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      {note.isSigned ? <Badge className="text-[10px] bg-[#0d9488]">Signed</Badge> : <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                      {note.chiefComplaint && <SoapField color="#006194" label="S" value={note.chiefComplaint} />}
                      {note.physicalExamination && <SoapField color="#894d00" label="O" value={note.physicalExamination} />}
                      {note.diagnosis && <SoapField color="#565e74" label="A" value={note.diagnosis} />}
                      {note.treatmentPlan && <SoapField color="#0d9488" label="P" value={note.treatmentPlan} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {historyTab === 'labs' && (
          (patientChart?.orders || []).filter((o: any) => (o.orderType || o.order_type) === 'lab').length === 0 ? (
            <EmptyHistoryState label="No lab history" sublabel="Ordered lab tests will appear here once processed." />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[#dfe3e8]" />
              {patientChart.orders.filter((o: any) => (o.orderType || o.order_type) === 'lab').map((order: any) => (
                <div key={order._id} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[18px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#894d00] flex items-center justify-center">
                    <FlaskConical className="w-2 h-2 text-[#894d00]" />
                  </div>
                  <div className="bg-gradient-to-br from-white to-[#f7f9ff] border border-[#dfe3e8] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[13px] font-bold text-[#181c20]">{order.orderNumber}</p>
                        <p className="text-[11px] text-[#707881] mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">{statusLabel(order.status)}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {(order.orderTests || []).map((test: any, idx: number) => {
                        const result = order.results?.find((r: any) => r.orderTestId?.toString() === test._id?.toString());
                        return (
                          <div key={idx} className="flex items-center justify-between text-[12px] bg-white border border-[#dfe3e8] rounded-lg px-3 py-2">
                            <span className="font-medium">{test.testName || test.testCode}</span>
                            {result ? <span className="font-mono text-[#006194] font-semibold">{result.value} {result.unit || ''}</span> : <span className="text-[#707881] italic">Pending</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {historyTab === 'meds' && (
          (patientChart?.prescriptions || []).length === 0 ? (
            <EmptyHistoryState label="No medication history" sublabel="Prescriptions issued to this patient will appear here." />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[#dfe3e8]" />
              {patientChart.prescriptions.map((rx: any) => (
                <div key={rx._id} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[18px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#006194] flex items-center justify-center">
                    <Pill className="w-2 h-2 text-[#006194]" />
                  </div>
                  <div className="bg-gradient-to-br from-white to-[#f7f9ff] border border-[#dfe3e8] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[13px] font-bold text-[#181c20]">{rx.prescriptionNumber}</p>
                        <p className="text-[11px] text-[#707881] mt-0.5">{new Date(rx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <Badge variant={rx.isPaid ? 'default' : 'secondary'} className="text-[10px]">{rx.isPaid ? 'Paid' : 'Pending'}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {(rx.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="text-[12px] bg-white border border-[#dfe3e8] rounded-lg px-3 py-2">
                          <span className="font-semibold text-[#181c20]">{item.medicationName}</span>
                          <span className="text-[#707881]"> • {item.dosage}, {item.frequency}, {item.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {historyTab === 'admissions' && (
          (patientChart?.admissions || []).length === 0 ? (
            <EmptyHistoryState label="No admissions" sublabel="Inpatient admissions will appear here when the patient is admitted." />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[#dfe3e8]" />
              {patientChart.admissions.map((adm: any) => (
                <div key={adm._id} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[18px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#0d9488] flex items-center justify-center">
                    <BedDouble className="w-2 h-2 text-[#0d9488]" />
                  </div>
                  <div className="bg-gradient-to-br from-white to-[#f7f9ff] border border-[#dfe3e8] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[13px] font-bold text-[#181c20]">{adm.admissionNumber}</p>
                        <p className="text-[11px] text-[#707881] mt-0.5">{adm.wardType}{adm.bedNumber ? ` • Bed ${adm.bedNumber}` : ''} • {new Date(adm.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <Badge className="text-[10px] capitalize">{adm.status}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                      <div className="bg-white border border-[#dfe3e8] rounded-lg px-3 py-2">
                        <p className="text-[10px] text-[#707881] uppercase font-semibold">Reason</p>
                        <p className="mt-0.5">{adm.admissionReason || 'N/A'}</p>
                      </div>
                      <div className="bg-white border border-[#dfe3e8] rounded-lg px-3 py-2">
                        <p className="text-[10px] text-[#707881] uppercase font-semibold">Diagnosis</p>
                        <p className="mt-0.5">{adm.diagnosis || adm.dischargeDiagnosis || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {historyTab === 'vitals' && (
          (patientChart?.vitalsHistory || []).length === 0 ? (
            <EmptyHistoryState label="No vitals history" sublabel="Recorded vitals from previous visits will appear here." />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[#dfe3e8]" />
              {patientChart.vitalsHistory.map((v: any, idx: number) => (
                <div key={idx} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[18px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#ba1a1a] flex items-center justify-center">
                    <Heart className="w-2 h-2 text-[#ba1a1a]" />
                  </div>
                  <div className="bg-gradient-to-br from-white to-[#f7f9ff] border border-[#dfe3e8] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-bold text-[#181c20]">{new Date(v.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-[11px] text-[#707881]">{v.recordedBy?.fullName || 'Clinical staff'}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[12px]">
                      {v.vitalSigns?.bloodPressure && <VitalChip label="BP" value={v.vitalSigns.bloodPressure} unit="mmHg" color="#006194" />}
                      {v.vitalSigns?.temperature && <VitalChip label="Temp" value={v.vitalSigns.temperature} unit="°C" color="#894d00" />}
                      {v.vitalSigns?.heartRate && <VitalChip label="HR" value={v.vitalSigns.heartRate} unit="bpm" color="#ba1a1a" />}
                      {v.vitalSigns?.respiratoryRate && <VitalChip label="RR" value={v.vitalSigns.respiratoryRate} unit="/min" color="#0d9488" />}
                      {v.vitalSigns?.weight && <VitalChip label="Weight" value={v.vitalSigns.weight} unit="kg" color="#565e74" />}
                      {v.vitalSigns?.height && <VitalChip label="Height" value={v.vitalSigns.height} unit="cm" color="#565e74" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyHistoryState({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[#ebeef4] flex items-center justify-center mb-3">
        <Clock className="w-7 h-7 text-[#707881]" />
      </div>
      <p className="text-[14px] font-semibold text-[#181c20]">{label}</p>
      <p className="text-[12px] text-[#707881] mt-1 max-w-xs">{sublabel}</p>
    </div>
  );
}

function SoapField({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="bg-white border border-[#dfe3e8] rounded-lg p-2.5">
      <span className="font-bold text-[12px]" style={{ color }}>{label}:</span>
      <p className="text-[12px] text-[#181c20] mt-0.5">{value}</p>
    </div>
  );
}

function VitalChip({ label, value, unit, color }: { label: string; value: any; unit: string; color: string }) {
  return (
    <div className="bg-white border border-[#dfe3e8] rounded-lg p-2">
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
      <p className="text-[13px] font-semibold font-mono text-[#181c20] mt-0.5">{value} <span className="text-[10px] text-[#707881] font-sans">{unit}</span></p>
    </div>
  );
}

interface LabsSectionProps {
  labResults: LabResult[];
  abnormalLabResults: LabResult[];
  selectedVisit: Visit;
  patientOrders: any[];
  navigate: any;
  getFlagColor: (flag?: string) => string;
  getFlagLabel: (flag?: string) => string;
  cn: (...args: any[]) => string;
}

function LabsSection({ labResults, selectedVisit, patientOrders, navigate, getFlagColor, getFlagLabel, cn }: LabsSectionProps) {
  const labOrders = patientOrders.filter((o: any) => (o.orderType || o.order_type) === 'lab');
  const hasCritical = labResults.some((r: LabResult) => r.flag === 'critical_high' || r.flag === 'critical_low' || (r.testCode || '').toLowerCase().includes('malaria') && (r.value || '').toLowerCase().includes('positive'));

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#dfe3e8] flex justify-between items-center bg-[#f1f4fa]">
          <h2 className="text-[14px] font-bold text-[#181c20] flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[#006194]" />
            Hematology & Infectious Disease
          </h2>
          <span className="text-[11px] text-[#3f4850] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {labResults.length} result{labResults.length === 1 ? '' : 's'} released
          </span>
        </div>

        {labResults.length === 0 ? (
          <div className="p-12 text-center text-[#707881]">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-[13px]">No lab results available yet</p>
            <p className="text-[11px] mt-1">Results will appear here once verified by the lab</p>
          </div>
        ) : (
          <>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#181c20] bg-[#ebeef4]">
                  <th className="p-3 pl-4 text-[10px] font-bold uppercase tracking-wider text-[#3f4850]">Test</th>
                  <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-[#3f4850]">Result</th>
                  <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-[#3f4850]">Flag</th>
                  <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-[#3f4850] w-1/3">Reference Range</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {labResults.map((result: LabResult) => {
                  const isCritical = result.flag === 'critical_high' || result.flag === 'critical_low';
                  const isAbnormal = result.flag && result.flag !== 'normal';
                  return (
                    <tr key={result._id} className={cn("border-b border-[#dfe3e8] hover:bg-[#f1f4fa] transition-colors", isCritical && "bg-[#ffdad6]/30 border-2 border-[#ba1a1a]")}>
                      <td className="p-3 pl-4 font-medium text-[#181c20]">{result.testName}</td>
                      <td className="p-3 font-mono font-bold">
                        <span className={cn(isAbnormal ? (isCritical ? "text-[#ba1a1a]" : "text-[#894d00]") : "text-[#181c20]")}>
                          {result.value}
                        </span>
                        {result.unit && <span className="text-[#707881] font-normal text-[10px] ml-1">{result.unit}</span>}
                      </td>
                      <td className="p-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border", getFlagColor(result.flag))}>
                          {result.flag === 'high' && <ArrowUp className="w-3 h-3" />}
                          {result.flag === 'low' && <ArrowDown className="w-3 h-3" />}
                          {getFlagLabel(result.flag)}
                        </span>
                      </td>
                      <td className="p-3">
                        <RangeBar result={result} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {hasCritical && (
              <div className="p-4 border-t border-[#dfe3e8] bg-[#ffdad6]/20">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#ba1a1a] mb-2">System Interpretation</h3>
                <p className="text-[12px] text-[#3f4850] leading-relaxed">
                  Findings consistent with critical lab values. Immediate clinical correlation and intervention required.
                  Review the flagged results above and consider urgent treatment adjustments.
                </p>
              </div>
            )}
          </>
        )}

        {labOrders.length > 0 && (
          <div className="p-4 border-t border-[#dfe3e8] bg-[#f7f9ff]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#707881] mb-2">Orders for this Visit</h3>
            <div className="space-y-1.5">
              {labOrders.map((order: any) => {
                const tests = order.order_tests || order.tests || [];
                return (
                  <div key={order._id} className="flex items-center justify-between p-2 bg-white border border-[#dfe3e8] rounded text-[12px]">
                    <span className="font-mono">{order.orderNumber}</span>
                    <span className="text-[#707881]">{tests.length} test{tests.length === 1 ? '' : 's'}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{order.status?.replace(/_/g, ' ')}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RangeBar({ result }: { result: LabResult }) {
  const refRange = result.referenceRange || result.reference_range || '';
  const match = refRange.match(/(-?\d+\.?\d*)\s*[-–]\s*(-?\d+\.?\d*)/);
  if (!match) return <span className="text-[#707881] text-[11px]">{refRange || '-'}</span>;
  const lo = parseFloat(match[1]);
  const hi = parseFloat(match[2]);
  const val = parseFloat(result.value);
  if (isNaN(val) || isNaN(lo) || isNaN(hi)) return <span className="text-[#707881] text-[11px]">{refRange}</span>;
  const min = lo - (hi - lo) * 0.5;
  const max = hi + (hi - lo) * 0.5;
  const pos = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
  const lowPos = Math.max(0, Math.min(100, ((lo - min) / (max - min)) * 100));
  const highPos = Math.max(0, Math.min(100, ((hi - min) / (max - min)) * 100));
  const isCritical = result.flag === 'critical_high' || result.flag === 'critical_low';
  const isAbnormal = result.flag && result.flag !== 'normal';
  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className="font-mono text-[10px] text-[#707881] w-8 shrink-0">{lo}</span>
      <div className="flex-1 h-2 bg-[#dfe3e8] rounded relative">
        <div className="absolute h-full bg-[#dfe3e8]/50" style={{ left: `${lowPos}%`, right: `${100 - highPos}%` }} />
        <div
          className={cn("absolute w-2 h-4 top-1/2 -translate-y-1/2 rounded-sm",
            isCritical ? "bg-[#ba1a1a]" : isAbnormal ? "bg-[#894d00]" : "bg-[#0d9488]"
          )}
          style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <span className="font-mono text-[10px] text-[#707881] w-8 shrink-0 text-right">{hi}</span>
    </div>
  );
}

interface RxSectionProps {
  patientPrescriptions: any[];
  currentVisitPrescriptions: any[];
  selectedVisit: Visit;
  startEditPrescription: (rx: any) => void;
  canContinueClinicalWork: boolean;
  cn: (...args: any[]) => string;
}

function RxSection({ patientPrescriptions, currentVisitPrescriptions, startEditPrescription, cn }: RxSectionProps) {
  const otherPrescriptions = patientPrescriptions.filter((rx: any) => {
    const rxVisitId = typeof rx.visitId === 'object' ? rx.visitId?._id : rx.visitId;
    return !currentVisitPrescriptions.find((cv: any) => cv._id === rx._id);
  });
  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      {/* Current visit prescriptions */}
      <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#dfe3e8] bg-[#f1f4fa]">
          <h2 className="text-[14px] font-bold text-[#181c20] flex items-center gap-2">
            <Pill className="w-4 h-4 text-[#006194]" />
            Current Visit Prescriptions
          </h2>
        </div>
        <div className="p-4">
          {currentVisitPrescriptions.length === 0 ? (
            <p className="text-center text-[#707881] py-6 text-[12px]">No prescriptions for this visit</p>
          ) : (
            <div className="space-y-2">
              {currentVisitPrescriptions.map((rx: any) => (
                <div key={rx._id} className="border border-[#dfe3e8] rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[12px] font-semibold">{rx.prescriptionNumber}</p>
                    <Badge variant={rx.isPaid ? 'default' : 'secondary'} className="text-[10px]">
                      {rx.isPaid ? 'Paid' : 'Awaiting payment'}
                    </Badge>
                  </div>
                  <div className="space-y-1 mb-2">
                    {(rx.items || []).map((item: any, idx: number) => (
                      <p key={idx} className="text-[11px] text-[#3f4850]">
                        <span className="font-medium text-[#181c20]">{item.medicationName}</span> - {item.dosage}, {item.frequency}, {item.duration}
                        {item.quantity ? ` (Qty: ${item.quantity})` : ''}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#707881]">
                    <span>Total: Le {(rx.totalAmount || 0).toLocaleString()}</span>
                    {!rx.isPaid && rx.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => startEditPrescription(rx)} className="h-7 text-[10px]">
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historical prescriptions */}
      <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#dfe3e8] bg-[#f1f4fa]">
          <h2 className="text-[14px] font-bold text-[#181c20] flex items-center gap-2">
            <Pill className="w-4 h-4 text-[#707881]" />
            Prescription History
          </h2>
        </div>
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {otherPrescriptions.length === 0 ? (
            <p className="text-center text-[#707881] py-6 text-[12px]">No historical prescriptions</p>
          ) : (
            <div className="space-y-2">
              {otherPrescriptions.slice(0, 10).map((rx: any) => (
                <div key={rx._id} className="border border-[#dfe3e8] rounded-lg p-3 bg-[#f7f9ff]">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[12px] font-semibold">{rx.prescriptionNumber}</p>
                    <p className="text-[10px] text-[#707881]">{new Date(rx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                    {(rx.items || []).map((item: any, idx: number) => (
                      <p key={idx} className="text-[11px] text-[#3f4850]">
                        <span className="font-medium">{item.medicationName}</span> - {item.dosage}, {item.frequency}, {item.duration}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useDoctorDashboard();
  const acceptPatient = useAcceptPatient();
  const updateVisit = useUpdateVisit();
  const completeVisit = useCompleteVisit();

  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [activeSection, setActiveSection] = useState<'consult' | 'history' | 'labs' | 'rx'>('consult');
  const [historyTab, setHistoryTab] = useState('visits');

  const [labOrderModalOpen, setLabOrderModalOpen] = useState(false);
  const [selectedTests, setSelectedTests] = useState<Test[]>([]);
  const [searchTest, setSearchTest] = useState('');

  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([]);
  const [searchMedication, setSearchMedication] = useState('');

  const [referralOpen, setReferralOpen] = useState(false);
  const [referralForm, setReferralForm] = useState({ specialistId: '', reason: '', notes: '' });
  const referToSpecialist = useReferToSpecialist();
  const { data: specialists = [] } = useQuery({
    queryKey: ['doctors', 'specialists'],
    queryFn: () => doctorsAPI.getSpecialists(),
    staleTime: 5 * 60 * 1000,
  });

  const [admitOpen, setAdmitOpen] = useState(false);
  const [admitForm, setAdmitForm] = useState({ wardType: 'general', bedNumber: '', admissionReason: '', diagnosis: '', notes: '' });

  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editingPrescription, setEditingPrescription] = useState<any>(null);
  const createAdmission = useMutation({
    mutationFn: async () => {
      if (!selectedVisit) return;
      return admissionsAPI.create({
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        doctorId: profile?.id,
        wardType: admitForm.wardType,
        bedNumber: admitForm.bedNumber || undefined,
        admissionReason: admitForm.admissionReason,
        diagnosis: admitForm.diagnosis || undefined,
        notes: admitForm.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Patient admitted');
      setAdmitOpen(false);
      setAdmitForm({ wardType: 'general', bedNumber: '', admissionReason: '', diagnosis: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      setSelectedVisit(null);
    },
    onError: () => toast.error('Failed to admit patient'),
  });

  const [vitalsForm, setVitalsForm] = useState({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', weight: '', height: '', oxygenSaturation: '' });
  const [soapForm, setSoapForm] = useState({ subjective: '', objective: '', assessment: '', plan: '', diagnosis: '' });
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);

  const { data: tests = [], isLoading: testsLoading, isError: testsError, error: testsLoadError } = useQuery({
    queryKey: ['orders', 'lis-catalog'],
    queryFn: () => ordersAPI.getLisCatalog(),
    staleTime: 60 * 1000,
  });

  const { data: medications = [] } = useQuery({
    queryKey: ['medications'],
    queryFn: () => medicationService.findAll(),
    staleTime: 5 * 60 * 1000,
  });

  const patientId = selectedVisit?.patientId?._id || selectedVisit?.patientId || '';
  const { data: patientVisits = [] } = usePatientVisits(patientId);
  const { data: patientOrders = [] } = useQuery({
    queryKey: ['orders', 'patient', patientId],
    queryFn: () => ordersAPI.getAll({ patientId, limit: 100 }),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
  const { data: patientChart, isLoading: chartLoading } = useQuery({
    queryKey: ['patient-chart', patientId],
    queryFn: () => patientService.getChart(patientId),
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });
  const { data: patientPrescriptions = [] } = useQuery({
    queryKey: ['prescriptions', 'patient', patientId],
    queryFn: () => prescriptionService.findByPatient(patientId),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });

  const currentVisitId = selectedVisit?._id || selectedVisit?.id;
  const currentVisitPrescriptions = (Array.isArray(patientPrescriptions) ? patientPrescriptions : [])
    .filter((rx: any) => {
      const rxVisitId = typeof rx.visitId === 'object' ? rx.visitId?._id : rx.visitId;
      return rxVisitId === currentVisitId;
    });
  const currentVisitLabOrder = patientOrders.find((order: any) => {
    const orderVisitId = typeof order.visitId === 'object' ? order.visitId?._id : order.visitId;
    return orderVisitId === currentVisitId && (order.orderType || order.order_type) === 'lab';
  });
  const currentVisitOrders = (Array.isArray(patientOrders) ? patientOrders : [])
    .filter((order: any) => {
      const orderVisitId = typeof order.visitId === 'object' ? order.visitId?._id : order.visitId;
      return orderVisitId === currentVisitId;
    });
  const labOrderId = selectedVisit?.orders?.find((o: any) => o.orderType === 'lab')?._id ||
    currentVisitLabOrder?._id ||
    currentVisitLabOrder?.id ||
    selectedVisit?.consultationOrderId;
  const { data: labResults = [] } = useResults(labOrderId);
  const abnormalLabResults = labResults.filter((result: LabResult) => result.flag && result.flag !== 'normal');
  const selectedPatient = selectedVisit?.patientId || {};
  const selectedWalletBalance = Number(selectedPatient.walletBalance || selectedPatient.wallet?.balance || 0);

  const lisOrderables = Array.isArray(tests) ? tests : [];
  const filteredTests = useMemo(() => {
    if (!searchTest) return lisOrderables.slice(0, 20);
    return lisOrderables.filter((t: Test) =>
      t.name?.toLowerCase().includes(searchTest.toLowerCase()) ||
      t.code?.toLowerCase().includes(searchTest.toLowerCase())
    ).slice(0, 20);
  }, [lisOrderables, searchTest]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ['medications', 'search', searchMedication],
    queryFn: () => medicationService.search(searchMedication),
    enabled: searchMedication.length >= 2,
    staleTime: 30 * 1000,
  });
  const filteredMedications = useMemo(() => {
    if (searchMedication.length >= 2) return searchResults;
    return medications || [];
  }, [medications, searchMedication, searchResults]);

  useEffect(() => {
    if (selectedVisit) {
      setVitalsForm({
        temperature: selectedVisit.temperature?.toString() || '',
        bloodPressure: selectedVisit.bloodPressure || '',
        heartRate: selectedVisit.heartRate?.toString() || '',
        respiratoryRate: selectedVisit.respiratoryRate?.toString() || '',
        weight: selectedVisit.weight?.toString() || '',
        height: selectedVisit.height?.toString() || '',
        oxygenSaturation: selectedVisit.oxygenSaturation?.toString() || '',
      });
      setSoapForm({
        subjective: selectedVisit.subjectiveNotes || selectedVisit.chiefComplaint || '',
        objective: selectedVisit.objectiveNotes || '',
        assessment: selectedVisit.assessmentNotes || '',
        plan: selectedVisit.planNotes || '',
        diagnosis: selectedVisit.diagnosis || '',
      });
    }
  }, [selectedVisit?._id]);

  const handleAcceptPatient = async (visit: Visit) => {
    try {
      const acceptedVisit = await acceptPatient.mutateAsync(visit._id || visit.id || '');
      setSelectedVisit((acceptedVisit as Visit) || visit);
      setActiveSection('consult');
      toast.success(`Accepted: ${visit.patientId?.firstName} ${visit.patientId?.lastName}`);
    } catch (error) {
      toast.error('Failed to accept patient');
    }
  };

  const handleSaveVitalsAndSOAP = async () => {
    if (!selectedVisit) return;
    try {
      await updateVisit.mutateAsync({
        visitId: selectedVisit._id || selectedVisit.id || '',
        data: {
          temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
          bloodPressure: vitalsForm.bloodPressure || undefined,
          heartRate: vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : undefined,
          respiratoryRate: vitalsForm.respiratoryRate ? parseInt(vitalsForm.respiratoryRate) : undefined,
          weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : undefined,
          height: vitalsForm.height ? parseFloat(vitalsForm.height) : undefined,
          oxygenSaturation: vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation) : undefined,
          subjectiveNotes: soapForm.subjective || undefined,
          objectiveNotes: soapForm.objective || undefined,
          assessmentNotes: soapForm.assessment || undefined,
          planNotes: soapForm.plan || undefined,
          diagnosis: soapForm.diagnosis || undefined,
        },
      });
      await soapNoteService.create({
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        doctorId: profile?.id,
        noteType: SoapNoteTypeEnum.CONSULTATION,
        chiefComplaint: soapForm.subjective || selectedVisit.chiefComplaint || undefined,
        historyPresentIllness: soapForm.subjective || undefined,
        vitalSigns: {
          temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
          bloodPressure: vitalsForm.bloodPressure || undefined,
          heartRate: vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : undefined,
          respiratoryRate: vitalsForm.respiratoryRate ? parseInt(vitalsForm.respiratoryRate) : undefined,
          weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : undefined,
          height: vitalsForm.height ? parseFloat(vitalsForm.height) : undefined,
          oxygenSaturation: vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation) : undefined,
        },
        physicalExamination: soapForm.objective || undefined,
        diagnosis: soapForm.assessment || soapForm.diagnosis || undefined,
        treatmentPlan: soapForm.plan || undefined,
        followUpInstructions: soapForm.plan || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['patient-chart', selectedVisit.patientId?._id || selectedVisit.patientId] });
      toast.success('Notes saved');
    } catch (error) {
      toast.error('Failed to save notes');
    }
  };

  const handleCompleteAndNext = async () => {
    if (!selectedVisit) return;
    try {
      await completeVisit.mutateAsync(selectedVisit._id || selectedVisit.id || '');
      toast.success('Visit completed');
      setSelectedVisit(null);
      const nextInQueue = waitingQueue.find((v: Visit) => v.status === 'in_queue' || v.status === 'awaiting_doctor');
      if (nextInQueue) {
        await handleAcceptPatient(nextInQueue);
      }
    } catch (error) {
      toast.error('Failed to complete visit');
    }
  };

  const createLabOrder = useMutation({
    mutationFn: async () => {
      if (!selectedVisit || selectedTests.length === 0) return;
      const orderData = {
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        orderType: 'lab',
        tests: selectedTests.map(t => ({ testId: t._id, testCode: t.code, testName: t.name, price: t.price })),
        priority: 'routine',
      };
      return await ordersAPI.create(orderData);
    },
    onSuccess: () => {
      toast.success('Lab order created. Patient should pay at reception.');
      setLabOrderModalOpen(false);
      setSelectedTests([]);
      setEditingOrder(null);
      setSelectedVisit(prev => prev ? { ...prev, status: 'awaiting_lab' } : prev);
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create lab order';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const createPrescription = useMutation({
    mutationFn: async () => {
      if (!selectedVisit || prescriptionItems.length === 0) return;
      return await prescriptionService.create({
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        items: prescriptionItems.map(({ unitPrice, ...item }) => ({
          ...item,
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        totalAmount: prescriptionItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0),
      });
    },
    onSuccess: () => {
      toast.success('Prescription created. Patient should pay at reception.');
      setPrescriptionModalOpen(false);
      setPrescriptionItems([]);
      setEditingPrescription(null);
      setSelectedVisit(prev => prev ? { ...prev, status: 'awaiting_pharmacy' } : prev);
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create prescription';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const updateLabOrder = useMutation({
    mutationFn: async () => {
      if (!editingOrder || selectedTests.length === 0) return;
      return await ordersAPI.update(editingOrder._id || editingOrder.id, {
        tests: selectedTests.map(t => ({ testId: t._id, testCode: t.code, testName: t.name, price: t.price })),
        priority: editingOrder.priority,
      });
    },
    onSuccess: () => {
      toast.success('Lab order updated');
      setLabOrderModalOpen(false);
      setSelectedTests([]);
      setEditingOrder(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update lab order';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const updatePrescription = useMutation({
    mutationFn: async () => {
      if (!editingPrescription || prescriptionItems.length === 0) return;
      return await prescriptionService.update(editingPrescription._id, {
        items: prescriptionItems.map(({ unitPrice, ...item }) => ({
          ...item,
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        totalAmount: prescriptionItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0),
      });
    },
    onSuccess: () => {
      toast.success('Prescription updated');
      setPrescriptionModalOpen(false);
      setPrescriptionItems([]);
      setEditingPrescription(null);
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update prescription';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const addTestToOrder = (test: Test) => {
    if (!selectedTests.find(t => (t._id || t.code) === (test._id || test.code))) {
      setSelectedTests([...selectedTests, test]);
    }
  };
  const removeTestFromOrder = (testId: string) => {
    setSelectedTests(selectedTests.filter(t => (t._id || t.code) !== testId));
  };
  const addMedicationToPrescription = (med: Medication) => {
    setPrescriptionItems([
      ...prescriptionItems,
      {
        medicationId: med._id, medicationName: med.name, dosage: '', frequency: '', duration: '',
        quantity: 1, route: 'oral', unitPrice: med.unitPrice || 0, instructions: '', pharmacistNote: '',
      },
    ]);
  };
  const updatePrescriptionItem = (index: number, field: string, value: any) => {
    const updated = [...prescriptionItems];
    updated[index][field] = value;
    setPrescriptionItems(updated);
  };
  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };
  const startEditOrder = (order: any) => {
    const orderTests = (order.order_tests || order.tests || []).map((t: any) => ({
      _id: t.testId || t.test_id || t._id, code: t.testCode || t.test_code, name: t.testName || t.test_name, price: t.price || 0, isPanel: !!t.panelCode,
    }));
    setSelectedTests(orderTests); setEditingOrder(order); setLabOrderModalOpen(true);
  };
  const startEditPrescription = (rx: any) => {
    const items = (rx.items || []).map((item: any) => ({
      medicationId: item.medicationId?._id || item.medicationId, medicationName: item.medicationName,
      dosage: item.dosage, frequency: item.frequency, duration: item.duration, quantity: item.quantity,
      route: item.route || 'oral', unitPrice: 0, instructions: item.instructions || '', pharmacistNote: item.pharmacistNote || '',
    }));
    setPrescriptionItems(items); setEditingPrescription(rx); setPrescriptionModalOpen(true);
  };
  const cancelEdit = () => {
    setEditingOrder(null); setEditingPrescription(null);
    setSelectedTests([]); setPrescriptionItems([]);
    setLabOrderModalOpen(false); setPrescriptionModalOpen(false);
  };

  const toggleDiagnosis = (dx: string) => {
    setSelectedDiagnoses(prev => prev.includes(dx) ? prev.filter(d => d !== dx) : [...prev, dx]);
  };

  const stats = dashboardData?.todayStats || { seen: 0, waiting: 0, completed: 0 };
  const waitingQueue = dashboardData?.waitingQueue || [];
  const activePatients = dashboardData?.activePatients || [];
  const awaitingLabPayment = dashboardData?.awaitingLabPayment || [];
  const awaitingResults = dashboardData?.awaitingResults || [];
  const awaitingPharmacy = dashboardData?.awaitingPharmacy || [];
  const awaitingDispensing = dashboardData?.awaitingDispensing || [];
  const resultsReady = dashboardData?.resultsReady || [];
  const openEncounterCount = activePatients.length;

  const currentActiveVisit = activePatients.find((v: Visit) => v.status === 'in_consultation') || activePatients[0];
  const canContinueClinicalWork = !!selectedVisit && ['in_consultation', 'results_ready', 'awaiting_doctor_review'].includes(selectedVisit.status);
  const canCloseEncounter = !!selectedVisit && !['awaiting_lab', 'awaiting_results', 'awaiting_pharmacy', 'awaiting_dispensing'].includes(selectedVisit.status);
  const closureBlockers = useMemo(() => {
    if (!selectedVisit) return [];
    const blockers: string[] = [];
    const status = selectedVisit.status;
    if (status === 'awaiting_lab') blockers.push('Lab order payment is still pending.');
    if (status === 'awaiting_results') blockers.push('Lab processing is still in progress.');
    if (status === 'awaiting_pharmacy') blockers.push('Pharmacy order payment is still pending.');
    if (status === 'awaiting_dispensing') blockers.push('Pharmacy dispensing is still pending.');
    const activeClinicalOrders = currentVisitOrders.filter((order: any) => {
      const type = order.orderType || order.order_type;
      return type === 'lab' || type === 'pharmacy';
    });
    const hasUnpaidClinical = activeClinicalOrders.some((order: any) => (order.paymentStatus || order.payment_status) !== 'paid');
    const hasUnreleasedLab = activeClinicalOrders.some((order: any) => (order.orderType || order.order_type) === 'lab' && (order.status || '') !== 'completed');
    const hasUndispensedPharmacy = activeClinicalOrders.some((order: any) => (order.orderType || order.order_type) === 'pharmacy' && (order.status || '') !== 'completed');
    if (hasUnpaidClinical) blockers.push('One or more clinical orders are not fully paid.');
    if (hasUnreleasedLab) blockers.push('One or more lab orders are not completed/released yet.');
    if (hasUndispensedPharmacy) blockers.push('One or more pharmacy orders are not dispensed yet.');
    return Array.from(new Set(blockers));
  }, [selectedVisit?._id, selectedVisit?.status, currentVisitOrders]);

  useEffect(() => {
    if (currentActiveVisit && !selectedVisit) {
      setSelectedVisit(currentActiveVisit);
    }
  }, [currentActiveVisit?._id]);

  const hospitalInfo = (() => {
    const p: any = (profile as any) || {};
    return {
      name: p.hospitalName || p.branchName || 'Freetown Central',
      type: p.department || p.hospitalType || 'General Outpatient',
      role: 'Doctor',
    };
  })();

  const triage = triageColor(selectedVisit?.triagePriority);
  const allergies: string[] = selectedPatient.allergies || [];

  const sidebarQueue = useMemo(() => {
    const all = [
      ...waitingQueue.map((v: Visit) => ({ ...v, _section: 'queue' as const })),
      ...activePatients.map((v: Visit) => ({ ...v, _section: 'active' as const })),
      ...resultsReady.map((v: Visit) => ({ ...v, _section: 'results' as const })),
    ];
    return all;
  }, [waitingQueue, activePatients, resultsReady]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f9ff]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#006194]" />
          <p className="text-sm text-[#3f4850]">Loading clinic workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[#f7f9ff] text-[#181c20] antialiased overflow-hidden">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[#dfe3e8] bg-white px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[#006194]">
            <Hospital className="w-5 h-5" />
            <span className="text-[20px] font-bold tracking-tight">SierraEMR</span>
          </div>
          <nav className="hidden md:flex h-full items-end gap-1 ml-4">
            {[
              { id: 'consult', label: 'Consult' },
              { id: 'history', label: 'History' },
              { id: 'labs', label: 'Labs' },
              { id: 'rx', label: 'Rx' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={cn(
                  "h-full px-3 pb-2 text-[11px] font-bold uppercase tracking-wider transition-colors border-b-2",
                  activeSection === item.id
                    ? "text-[#006194] border-[#006194]"
                    : "text-[#3f4850] border-transparent hover:bg-[#ebeef4]"
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707881]" />
            <input
              type="text"
              placeholder="Search patients, protocols..."
              className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#f1f4fa] border border-[#dfe3e8] rounded-full text-[#181c20] focus:border-[#006194] focus:ring-1 focus:ring-[#006194] focus:bg-white outline-none"
            />
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#dfe3e8] bg-[#dae2fd] flex items-center justify-center text-[#006194] text-[11px] font-bold">
            {profile?.fullName?.[0] || 'D'}
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-14 h-full overflow-hidden">
        {/* Sidebar */}
        <aside className="fixed left-0 top-14 h-[calc(100vh-56px)] w-64 z-40 flex flex-col bg-[#f1f4fa] border-r border-[#dfe3e8]">
          <div className="p-4 flex items-center gap-3 border-b border-[#dfe3e8]">
            <div className="w-10 h-10 rounded-lg bg-[#007bb9] text-white flex items-center justify-center">
              <Hospital className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold text-[#181c20] truncate">{hospitalInfo.name}</h2>
              <p className="text-[12px] text-[#3f4850] truncate">{hospitalInfo.type}</p>
            </div>
          </div>
          <div className="p-3">
            <button
              onClick={() => navigate('/reception/register')}
              className="w-full h-11 bg-[#006194] text-white text-[11px] font-bold uppercase tracking-wider rounded-full flex items-center justify-center gap-2 hover:bg-[#004b73] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Registration
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1">
            {[
              { id: 'queue', label: 'Queue', icon: Stethoscope, count: waitingQueue.length + activePatients.length, active: true },
              { id: 'results', label: 'Results Ready', icon: FlaskConical, count: resultsReady.length },
            ].map((item) => (
              <button
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors",
                  item.active
                    ? "border-l-2 border-[#006194] bg-[#cce5ff] text-[#004b73]"
                    : "text-[#3f4850] hover:bg-[#e5e8ee]"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    item.active ? "bg-[#004b73] text-white" : "bg-[#dfe3e8] text-[#3f4850]"
                  )}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}

            <div className="mt-4 mb-1 px-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#707881]">Today's Roster</p>
            </div>
            <div className="flex flex-col gap-1">
              {sidebarQueue.slice(0, 5).map((visit: Visit) => {
                const isSelected = selectedVisit?._id === visit._id;
                const name = patientDisplayName(visit);
                const initials = patientInitials(visit);
                const status = visit.status;
                return (
                  <button
                    key={visit._id}
                    onClick={() => setSelectedVisit(visit)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded text-left transition-colors border-l-4",
                      queueBorderColor(status),
                      isSelected ? "bg-[#e5e8ee]" : "hover:bg-white"
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-white border border-[#dfe3e8] flex items-center justify-center text-[10px] font-bold text-[#3f4850]">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#181c20] truncate">{name}</p>
                      <p className="text-[10px] text-[#3f4850] truncate">
                        {visit.patientId?.gender?.[0] || ''}{patientAgeLabel(visit.patientId)} • {statusLabel(status)}
                      </p>
                    </div>
                    {status === 'in_consultation' && <Hourglass className="w-3.5 h-3.5 text-[#894d00]" />}
                    {(status === 'in_queue' || status === 'awaiting_doctor') && <AlertOctagon className="w-3.5 h-3.5 text-[#ba1a1a]" />}
                  </button>
                );
              })}
              {sidebarQueue.length === 0 && (
                <p className="text-[11px] text-[#707881] text-center py-3">No active patients</p>
              )}
            </div>
          </nav>


        </aside>

        {/* Main Workspace */}
        <main className="ml-64 flex-1 h-[calc(100vh-56px)] flex flex-col bg-[#f7f9ff] overflow-hidden">
          {selectedVisit ? (
            <>
              {/* Patient Context Strip */}
              <div className="bg-white border-b border-[#dfe3e8] px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-[#e5e8ee] border border-[#dfe3e8] flex items-center justify-center shrink-0">
                      <span className="text-[14px] font-bold text-[#3f4850]">{patientInitials(selectedVisit)}</span>
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-[16px] font-bold text-[#181c20] truncate">{patientDisplayName(selectedVisit)}</h1>
                      <div className="flex items-center gap-2 text-[12px] text-[#3f4850] font-mono">
                        <span>ID: {selectedPatient.patientId || selectedPatient.mrn || 'N/A'}</span>
                        <span>•</span>
                        <span>{patientAgeLabel(selectedPatient)}</span>
                        <span>•</span>
                        <span>{selectedPatient.gender?.[0] || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-[#dfe3e8]" />
                  <div className="grid grid-cols-3 gap-6 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#707881]">Triage</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={cn("w-2 h-2 rounded-full", triage.dot)} />
                        <span className={cn("text-[13px] font-semibold capitalize", triage.text)}>{triage.label}</span>
                      </div>
                    </div>
                    <div className="min-w-0 max-w-[220px]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#707881]">Chief Complaint</p>
                      <p className="text-[13px] text-[#181c20] truncate" title={selectedVisit.chiefComplaint}>
                        {selectedVisit.chiefComplaint || '—'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#707881]">Allergies</p>
                      {allergies.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {allergies.slice(0, 2).map((a, i) => (
                            <span key={i} className="text-[11px] font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 px-1.5 py-0.5 rounded">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13px] text-[#707881]">None recorded</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#707881]">Balance</p>
                  <p className="text-[15px] font-mono font-bold text-[#181c20]">Le {selectedWalletBalance.toLocaleString()}</p>
                </div>
              </div>

              {/* Clinical Content */}
              <div key={activeSection} className="flex-1 overflow-y-auto p-5 flex gap-5">
                {activeSection === 'consult' && (
                  <ConsultSection
                    selectedVisit={selectedVisit}
                    vitalsForm={vitalsForm}
                    setVitalsForm={setVitalsForm}
                    soapForm={soapForm}
                    setSoapForm={setSoapForm}
                    selectedDiagnoses={selectedDiagnoses}
                    toggleDiagnosis={toggleDiagnosis}
                    canContinueClinicalWork={canContinueClinicalWork}
                    currentVisitOrders={currentVisitOrders}
                    setEditingOrder={setEditingOrder}
                    setSelectedTests={setSelectedTests}
                    setLabOrderModalOpen={setLabOrderModalOpen}
                    setEditingPrescription={setEditingPrescription}
                    setPrescriptionItems={setPrescriptionItems}
                    setPrescriptionModalOpen={setPrescriptionModalOpen}
                    setReferralOpen={setReferralOpen}
                    startEditOrder={startEditOrder}
                    startEditPrescription={startEditPrescription}
                    labResults={labResults}
                    patientVisits={patientVisits}
                    navigate={navigate}
                    waitTimeLabel={waitTimeLabel}
                    patientDisplayName={patientDisplayName}
                    statusLabel={statusLabel}
                    getFlagColor={getFlagColor}
                    cn={cn}
                  />
                )}
                {activeSection === 'history' && (
                  <HistorySection
                    patientVisits={patientVisits}
                    selectedVisit={selectedVisit}
                    patientChart={patientChart}
                    chartLoading={chartLoading}
                    historyTab={historyTab}
                    setHistoryTab={setHistoryTab}
                    patientDisplayName={patientDisplayName}
                    statusLabel={statusLabel}
                    cn={cn}
                  />
                )}
                {activeSection === 'labs' && (
                  <LabsSection
                    labResults={labResults}
                    abnormalLabResults={abnormalLabResults}
                    selectedVisit={selectedVisit}
                    patientOrders={patientOrders}
                    navigate={navigate}
                    getFlagColor={getFlagColor}
                    getFlagLabel={getFlagLabel}
                    cn={cn}
                  />
                )}
                {activeSection === 'rx' && (
                  <RxSection
                    patientPrescriptions={patientPrescriptions}
                    currentVisitPrescriptions={currentVisitPrescriptions}
                    selectedVisit={selectedVisit}
                    startEditPrescription={startEditPrescription}
                    canContinueClinicalWork={canContinueClinicalWork}
                    cn={cn}
                  />
                )}
              </div>

              {/* Sticky Action Bar - only in consult mode */}
              {activeSection === 'consult' && (
                <div className="border-t border-[#dfe3e8] bg-white px-6 py-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[12px] text-[#3f4850]">Ready to complete consultation?</span>
                    {closureBlockers.length > 0 && (
                      <span className="text-[11px] text-[#894d00] bg-[#ffdcc0] border border-[#894d00]/20 px-2 py-0.5 rounded truncate max-w-md">
                        {closureBlockers[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onClick={handleSaveVitalsAndSOAP}
                      disabled={updateVisit.isPending}
                      className="h-11 px-5 border-[#dfe3e8] text-[13px] font-medium"
                    >
                      {updateVisit.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Draft
                    </Button>
                    <Button
                      onClick={handleCompleteAndNext}
                      disabled={completeVisit.isPending || !canCloseEncounter}
                      className="h-11 px-5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-[13px] font-bold flex items-center gap-2"
                    >
                      {completeVisit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Complete & Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-xl text-center">
                <div className="w-20 h-20 rounded-full bg-[#ebeef4] mx-auto mb-4 flex items-center justify-center">
                  <User className="w-10 h-10 text-[#707881]" />
                </div>
                <h2 className="text-[20px] font-bold text-[#181c20]">No patient open</h2>
                <p className="text-[13px] text-[#3f4850] mt-2">
                  Open a waiting patient, continue an active encounter, or review returned results.
                </p>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    { icon: Clock, label: `${waitingQueue.length} waiting` },
                    { icon: Stethoscope, label: `${activePatients.length} active` },
                    { icon: FlaskConical, label: `${resultsReady.length} results` },
                  ].map((s) => (
                    <div key={s.label} className="border border-[#dfe3e8] rounded-lg p-4 bg-white">
                      <s.icon className="w-5 h-5 text-[#006194] mx-auto mb-2" />
                      <p className="text-[12px] font-semibold text-[#181c20]">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals - all preserved from original */}
      <Dialog open={labOrderModalOpen} onOpenChange={(open) => { if (!open) cancelEdit(); setLabOrderModalOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Edit Lab Order' : 'Order Lab Tests'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Search Tests</Label>
              <Input value={searchTest} onChange={(e) => setSearchTest(e.target.value)} placeholder="Search by test name or code..." className="mt-1" />
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {testsLoading ? (
                  <div className="h-full p-6 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading LIS catalog
                  </div>
                ) : testsError ? (
                  <div className="p-6 text-center text-sm text-red-600">
                    Could not load LIS catalog.
                    <p className="mt-1 text-xs text-muted-foreground">{(testsLoadError as any)?.response?.data?.message || (testsLoadError as any)?.message || 'Check backend LIS connection.'}</p>
                  </div>
                ) : filteredTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No LIS tests or panels found</div>
                ) : (
                  filteredTests.map((test: Test) => (
                    <div key={test._id || test.code} className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 flex items-center justify-between" onClick={() => addTestToOrder(test)}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{test.name}</p>
                          {test.isPanel && <Badge variant="outline" className="text-[10px] h-5">Panel</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{test.code} - Le {test.price?.toLocaleString()}{test.isPanel && test.panelComponents && <span className="ml-1">({test.panelComponents.length} components)</span>}</p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
            <div>
              <Label className="text-sm font-medium">Selected Tests ({selectedTests.length})</Label>
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {selectedTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Click tests to add them</div>
                ) : (
                  <div className="divide-y">
                    {selectedTests.map((test) => (
                      <div key={test._id || test.code} className="p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{test.name}</p>
                            {test.isPanel && <Badge variant="outline" className="text-[10px] h-5">Panel</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Le {test.price?.toLocaleString()}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeTestFromOrder(test._id || test.code)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {selectedTests.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Total: Le {selectedTests.reduce((sum, t) => sum + (t.price || 0), 0).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button onClick={() => editingOrder ? updateLabOrder.mutate() : createLabOrder.mutate()} disabled={(editingOrder ? updateLabOrder.isPending : createLabOrder.isPending) || selectedTests.length === 0}>
              {(editingOrder ? updateLabOrder.isPending : createLabOrder.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {editingOrder ? 'Update Order' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={prescriptionModalOpen} onOpenChange={(open) => { if (!open) cancelEdit(); setPrescriptionModalOpen(open); }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editingPrescription ? 'Edit Prescription' : 'Prescribe Medication'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Search Medications</Label>
              <Input value={searchMedication} onChange={(e) => setSearchMedication(e.target.value)} placeholder="Search to filter medications..." className="mt-1" />
              <ScrollArea className="h-80 mt-2 border rounded-lg">
                {filteredMedications.map((med: Medication) => (
                  <div key={med._id} className={cn("p-3 border-b last:border-b-0 flex items-center justify-between", (med.stockQuantity || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed bg-muted/20")} onClick={() => (med.stockQuantity || 0) > 0 && addMedicationToPrescription(med)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{med.name}</p>
                        {med.__cafProduct && <Badge variant="outline" className="text-[10px] flex-shrink-0">CAF</Badge>}
                      </div>
                      {med.genericName && <p className="text-xs text-muted-foreground truncate">{med.genericName}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {med.dosageForm && <span>{med.dosageForm}</span>}
                        {med.unit && <span>| {med.unit}</span>}
                        <span className="font-medium text-foreground">Le {(med.unitPrice || 0).toLocaleString()}</span>
                      </div>
                      <p className={cn("text-xs mt-0.5", (med.stockQuantity || 0) > 0 ? "text-emerald-600" : "text-red-600")}>{(med.stockQuantity || 0) > 0 ? `${med.stockQuantity} in stock` : 'Out of stock'}</p>
                    </div>
                    {(med.stockQuantity || 0) > 0 ? <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <Badge variant="destructive" className="flex-shrink-0">No stock</Badge>}
                  </div>
                ))}
              </ScrollArea>
            </div>
            <div>
              <Label className="text-sm font-medium">Prescription Items ({prescriptionItems.length})</Label>
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {prescriptionItems.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Click medications to add them</div>
                ) : (
                  <div className="divide-y">
                    {prescriptionItems.map((item, index) => (
                      <div key={index} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{item.medicationName}</p>
                          <Button variant="ghost" size="sm" onClick={() => removePrescriptionItem(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Dosage (e.g., 500mg)" value={item.dosage} onChange={(e) => updatePrescriptionItem(index, 'dosage', e.target.value)} className="h-8 text-xs" />
                          <Input placeholder="Frequency (e.g., 3x daily)" value={item.frequency} onChange={(e) => updatePrescriptionItem(index, 'frequency', e.target.value)} className="h-8 text-xs" />
                          <Input placeholder="Duration (e.g., 7 days)" value={item.duration} onChange={(e) => updatePrescriptionItem(index, 'duration', e.target.value)} className="h-8 text-xs" />
                          <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updatePrescriptionItem(index, 'quantity', parseInt(e.target.value) || 1)} className="h-8 text-xs" />
                        </div>
                        <Input placeholder="Patient instructions" value={item.instructions} onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)} className="h-8 text-xs mt-2" />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {prescriptionItems.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Total: Le {prescriptionItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button onClick={() => editingPrescription ? updatePrescription.mutate() : createPrescription.mutate()} disabled={(editingPrescription ? updatePrescription.isPending : createPrescription.isPending) || prescriptionItems.length === 0 || prescriptionItems.some(i => !i.dosage || !i.frequency || !i.duration)}>
              {(editingPrescription ? updatePrescription.isPending : createPrescription.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {editingPrescription ? 'Update Prescription' : 'Create Prescription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={referralOpen} onOpenChange={setReferralOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Refer to Specialist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Specialist</Label>
              <Select value={referralForm.specialistId} onValueChange={(v) => setReferralForm({ ...referralForm, specialistId: v })}>
                <SelectTrigger><SelectValue placeholder="Select specialist" /></SelectTrigger>
                <SelectContent>
                  {specialists.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No specialists registered.</div>
                  ) : specialists.map((s: any) => (
                    <SelectItem key={s._id} value={s._id}>{s.fullName} - {s.specialty?.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason for Referral *</Label>
              <Input value={referralForm.reason} onChange={(e) => setReferralForm({ ...referralForm, reason: e.target.value })} placeholder="e.g., Suspected cardiac arrhythmia" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={referralForm.notes} onChange={(e) => setReferralForm({ ...referralForm, notes: e.target.value })} rows={3} placeholder="Relevant history, findings…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferralOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!selectedVisit) return;
                try {
                  await referToSpecialist.mutateAsync({ visitId: selectedVisit._id || selectedVisit.id || '', data: referralForm });
                  toast.success('Patient referred to specialist');
                  setReferralOpen(false);
                  setReferralForm({ specialistId: '', reason: '', notes: '' });
                  setSelectedVisit(null);
                } catch { toast.error('Failed to refer patient'); }
              }}
              disabled={referToSpecialist.isPending || !referralForm.specialistId || !referralForm.reason}
            >
              {referToSpecialist.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              Refer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={admitOpen} onOpenChange={setAdmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Admit Patient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ward Type</Label>
                <Select value={admitForm.wardType} onValueChange={(v) => setAdmitForm({ ...admitForm, wardType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="icu">ICU</SelectItem>
                    <SelectItem value="maternity">Maternity</SelectItem>
                    <SelectItem value="pediatric">Pediatric</SelectItem>
                    <SelectItem value="isolation">Isolation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bed Number</Label>
                <Input value={admitForm.bedNumber} onChange={(e) => setAdmitForm({ ...admitForm, bedNumber: e.target.value })} placeholder="e.g., B-12" />
              </div>
            </div>
            <div>
              <Label>Admission Reason *</Label>
              <Input value={admitForm.admissionReason} onChange={(e) => setAdmitForm({ ...admitForm, admissionReason: e.target.value })} placeholder="Primary reason for admission" />
            </div>
            <div>
              <Label>Working Diagnosis</Label>
              <Input value={admitForm.diagnosis} onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={admitForm.notes} onChange={(e) => setAdmitForm({ ...admitForm, notes: e.target.value })} rows={3} placeholder="Handoff notes for the nursing team…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitOpen(false)}>Cancel</Button>
            <Button onClick={() => createAdmission.mutate()} disabled={createAdmission.isPending || !admitForm.admissionReason}>
              {createAdmission.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BedDouble className="w-4 h-4 mr-2" />}
              Admit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
