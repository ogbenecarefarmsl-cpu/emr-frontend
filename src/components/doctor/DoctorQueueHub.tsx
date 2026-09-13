import { User, Users, FlaskConical, CheckCircle2, Activity, Zap, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DoctorQueueHubProps {
  stats: {
    seen: number;
    waiting: number;
    completed: number;
  };
  waitingQueue: any[];
  resultsReady: any[];
  activePatients: any[];
  incomingReferrals?: any[];
  onSelectVisit: (visit: any, tab?: string) => void;
  onAcceptVisit: (visit: any) => void;
  onAcceptNext: () => void;
  acceptPending?: boolean;
}

export function DoctorQueueHub({
  stats,
  waitingQueue = [],
  resultsReady = [],
  activePatients = [],
  incomingReferrals = [],
  onSelectVisit,
  onAcceptVisit,
  onAcceptNext,
  acceptPending,
}: DoctorQueueHubProps) {
  const patientDisplayName = (visit: any) => {
    const p = visit?.patientId;
    return [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || 'Unnamed Patient';
  };

  const patientAgeGender = (visit: any) => {
    const p = visit?.patientId;
    const age = p?.age ? `${p.age}y` : '';
    const gender = p?.gender ? p.gender[0].toUpperCase() : '';
    return [age, gender].filter(Boolean).join(' · ');
  };

  // Urgent triage patients waiting
  const urgentPatients = waitingQueue.filter((v: any) =>
    v.triagePriority?.includes('urgent') || v.triagePriority?.includes('emergency')
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 p-4 md:p-6 select-none">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Top Summary Pulse Bar with 1-Click Call Next */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{waitingQueue.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Waiting in Queue</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <FlaskConical className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{resultsReady.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Results to Review</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{activePatients.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Active Consults</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{stats.completed || 0}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Seen Today</p>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6">
            <Button
              size="lg"
              onClick={onAcceptNext}
              disabled={acceptPending || waitingQueue.length === 0}
              className="w-full md:w-auto h-11 px-5 bg-teal-700 hover:bg-teal-800 text-white font-medium shadow-sm gap-2"
            >
              <Zap className="h-4 w-4" />
              <span>Call Next Patient</span>
            </Button>
          </div>
        </div>

        {/* 1. Urgent Triage Alert Queue (Top Priority) */}
        {urgentPatients.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
                <span>Urgent Priority Waiting ({urgentPatients.length})</span>
              </div>
              <span className="text-xs text-red-700 font-medium">Requires immediate attention</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {urgentPatients.map((visit) => (
                <div
                  key={visit._id}
                  className="bg-white rounded-lg border border-red-200 p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:border-red-400 transition-colors cursor-pointer"
                  onClick={() => onAcceptVisit(visit)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-950 truncate">
                        {patientDisplayName(visit)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {patientAgeGender(visit)} · <span className="font-mono text-[11px]">{visit.patientId?.patientId || visit.visitNumber}</span>
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-[10px] h-5 uppercase shrink-0 font-semibold">
                      {visit.triagePriority?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {visit.chiefComplaint && (
                    <p className="text-xs text-slate-700 font-medium truncate">
                      "{visit.chiefComplaint}"
                    </p>
                  )}
                  <Button size="sm" variant="destructive" className="w-full h-8 text-xs font-medium">
                    Call Immediately
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Results Ready for Review */}
        {resultsReady.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                <FlaskConical className="h-4 w-4 text-emerald-600" />
                <span>Lab Results Ready for Review ({resultsReady.length})</span>
              </div>
              <span className="text-xs text-emerald-700">LIS testing complete · Ready to chart</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {resultsReady.map((visit) => (
                <div
                  key={visit._id}
                  className="bg-white rounded-lg border border-emerald-200 p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:border-emerald-400 transition-colors cursor-pointer"
                  onClick={() => onSelectVisit(visit, 'lab-results')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-950 truncate">
                        {patientDisplayName(visit)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {patientAgeGender(visit)} · <span className="font-mono text-[11px]">{visit.patientId?.patientId || visit.visitNumber}</span>
                      </p>
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[10px] h-5 shrink-0">
                      Results Ready
                    </Badge>
                  </div>
                  {visit.chiefComplaint && (
                    <p className="text-xs text-slate-600 truncate">
                      Complaint: {visit.chiefComplaint}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-medium border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    Review Results & Prescribe
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Main Waiting Room Queue & Active Encounters Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: General Waiting Queue (2 Cols) */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                <Users className="h-4 w-4 text-slate-500" />
                <span>Waiting Room Queue ({waitingQueue.length})</span>
              </div>
              <span className="text-xs text-slate-400">Order of arrival</span>
            </div>

            {waitingQueue.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <p className="font-medium text-slate-600">No patients waiting in queue</p>
                <p className="text-xs text-slate-400 mt-1">New registrations from reception will appear here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {waitingQueue.map((visit, index) => (
                  <div
                    key={visit._id}
                    className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-slate-950 truncate">
                            {patientDisplayName(visit)}
                          </p>
                          <span className="text-xs text-slate-400 font-medium shrink-0">
                            {patientAgeGender(visit)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {visit.chiefComplaint || 'Routine consultation'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => onAcceptVisit(visit)}
                        disabled={acceptPending}
                        className="h-8 px-3 text-xs bg-teal-700 hover:bg-teal-800 text-white font-medium"
                      >
                        Start Consult
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Active Encounters (1 Col) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                <Activity className="h-4 w-4 text-blue-600" />
                <span>Active Encounters ({activePatients.length})</span>
              </div>
            </div>

            {activePatients.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No consultations currently in progress.
              </div>
            ) : (
              <div className="space-y-2">
                {activePatients.map((visit) => (
                  <div
                    key={visit._id}
                    className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => onSelectVisit(visit)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {patientDisplayName(visit)}
                      </p>
                      <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 capitalize font-medium border-blue-200 bg-blue-50 text-blue-700">
                        {visit.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">
                      {visit.chiefComplaint || 'In progress'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-teal-700 font-medium">
                      <span>Resume encounter</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
