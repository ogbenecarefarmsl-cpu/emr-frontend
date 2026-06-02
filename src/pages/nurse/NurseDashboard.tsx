import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAwaitingTriage } from '@/hooks/useVisits';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TriageQueuePanel } from '@/components/nurse/TriageQueuePanel';
import { TriageDialog } from '@/components/nurse/TriageDialog';
import { MedicationWorklist, MedicationDueBadge, getScheduledMeds, getDueNow } from '@/components/nurse/MedicationWorklist';
import { MarDialog } from '@/components/nurse/MarDialog';
import { NurseMetrics } from '@/components/nurse/NurseMetrics';
import {
  Activity, Bed, BedDouble, ClipboardCheck, HeartPulse, LogOut, Pill,
} from 'lucide-react';

const NAV_TABS = [
  { id: 'triage', label: 'Triage' },
  { id: 'mar', label: 'MAR' },
  { id: 'observation', label: 'Observation' },
  { id: 'procedures', label: 'Procedures' },
] as const;

type NavTab = (typeof NAV_TABS)[number]['id'];

export default function NurseDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NavTab>('triage');
  const [triageDialogOpen, setTriageDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [marDialogOpen, setMarDialogOpen] = useState(false);
  const [marDialogData, setMarDialogData] = useState<{ admission: any; medications: any[] }>({
    admission: null,
    medications: [],
  });

  const { data: triageQueue = [], isLoading: queueLoading } = useAwaitingTriage();
  const { data: dashboard } = useAdmissionsDashboard(false);
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const stats = dashboard?.stats || { activeTotal: 0, todayAdmissions: 0, todayDischarges: 0, byWard: [] };

  const totalDueNow = activeAdmissions.reduce((sum: number, adm: any) => {
    return sum + getDueNow(getScheduledMeds(adm)).length;
  }, 0);

  const handleOpenTriage = (visit: any) => {
    setSelectedVisit(visit);
    setTriageDialogOpen(true);
  };

  const handleTriageCompleted = () => {
    setTriageDialogOpen(false);
    setSelectedVisit(null);
  };

  const handleOpenMar = (admission: any, medications: any[]) => {
    setMarDialogData({ admission, medications });
    setMarDialogOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex flex-col bg-surface-low overflow-hidden">
      {/* ── Top App Bar (Stitch design system) ── */}
      <header className="bg-white border-b border-outline h-14 flex items-center px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#006194] flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight hidden sm:block">SierraEMR</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono hidden md:block">v2.4</span>

          <nav className="flex items-center gap-1 ml-6">
            {NAV_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {totalDueNow > 0 && (
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 mr-1">
              {totalDueNow} meds due
            </Badge>
          )}
          <div className="w-8 h-8 rounded-full bg-[#894d00]/10 flex items-center justify-center text-xs font-bold text-[#894d00]">
            {(profile?.fullName || 'N')[0]}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-foreground leading-tight">{profile?.fullName}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Nurse</p>
          </div>
          <Button variant="ghost" size="sm" className="ml-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── Metrics Bar ── */}
      <div className="bg-white border-b border-outline px-6 py-3 flex-shrink-0">
        <NurseMetrics triageCount={triageQueue.length} stats={stats} />
      </div>

      {/* ── Main Workspace ── */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'triage' && (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TriageQueuePanel
                  visits={triageQueue}
                  isLoading={queueLoading}
                  onOpenTriage={handleOpenTriage}
                />
              </div>
              <div className="space-y-4">
                <div className="bg-card border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Triage Workflow</h3>
                  </div>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-2"><span className="font-bold text-primary">1.</span>Select a patient from the queue</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">2.</span>Record vital signs and chief complaint</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">3.</span>Assign ESI priority level (1-5)</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">4.</span>Select receiving doctor</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">5.</span>Send to doctor's queue</li>
                  </ol>
                </div>
                <div className="bg-card border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BedDouble className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-sm">Ward Load</h3>
                  </div>
                  <div className="space-y-2">
                    {(stats.byWard || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active ward load</p>
                    ) : (
                      stats.byWard.map((ward: any) => (
                        <div key={ward._id} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-muted-foreground">{ward._id}</span>
                          <Badge variant="outline">{ward.count}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mar' && (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MedicationWorklist
                  admissions={activeAdmissions}
                  onOpenMar={handleOpenMar}
                />
              </div>
              <div className="space-y-4">
                <div className="bg-card border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Pill className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-semibold text-sm">MAR Quick Guide</h3>
                  </div>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-2"><span className="font-bold text-primary">1.</span>View patient medication schedule</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">2.</span>Check "Due Now" badges for time-sensitive meds</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">3.</span>Open MAR to view full schedule</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">4.</span>Record administration in patient's chart</li>
                  </ol>
                </div>
                <div className="bg-card border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Status Summary</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Active Meds</span>
                      <Badge variant="outline">
                        {activeAdmissions.reduce((s: number, a: any) => s + getScheduledMeds(a).length, 0)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Due Now</span>
                      <MedicationDueBadge count={totalDueNow} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'observation' && (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-card border rounded-xl p-8 text-center">
              <HeartPulse className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <h3 className="font-semibold text-lg">Observation Room</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Short-stay monitoring and doctor-review readiness
              </p>
              <Button onClick={() => navigate('/nurse/observation')}>
                <Bed className="w-4 h-4 mr-2" /> Open Observation Workspace
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'procedures' && (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-card border rounded-xl p-8 text-center">
              <ClipboardCheck className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <h3 className="font-semibold text-lg">Procedure Room</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Preparation, procedure support, notes and completion
              </p>
              <Button onClick={() => navigate('/nurse/procedures')}>
                <ClipboardCheck className="w-4 h-4 mr-2" /> Open Procedures Workspace
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* ── Triage Dialog (preserved functionality) ── */}
      <TriageDialog
        visit={selectedVisit}
        open={triageDialogOpen}
        onOpenChange={setTriageDialogOpen}
        onCompleted={handleTriageCompleted}
      />

      {/* ── MAR Dialog (preserved functionality) ── */}
      <MarDialog
        admission={marDialogData.admission}
        medications={marDialogData.medications}
        open={marDialogOpen}
        onOpenChange={setMarDialogOpen}
      />
    </div>
  );
}
