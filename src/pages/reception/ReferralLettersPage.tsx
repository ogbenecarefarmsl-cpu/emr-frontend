import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Loader2, Printer, Search, Stethoscope } from 'lucide-react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useVisits } from '@/hooks/useVisits';

function getPatient(visit: any) {
  return typeof visit.patientId === 'object' ? visit.patientId : visit.patient;
}

function getDoctor(visit: any) {
  return typeof visit.doctorId === 'object' ? visit.doctorId : visit.doctor;
}

function getPatientName(visit: any) {
  const patient = getPatient(visit);
  const firstName = patient?.firstName || patient?.first_name || '';
  const lastName = patient?.lastName || patient?.last_name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown patient';
}

function getReferralTarget(visit: any) {
  const specialist = visit.referredToSpecialistId || visit.specialistId || visit.referredTo;
  if (typeof specialist === 'object') {
    return specialist.fullName || specialist.name || specialist.specialty || 'Specialist';
  }
  return visit.referralTarget || visit.referredToName || 'Specialist / receiving facility';
}

export default function ReferralLettersPage() {
  const { profile, primaryRole } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const { data: visits = [], isLoading } = useVisits('referred');

  const filteredVisits = useMemo(() => {
    const list = Array.isArray(visits) ? visits : [];
    const query = search.trim().toLowerCase();
    if (!query) return list;

    return list.filter((visit: any) => {
      const patient = getPatient(visit);
      const doctor = getDoctor(visit);
      return [
        getPatientName(visit),
        patient?.patientId,
        patient?.mrn,
        visit.visitNumber,
        doctor?.fullName,
        getReferralTarget(visit),
        visit.referralReason,
      ].some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [visits, search]);

  const printLetter = (visit: any) => {
    setSelectedVisit(visit);
    window.setTimeout(() => window.print(), 150);
  };

  const selectedPatient = selectedVisit ? getPatient(selectedVisit) : null;
  const selectedDoctor = selectedVisit ? getDoctor(selectedVisit) : null;

  return (
    <RoleLayout
      title="Referral Letters"
      subtitle="Print doctor-generated referral letters for patients leaving reception"
      role={primaryRole || 'receptionist'}
      userName={profile?.fullName}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #referral-letter-print, #referral-letter-print * { visibility: visible; }
          #referral-letter-print { position: absolute; inset: 0; padding: 24px; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-4 mb-6">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient, hospital number, doctor, or referral reason"
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">{filteredVisits.length} referral(s)</Badge>
      </div>

      <div className="no-print bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No referred visits found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Visit</th>
                <th>Referring Doctor</th>
                <th>Receiving Doctor</th>
                <th>Reason</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.map((visit: any) => {
                const patient = getPatient(visit);
                const doctor = getDoctor(visit);
                const visitId = visit._id || visit.id;

                return (
                  <tr key={visitId}>
                    <td>
                      <p className="font-medium">{getPatientName(visit)}</p>
                      <p className="text-xs text-muted-foreground">{patient?.patientId || patient?.mrn || 'No hospital number'}</p>
                    </td>
                    <td>
                      <p className="font-mono text-sm">{visit.visitNumber || '-'}</p>
                      <p className="text-xs text-muted-foreground">
                        {visit.createdAt ? format(new Date(visit.createdAt), 'MMM dd, yyyy') : '-'}
                      </p>
                    </td>
                    <td>{doctor?.fullName || 'Doctor'}</td>
                    <td>{getReferralTarget(visit)}</td>
                    <td className="max-w-xs truncate">{visit.referralReason || '-'}</td>
                    <td>
                      <div className="flex justify-center">
                        <Button size="sm" onClick={() => printLetter(visit)} className="gap-2">
                          <Printer className="w-4 h-4" />
                          Print Letter
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!selectedVisit} onOpenChange={(open) => !open && setSelectedVisit(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="no-print">
            <DialogTitle>Referral Letter Preview</DialogTitle>
          </DialogHeader>

          {selectedVisit && (
            <div id="referral-letter-print" className="bg-white text-slate-950 space-y-6">
              <div className="border-b pb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Harbour EMR</h1>
                  <p className="text-sm text-slate-600">Clinical Referral Letter</p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>{format(new Date(), 'PPP')}</p>
                  <p>{selectedVisit.visitNumber || ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Patient</p>
                  <p className="font-semibold">{getPatientName(selectedVisit)}</p>
                  <p>{selectedPatient?.patientId || selectedPatient?.mrn || ''}</p>
                </div>
                <div>
                  <p className="text-slate-500">Referred To</p>
                  <p className="font-semibold">{getReferralTarget(selectedVisit)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Age / Gender</p>
                  <p>{selectedPatient?.age || '-'} / {selectedPatient?.gender || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Referring Doctor</p>
                  <p>{selectedDoctor?.fullName || 'Doctor'}</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-7">
                <section>
                  <h2 className="font-semibold flex items-center gap-2 text-base">
                    <Stethoscope className="w-4 h-4" />
                    Reason for Referral
                  </h2>
                  <p>{selectedVisit.referralReason || 'Referral reason was not specified.'}</p>
                </section>

                <section>
                  <h2 className="font-semibold flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4" />
                    Clinical Notes
                  </h2>
                  <p>{selectedVisit.referralNotes || selectedVisit.notes || selectedVisit.chiefComplaint || 'No additional notes recorded.'}</p>
                </section>
              </div>

              <div className="pt-12 grid grid-cols-2 gap-12 text-sm">
                <div className="border-t pt-2">Referring doctor signature</div>
                <div className="border-t pt-2">Receiving unit acknowledgement</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
