import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsAPI } from '@/services/api';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, User } from 'lucide-react';

interface PatientSearchProps {
  onSelect: (patient: any) => void;
  placeholder?: string;
}

export function PatientSearch({ onSelect, placeholder = 'Search patients...' }: PatientSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const response = await patientsAPI.getAll({ search: query, limit: 10 });
      return response.patients || [];
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (patient: any) => {
    onSelect(patient);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : patients && patients.length > 0 ? (
            <ScrollArea className="h-64">
              {patients.map((patient: any) => (
                <button
                  key={patient._id || patient.id}
                  className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 flex items-center gap-3"
                  onClick={() => handleSelect(patient)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {patient.patientId} • {patient.gender === 'M' ? 'Male' : 'Female'} • {patient.age} {patient.ageUnit || 'years'}
                    </p>
                  </div>
                </button>
              ))}
            </ScrollArea>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No patients found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
