import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ClipboardCheck, ClipboardList, FileText, LogOut,
  Search, Stethoscope, Syringe, User,
} from 'lucide-react';

const PROCEDURE_STATS = [
  { label: 'Awaiting Prep', value: 0, color: 'text-amber-600 bg-amber-500/10' },
  { label: 'In Procedure', value: 0, color: 'text-blue-600 bg-blue-500/10' },
  { label: 'Awaiting Note', value: 0, color: 'text-purple-600 bg-purple-500/10' },
  { label: 'Completed Today', value: 0, color: 'text-green-600 bg-green-500/10' },
];

export default function NurseProceduresPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex flex-col bg-surface-low overflow-hidden">
      {/* ── Top App Bar ── */}
      <header className="bg-white border-b border-outline h-14 flex items-center px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-3 flex-1">
          <button onClick={() => navigate('/nurse')} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs font-medium">Back</span>
          </button>
          <div className="w-px h-5 bg-outline mx-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Procedure Room</h1>
              <p className="text-[10px] text-muted-foreground">Preparation, procedure support & completion</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* ── Stats Bar ── */}
      <div className="bg-white border-b border-outline px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {PROCEDURE_STATS.map(stat => (
            <div key={stat.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', stat.color)}>
                {stat.label.includes('Prep') ? <Syringe className="w-3.5 h-3.5" /> :
                 stat.label.includes('Procedure') ? <ClipboardCheck className="w-3.5 h-3.5" /> :
                 stat.label.includes('Note') ? <FileText className="w-3.5 h-3.5" /> :
                 <ClipboardList className="w-3.5 h-3.5" />}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                <p className="text-sm font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="flex-1 flex overflow-hidden">
        {/* ── Left: Procedure Queue ── */}
        <div className="w-[340px] flex-shrink-0 border-r border-outline bg-white flex flex-col">
          <div className="p-4 border-b border-outline">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-muted-foreground" /> Procedure Queue
              </h2>
              <Badge variant="secondary" className="text-xs">0</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-muted/40"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-purple-500/5 flex items-center justify-center mb-4">
                <ClipboardCheck className="w-8 h-8 text-purple-300" />
              </div>
              <p className="text-sm font-medium">No procedures scheduled</p>
              <p className="text-xs text-center mt-1 px-6">
                Patients with ordered procedures will appear here for preparation and room assignment
              </p>
            </div>
          </ScrollArea>
        </div>

        {/* ── Right: Patient Detail / Empty State ── */}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-10 h-10 text-primary/30" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Select a procedure to begin</h3>
            <p className="text-sm text-muted-foreground">
              Choose a patient from the procedure queue to prepare the room, record procedure details, and complete the procedure note.
            </p>
            <div className="mt-6 space-y-2 text-left">
              <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
                <Syringe className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Prepare room and equipment for procedure</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
                <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span>Verify patient identity and consent</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
                <FileText className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Record procedure notes and completion status</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
