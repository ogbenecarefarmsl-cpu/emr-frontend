import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { admissionLocation, patientName } from './nurseUtils';
import { BedDouble, ChevronRight, Loader2 } from 'lucide-react';

interface AdmissionListProps {
  admissions: any[];
  isLoading?: boolean;
  selectedAdmissionId?: string | null;
  onSelect: (admission: any) => void;
  title?: string;
  maxHeightClassName?: string;
}

export function AdmissionList({
  admissions,
  isLoading,
  selectedAdmissionId,
  onSelect,
  title = 'Active Admissions',
  maxHeightClassName = 'max-h-[calc(100vh-340px)]',
}: AdmissionListProps) {
  return (
    <div className="bg-card border rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-primary" />
          {title}
        </h3>
        <Badge variant="secondary">{admissions.length}</Badge>
      </div>
      <ScrollArea className={maxHeightClassName}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : admissions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm px-4">
            No active admissions
          </div>
        ) : (
          <div className="divide-y">
            {admissions.map((admission) => (
              <button
                key={admission._id}
                type="button"
                className={cn(
                  'w-full text-left p-3 hover:bg-muted/50 transition-colors',
                  selectedAdmissionId === admission._id && 'bg-primary/5 border-l-2 border-primary',
                )}
                onClick={() => onSelect(admission)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{patientName(admission.patientId)}</p>
                      {admission.codeStatus && admission.codeStatus !== 'full_code' && (
                        <Badge variant="destructive" className="text-[9px] h-4 uppercase px-1">
                          {admission.codeStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{admission.admissionNumber}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] h-4 capitalize">
                        {admissionLocation(admission)}
                      </Badge>
                      {admission.wardType === 'icu' && (
                        <Badge className="text-[10px] h-4 bg-red-500">ICU</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {admission.admissionReason}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
