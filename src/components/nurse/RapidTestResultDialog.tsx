import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, TestTube, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAddRapidTestResult } from '@/hooks/useVisits';
import { admissionLocation, patientName } from './nurseUtils';

interface RapidTestResultDialogProps {
  visit: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MALARIA_ANTIGENS = [
  { value: 'p.f', label: 'P. falciparum (HRP-2)' },
  { value: 'pan', label: 'Pan-malaria (pLDH)' },
  { value: 'p.v', label: 'P. vivax (pLDH)' },
];

const TYPHOID_ANTIGENS = [
  { value: 'TOG', label: 'Typhi O antigen' },
  { value: 'TH', label: 'Typhi H antigen' },
  { value: 'IgM', label: 'Salmonella IgM' },
  { value: 'IgG', label: 'Salmonella IgG' },
];

export function RapidTestResultDialog({ visit, open, onOpenChange }: RapidTestResultDialogProps) {
  const qc = useQueryClient();
  const addResult = useAddRapidTestResult();

  const defaultTestType: 'malaria' | 'typhoid' = visit?.serviceType === 'rapid_typhoid' ? 'typhoid' : 'malaria';
  const [testType, setTestType] = useState<'malaria' | 'typhoid'>(defaultTestType);
  const [result, setResult] = useState<'positive' | 'negative'>('negative');
  const [parasiteCount, setParasiteCount] = useState('');
  const [antigen, setAntigen] = useState('');
  const [notes, setNotes] = useState('');

  const existing = (visit?.rapidTestResults || []) as any[];

  const submit = async () => {
    if (!visit) return;
    if (testType === 'malaria' && parasiteCount && (Number(parasiteCount) < 0 || Number(parasiteCount) > 1000000)) {
      toast.error('Parasite count out of range (0-1,000,000 /µL)');
      return;
    }
    try {
      await addResult.mutateAsync({
        visitId: visit._id,
        data: {
          testType,
          result,
          parasiteCount: testType === 'malaria' && parasiteCount ? Number(parasiteCount) : undefined,
          antigen: antigen || undefined,
          notes: notes || undefined,
        },
      });
      toast.success(`Rapid ${testType} test (${result}) recorded`);
      qc.invalidateQueries({ queryKey: ['visits'] });
      setParasiteCount('');
      setAntigen('');
      setNotes('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to record result');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5 text-primary" />
            Rapid Test - {visit?.serviceType === 'rapid_typhoid' ? 'Typhoid' : visit?.serviceType === 'rapid_malaria' ? 'Malaria' : testType}
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">
          {patientName(visit?.patientId)} - {visit?.visitNumber}
        </div>

        {existing.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold">Previous results on this visit</p>
            {[...existing].reverse().slice(0, 3).map((r: any, i: number) => (
              <div key={i} className="text-xs flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium capitalize">{r.testType}</span> -{' '}
                  <span className={r.result === 'positive' ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {r.result}
                  </span>
                  {r.parasiteCount != null && <span className="text-muted-foreground"> - {r.parasiteCount}/µL</span>}
                  {r.antigen && <span className="text-muted-foreground"> - {r.antigen}</span>}
                </div>
                <Badge variant="outline" className="text-[10px]">{new Date(r.performedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label>Test type</Label>
            <Select value={testType} onValueChange={(v) => { setTestType(v as any); setAntigen(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="malaria">Malaria (rapid antigen)</SelectItem>
                <SelectItem value="typhoid">Typhoid (IgM/IgG/TOG/TH)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Result *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setResult('positive')}
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-3 rounded-md border-2 text-sm font-semibold transition-colors',
                  result === 'positive'
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'border-border text-muted-foreground hover:border-red-300',
                )}
              >
                <X className="w-4 h-4" /> POSITIVE
              </button>
              <button
                type="button"
                onClick={() => setResult('negative')}
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-3 rounded-md border-2 text-sm font-semibold transition-colors',
                  result === 'negative'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'border-border text-muted-foreground hover:border-emerald-300',
                )}
              >
                <Check className="w-4 h-4" /> NEGATIVE
              </button>
            </div>
          </div>

          {testType === 'malaria' && (
            <div>
              <Label>Antigen detected</Label>
              <Select value={antigen} onValueChange={setAntigen}>
                <SelectTrigger><SelectValue placeholder="Select antigen (optional)" /></SelectTrigger>
                <SelectContent>
                  {MALARIA_ANTIGENS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {testType === 'malaria' && result === 'positive' && (
            <div>
              <Label>Parasite count (per µL)</Label>
              <Input
                type="number"
                value={parasiteCount}
                onChange={(e) => setParasiteCount(e.target.value)}
                placeholder="e.g., 5000"
                min="0"
                max="1000000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {Number(parasiteCount) > 0 && Number(parasiteCount) < 1000 && 'Low parasitemia'}
                {Number(parasiteCount) >= 1000 && Number(parasiteCount) < 10000 && 'Moderate parasitemia'}
                {Number(parasiteCount) >= 10000 && 'High parasitemia — severe malaria protocol'}
              </p>
            </div>
          )}

          {testType === 'typhoid' && (
            <div>
              <Label>Antigen detected</Label>
              <Select value={antigen} onValueChange={setAntigen}>
                <SelectTrigger><SelectValue placeholder="Select antigen (optional)" /></SelectTrigger>
                <SelectContent>
                  {TYPHOID_ANTIGENS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Clinical context, repeat test, etc."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={addResult.isPending}>
            {addResult.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1" />}
            Save result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
