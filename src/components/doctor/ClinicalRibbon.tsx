import { ArrowLeft, Save, CheckCircle2, AlertTriangle, ShieldCheck, Clock, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InsuranceStatusBadge } from '@/components/insurance/InsuranceStatusBadge';
import { cn } from '@/lib/utils';

interface ClinicalRibbonProps {
  patient: any;
  visit?: any;
  isReadOnly?: boolean;
  isChartReview?: boolean;
  isDirty?: boolean;
  canWriteConsultation?: boolean;
  canCloseEncounter?: boolean;
  closureBlockers?: string[];
  vitals: {
    bloodPressure?: string;
    heartRate?: number | string;
    temperature?: number | string;
    oxygenSaturation?: number | string;
  };
  onBackToQueue: () => void;
  onSaveDraft: () => void;
  onCompleteVisit: () => void;
  savePending?: boolean;
  completePending?: boolean;
}

export function ClinicalRibbon({
  patient,
  visit,
  isReadOnly,
  isChartReview,
  isDirty,
  canWriteConsultation,
  canCloseEncounter,
  closureBlockers = [],
  vitals,
  onBackToQueue,
  onSaveDraft,
  onCompleteVisit,
  savePending,
  completePending,
}: ClinicalRibbonProps) {
  const fullName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim() || 'Unnamed Patient';
  const initials = `${patient?.firstName?.[0] || ''}${patient?.lastName?.[0] || ''}`.toUpperCase() || '?';

  const patientAge = () => {
    if (patient?.age) return `${patient.age}y`;
    if (!patient?.dateOfBirth) return '';
    const birthDate = new Date(patient.dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return `${age}y`;
  };

  const tempNum = Number(vitals.temperature || 0);
  const isFever = tempNum >= 38.0;

  return (
    <header className="shrink-0 z-30 border-b border-slate-200 bg-white shadow-xs px-3 sm:px-4 py-2 min-h-[52px] flex items-center justify-between gap-3 select-none">
      {/* Left: Back & Patient Identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToQueue}
          className="h-8 px-2 text-slate-600 hover:text-slate-900 gap-1 shrink-0"
          title="Return to Clinic Queue"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden md:inline text-xs font-medium">Queue</span>
        </Button>

        <div className="h-4 w-px bg-slate-200 shrink-0 hidden sm:block" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-teal-800">{initials}</span>
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-sm font-semibold text-slate-950 truncate max-w-[140px] sm:max-w-[200px] lg:max-w-[260px]" title={fullName}>
                {fullName}
              </h1>
              <span className="text-xs text-slate-500 font-medium shrink-0">
                {patientAge()} {patient?.gender ? `· ${patient.gender[0].toUpperCase()}` : ''}
              </span>
              {visit?.triagePriority && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-4.5 px-1.5 capitalize shrink-0 font-medium",
                    visit.triagePriority.includes('emergency') || visit.triagePriority.includes('urgent')
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  )}
                >
                  {visit.triagePriority.replace('esi_', 'ESI ').replace(/_/g, ' ')}
                </Badge>
              )}
              {isReadOnly && !isChartReview && (
                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-amber-300 bg-amber-50 text-amber-800 shrink-0">
                  View-only
                </Badge>
              )}
              {isChartReview && (
                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-blue-300 bg-blue-50 text-blue-800 shrink-0">
                  Chart Review
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono leading-none mt-0.5">
              <span>{patient?.patientId || visit?.visitNumber || 'PID N/A'}</span>
              {patient?.walletBalance > 0 && (
                <span className="text-emerald-700 font-sans font-medium">
                  Le {Number(patient.walletBalance).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Safety Badge & Key Vitals */}
      <div className="hidden lg:flex items-center gap-3 shrink-0">
        {/* Allergy safety pill */}
        {patient?.allergies?.length > 0 ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 text-xs font-semibold animate-pulse-subtle max-w-[200px] truncate" title={patient.allergies.join(', ')}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
            <span className="truncate">Allergy: {patient.allergies.join(', ')}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 text-xs font-normal">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>No allergies</span>
          </div>
        )}

        <InsuranceStatusBadge
          insurance={visit?.insurance ?? patient?.insurance}
          coverageType={visit?.consultationCoverageType}
          compact
          className="h-5 text-[10px]"
        />

        {/* Live Vitals Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200 text-xs">
          {vitals.bloodPressure && (
            <span className="px-1.5 py-0.5 rounded bg-white font-medium text-slate-800 shadow-2xs">
              <span className="text-[10px] text-slate-400 mr-1">BP</span>
              {vitals.bloodPressure}
            </span>
          )}
          {vitals.heartRate && (
            <span className="px-1.5 py-0.5 rounded bg-white font-medium text-slate-800 shadow-2xs">
              <span className="text-[10px] text-slate-400 mr-1">HR</span>
              {vitals.heartRate}
            </span>
          )}
          {vitals.temperature && (
            <span className={cn(
              "px-1.5 py-0.5 rounded font-medium shadow-2xs",
              isFever ? "bg-red-50 text-red-700 border border-red-200 font-semibold" : "bg-white text-slate-800"
            )}>
              <span className="text-[10px] opacity-60 mr-0.5">T</span>
              {vitals.temperature}°C{isFever ? ' ⚠️' : ''}
            </span>
          )}
          {vitals.oxygenSaturation && (
            <span className="px-1.5 py-0.5 rounded bg-white font-medium text-slate-800 shadow-2xs">
              <span className="text-[10px] text-slate-400 mr-1">SpO2</span>
              {vitals.oxygenSaturation}%
            </span>
          )}
        </div>
      </div>

      {/* Right: Unsaved Status & Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Unsaved dirty pill */}
        {isDirty && canWriteConsultation && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-medium animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="hidden sm:inline">Unsaved</span>
          </span>
        )}

        {/* Save Draft */}
        {canWriteConsultation && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={savePending || !isDirty}
            className="h-8 px-2.5 text-xs gap-1.5 border-slate-300 hover:bg-slate-50"
            title="Save clinical notes (Ctrl + S)"
          >
            <Save className="h-3.5 w-3.5 text-slate-600" />
            <span className="hidden sm:inline">Save Draft</span>
          </Button>
        )}

        {/* Complete Visit */}
        {visit && (
          <Button
            size="sm"
            onClick={onCompleteVisit}
            disabled={!canCloseEncounter || completePending || isReadOnly}
            className={cn(
              "h-8 px-3 text-xs gap-1.5 font-medium shadow-xs",
              canCloseEncounter ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
            title={
              closureBlockers.length > 0
                ? `Cannot complete:\n• ${closureBlockers.join('\n• ')}`
                : "Complete Consultation (Ctrl + Enter)"
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Complete</span>
          </Button>
        )}
      </div>
    </header>
  );
}
