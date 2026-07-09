import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  UserCheck, Search, Bell, Clock, AlertTriangle, FlaskConical,
  ChevronDown, X, Stethoscope, LogOut, LayoutDashboard
} from 'lucide-react';

interface Patient {
  _id: string;
  firstName?: string;
  lastName?: string;
  patientId?: string;
  age?: number;
  gender?: string;
  phone?: string;
}

interface Visit {
  _id: string;
  id?: string;
  visitNumber: string;
  patientId: Patient | any;
  status: string;
  chiefComplaint?: string;
  triagePriority?: string;
  room?: string;
  consultationStartedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Notification {
  id: string;
  type: 'queue' | 'results' | 'status' | 'admission';
  title: string;
  message: string;
  visitId?: string;
  patientName?: string;
  createdAt: string;
  read: boolean;
}

interface DoctorTopBarProps {
  profile?: { fullName?: string } | null;
  activePatients: Visit[];
  waitingQueue: Visit[];
  resultsReady: Visit[];
  selectedVisitId?: string;
  onSelectVisit: (visit: Visit) => void;
  onAcceptVisit: (visit: Visit) => void;
  onSelectPatient: (patient: Patient) => void;
  onAcceptNext: () => void;
  onOpenDashboard?: () => void;
  onOpenResults?: () => void;
  onOpenAllPatients?: () => void;
  onLogout?: () => void;
  acceptPending?: boolean;
}

const patientDisplayName = (visit?: Visit | null) => {
  const patient = visit?.patientId;
  const name = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Unnamed';
};

const statusTone = (status?: string) => {
  switch (status) {
    case 'in_consultation': return 'bg-blue-500';
    case 'results_ready': return 'bg-emerald-500';
    case 'awaiting_lab':
    case 'awaiting_results':
    case 'awaiting_pharmacy':
    case 'awaiting_dispensing':
    case 'awaiting_doctor_review': return 'bg-amber-500';
    case 'admitted': return 'bg-rose-500';
    default: return 'bg-slate-400';
  }
};

const statusLabel = (status?: string) => status?.replace(/_/g, ' ') || 'unknown';

function useClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

export function DoctorTopBar({
  profile,
  activePatients,
  waitingQueue,
  resultsReady,
  selectedVisitId,
  onSelectVisit,
  onAcceptVisit,
  onSelectPatient,
  onAcceptNext,
  onOpenDashboard,
  onOpenResults,
  onOpenAllPatients,
  onLogout,
  acceptPending,
}: DoctorTopBarProps) {
  const [queueOpen, setQueueOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const queueRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useClickOutside(queueRef, () => setQueueOpen(false));
  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(searchRef, () => setSearchFocused(false));

  // Build notifications from dashboard data
  useEffect(() => {
    const next: Notification[] = [];

    if (waitingQueue.length > 0) {
      waitingQueue.forEach((v) => {
        next.push({
          id: `queue-${v._id}`,
          type: 'queue',
          title: 'New patient in queue',
          message: `${patientDisplayName(v)} — ${v.chiefComplaint || 'No complaint'}`,
          visitId: v._id,
          patientName: patientDisplayName(v),
          createdAt: v.triagedAt || v.createdAt,
          read: false,
        });
      });
    }

    if (resultsReady.length > 0) {
      resultsReady.forEach((v) => {
        next.push({
          id: `results-${v._id}`,
          type: 'results',
          title: 'Results ready',
          message: `${patientDisplayName(v)} — ${v.visitNumber}`,
          visitId: v._id,
          patientName: patientDisplayName(v),
          createdAt: v.updatedAt,
          read: false,
        });
      });
    }

    // Status changes among active patients
    activePatients.forEach((v) => {
      if (v.status === 'awaiting_doctor_review') {
        next.push({
          id: `status-${v._id}`,
          type: 'status',
          title: 'Status changed',
          message: `${patientDisplayName(v)} — awaiting doctor review`,
          visitId: v._id,
          patientName: patientDisplayName(v),
          createdAt: v.updatedAt,
          read: false,
        });
      }
    });

    setNotifications((prev) => {
      const merged = [...prev];
      next.forEach((n) => {
        const idx = merged.findIndex((p) => p.id === n.id);
        if (idx === -1) merged.push(n);
      });
      return merged.slice(-50);
    });
  }, [waitingQueue, resultsReady, activePatients]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Patient search debounce
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { patientService } = await import('@/services/patientService');
        const data = await patientService.search(search.trim());
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSelectSearchPatient = (patient: Patient) => {
    onSelectPatient(patient);
    setSearch('');
    setSearchResults([]);
    setSearchFocused(false);
  };

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const activeVisible = activePatients.slice(0, 4);
  const activeOverflow = activePatients.length > 4;

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-slate-900 text-white z-[60] flex items-center justify-between gap-3 px-4 shadow-md">
      {/* Left: logo + active patients */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm hidden sm:block">Harbour EMR</span>
        </div>

        <div className="h-6 w-px bg-slate-700 hidden sm:block" />

        {/* Active patients chips */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {activeVisible.map((visit) => {
            const isSelected = visit._id === selectedVisitId;
            const initials = `${visit.patientId?.firstName?.[0] || ''}${visit.patientId?.lastName?.[0] || ''}`.toUpperCase();
            const hasResults = resultsReady.some((r) => r._id === visit._id);
            return (
              <button
                key={visit._id}
                onClick={() => onSelectVisit(visit)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs shrink-0 transition-colors border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                )}
                title={`${patientDisplayName(visit)} · ${statusLabel(visit.status)}${visit.room ? ` · ${visit.room}` : ''}`}
              >
                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-bold">
                  {initials || '?'}
                  <span className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-slate-900", statusTone(visit.status))} />
                </span>
                <span className="hidden md:inline max-w-[80px] truncate">{patientDisplayName(visit)}</span>
                {hasResults && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-400" />}
              </button>
            );
          })}
          {activeOverflow && (
            <span className="text-[10px] text-slate-400 px-1">+{activePatients.length - 4}</span>
          )}
          {activePatients.length === 0 && (
            <span className="text-xs text-slate-500 hidden sm:block">No active patients</span>
          )}
        </div>
      </div>

      {/* Right: queue, notifications, search, accept next, profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Queue dropdown */}
        <div className="relative" ref={queueRef}>
          <button
            onClick={() => setQueueOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors relative",
              queueOpen ? "bg-slate-800" : "hover:bg-slate-800",
              waitingQueue.length > 0 ? "text-white" : "text-slate-400"
            )}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Queue</span>
            {waitingQueue.length > 0 && (
              <Badge className="h-4 min-w-4 text-[10px] bg-primary hover:bg-primary text-white px-1">
                {waitingQueue.length}
              </Badge>
            )}
            <ChevronDown className="w-3 h-3" />
          </button>

          {queueOpen && (
            <div className="absolute top-9 right-0 w-80 bg-white text-foreground border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold">Waiting Queue</p>
                <span className="text-[10px] text-muted-foreground">{waitingQueue.length} patient{waitingQueue.length !== 1 ? 's' : ''}</span>
              </div>
              <ScrollArea className="max-h-80">
                {waitingQueue.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">No patients waiting</p>
                ) : (
                  <div className="divide-y">
                    {waitingQueue.map((visit) => (
                      <div key={visit._id} className="p-3 hover:bg-muted/50">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{patientDisplayName(visit)}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{visit.visitNumber} · {visit.patientId?.patientId || 'N/A'}</p>
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            onClick={() => { onAcceptVisit(visit); setQueueOpen(false); }}
                            disabled={acceptPending}
                          >
                            Accept
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {visit.triagePriority && (
                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1", visit.triagePriority.includes('emergency') || visit.triagePriority.includes('urgent') ? 'border-red-300 text-red-700 bg-red-50' : '')}>
                              {statusLabel(visit.triagePriority)}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{visit.chiefComplaint || 'No complaint'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Notifications dropdown */}
        {onOpenDashboard && (
          <button
            type="button"
            onClick={onOpenDashboard}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title="Doctor dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
        )}

        {/* Results shortcut */}
        {onOpenResults && (
          <button
            type="button"
            onClick={onOpenResults}
            disabled={resultsReady.length === 0}
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
              resultsReady.length > 0 ? "text-white hover:bg-slate-800" : "text-slate-500 cursor-default"
            )}
            title={`${resultsReady.length} results ready`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Results
            {resultsReady.length > 0 && (
              <Badge className="h-4 min-w-4 text-[10px] bg-slate-700 hover:bg-slate-700 text-white px-1">
                {resultsReady.length}
              </Badge>
            )}
          </button>
        )}

        {/* Notifications dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className={cn(
              "relative p-2 rounded-md transition-colors",
              notifOpen ? "bg-slate-800" : "hover:bg-slate-800"
            )}
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-9 right-0 w-80 bg-white text-foreground border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">Mark all read</button>
                )}
              </div>
              <ScrollArea className="max-h-80">
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">No notifications</p>
                ) : (
                  <div className="divide-y">
                    {notifications.slice().reverse().map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          const visit = [...activePatients, ...waitingQueue, ...resultsReady].find((v) => v._id === n.visitId);
                          if (visit) {
                            onSelectVisit(visit);
                            setNotifOpen(false);
                          }
                        }}
                        className={cn(
                          "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                          !n.read && "bg-blue-50/50"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full shrink-0", n.type === 'results' ? 'bg-emerald-500' : n.type === 'queue' ? 'bg-amber-500' : 'bg-blue-500')} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{n.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{n.message}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Global patient search */}
        <div className="relative hidden md:block" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search any patient…"
              className="h-8 w-44 lg:w-56 pl-7 pr-2 text-xs bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
            />
            {searchLoading && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-slate-600 border-t-primary rounded-full animate-spin" />
            )}
          </div>
          {searchFocused && search.trim().length >= 2 && (
            <div className="absolute top-9 right-0 w-72 bg-white text-foreground border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              {searchResults.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground text-center">{searchLoading ? 'Searching…' : 'No patients found'}</p>
              ) : (
                <ScrollArea className="max-h-72">
                  <div className="divide-y">
                    {searchResults.slice(0, 8).map((p) => {
                      const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Unnamed';
                      return (
                        <button
                          key={p._id}
                          onClick={() => handleSelectSearchPatient(p)}
                          className="w-full text-left p-2.5 hover:bg-muted/50"
                        >
                          <p className="text-xs font-medium">{name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.patientId || p._id} · {p.age ? `${p.age}y` : ''} {p.gender || ''}</p>
                          {p.insurance?.programCode && (
                            <p className="text-[10px] text-blue-600 font-medium">{p.insurance.programCode}{p.insurance.subEntityCode ? ` / ${p.insurance.subEntityCode}` : ''}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        {onOpenAllPatients && (
          <button
            type="button"
            onClick={onOpenAllPatients}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title="All My Patients"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Patients
          </button>
        )}

        {/* Accept next */}
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={onAcceptNext}
          disabled={waitingQueue.length === 0 || acceptPending}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Accept</span>
          {waitingQueue.length > 0 && <span className="text-[10px]">({waitingQueue.length})</span>}
        </Button>

        {/* Profile */}
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-700">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-[10px] font-bold">{profile?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
          </div>
          <span className="text-xs truncate max-w-24">{profile?.fullName}</span>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="ml-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
