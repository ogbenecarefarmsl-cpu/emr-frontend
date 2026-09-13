import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InsuranceStatusBadge } from '@/components/insurance/InsuranceStatusBadge';
import { Loader2, UserCheck, Search, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoctorAllPatientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorPatientsTotal: number;
  doctorPatientsQuery: any;
  allPatientsSearch: string;
  setAllPatientsSearch: (v: string) => void;
  allPatientsDaysBack: number | undefined;
  setAllPatientsDaysBack: (v: number | undefined) => void;
  allPatientsPage: number;
  setAllPatientsPage: (fn: (p: number) => number) => void;
  onSelectPatient: (patient: any) => void;
  selectedPatientId?: string;
}

export function DoctorAllPatientsModal({
  open,
  onOpenChange,
  doctorPatientsTotal,
  doctorPatientsQuery,
  allPatientsSearch,
  setAllPatientsSearch,
  allPatientsDaysBack,
  setAllPatientsDaysBack,
  allPatientsPage,
  setAllPatientsPage,
  onSelectPatient,
  selectedPatientId,
}: DoctorAllPatientsModalProps) {
  const doctorPatients = doctorPatientsQuery.data?.patients || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            All My Patients
            <Badge variant="secondary" className="ml-1">{doctorPatientsTotal}</Badge>
          </DialogTitle>
          <DialogDescription>Jump to any patient you have seen, with their latest visit attached.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={allPatientsSearch}
              onChange={(e) => { setAllPatientsSearch(e.target.value); setAllPatientsPage(() => 1); }}
              placeholder="Search by name, ID, phone, or email..."
              className="pl-8"
            />
          </div>
          <Select
            value={allPatientsDaysBack?.toString() || 'all'}
            onValueChange={(v) => { setAllPatientsDaysBack(v === 'all' ? undefined : parseInt(v, 10)); setAllPatientsPage(() => 1); }}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <Calendar className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="flex-1 min-h-0 -mx-2 px-2">
          {doctorPatientsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading patients...
            </div>
          ) : doctorPatients.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {allPatientsSearch ? `No patients matching "${allPatientsSearch}"` : 'No patients yet'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {doctorPatients.map((p: any) => {
                const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Unnamed';
                const isSelected = selectedPatientId === p._id;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => onSelectPatient(p)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{(p.firstName?.[0] || '')}{(p.lastName?.[0] || '')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold truncate">{fullName}</p>
                          {p.allergies?.length > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-red-50 text-red-700 border-red-200">
                              Allergy
                            </Badge>
                          )}
                          {p.chronicConditions?.length > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                              {p.chronicConditions.length} chronic
                            </Badge>
                          )}
                          <InsuranceStatusBadge insurance={p.insurance} compact className="h-4 px-1 py-0 text-[9px]" />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {p.patientId} · {p.age ? `${p.age}${p.ageUnit || 'y'}` : '—'} · {p.gender || 'N/A'}
                          {p.phone ? ` · ${p.phone}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-[10px] text-muted-foreground">Last visit</p>
                        <p className="text-xs font-medium">{p.lastVisitDate ? new Date(p.lastVisitDate).toLocaleDateString() : 'N/A'}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{p.lastVisitStatus?.replace(/_/g, ' ') || ''}</p>
                      </div>
                    </div>
                    {p.lastChiefComplaint && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 italic truncate">Last: {p.lastChiefComplaint}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        {doctorPatientsTotal > 25 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {(allPatientsPage - 1) * 25 + 1}-{Math.min(allPatientsPage * 25, doctorPatientsTotal)} of {doctorPatientsTotal}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={allPatientsPage === 1} onClick={() => setAllPatientsPage(p => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={allPatientsPage * 25 >= doctorPatientsTotal} onClick={() => setAllPatientsPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
