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

export const BED_SIDE_TEST_OPTIONS = [
  { value: 'malaria', label: 'Malaria (Rapid Antigen)' },
  { value: 'typhoid', label: 'Typhoid (IgM / IgG / Widal)' },
  { value: 'blood_glucose', label: 'Bedside Blood Glucose (RBG / FBG)' },
  { value: 'urine_dipstick', label: 'Urine Dipstick (Protein / Glucose / Ketones)' },
  { value: 'pregnancy_test', label: 'Pregnancy Test (Urine hCG)' },
  { value: 'hiv_rdt', label: 'HIV 1/2 Rapid Test' },
  { value: 'hepb_rdt', label: 'Hepatitis B Surface Antigen (HBsAg)' },
  { value: 'syphilis_rdt', label: 'Syphilis (VDRL / RPR Rapid)' },
];

export function RapidTestResultDialog({ visit, open, onOpenChange }: RapidTestResultDialogProps) {
  const qc = useQueryClient();
  const addResult = useAddRapidTestResult();

  const requested = (visit?.rapidTestsRequested || []) as string[];
  const defaultTestType: string = requested[0] || 'malaria';
  const [testType, setTestType] = useState<string>(defaultTestType);
  const [result, setResult] = useState<'positive' | 'negative'>('negative');
  const [parasiteCount, setParasiteCount] = useState('');
  const [glucoseValue, setGlucoseValue] = useState('');
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [antigen, setAntigen] = useState('');
  const [notes, setNotes] = useState('');

  const existing = (visit?.rapidTestResults || []) as any[];

  const submit = async () => {
    if (!visit) return;
    if (testType === 'malaria' && parasiteCount && (Number(parasiteCount) < 0 || Number(parasiteCount) > 1000000)) {
      toast.error('Parasite count out of range (0-1,000,000 /µL)');
      return;
    }
    if (testType === 'blood_glucose' && !glucoseValue) {
      toast.error('Enter blood glucose value');
      return;
    }
    try {
      const fullNotes = [
        testType === 'blood_glucose' && glucoseValue ? `Glucose: ${glucoseValue} ${glucoseUnit}` : '',
        notes,
      ].filter(Boolean).join('; ');

      await addResult.mutateAsync({
        visitId: visit._id,
        data: {
          testType,
          result: testType === 'blood_glucose' 
            ? (Number(glucoseValue) >= 200 || Number(glucoseValue) <= 70 ? 'positive' : 'negative')
            : result,
          parasiteCount: testType === 'malaria' && parasiteCount ? Number(parasiteCount) : undefined,
          antigen: antigen || undefined,
          notes: fullNotes || undefined,
        },
      });
      toast.success(`Rapid test recorded successfully`);
      qc.invalidateQueries({ queryKey: ['visits'] });
      setParasiteCount('');
      setGlucoseValue('');
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
            Bedside Rapid Diagnostic Test
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
                  <span className="font-medium capitalize">{r.testType.replace(/_/g, ' ')}</span> -{' '}
                  <span className={r.result === 'positive' ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {r.result}
                  </span>
                  {r.parasiteCount != null && <span className="text-muted-foreground"> - {r.parasiteCount}/µL</span>}
                  {r.antigen && <span className="text-muted-foreground"> - {r.antigen}</span>}
                  {r.notes && <span className="text-muted-foreground"> ({r.notes})</span>}
                </div>
                <Badge variant="outline" className="text-[10px]">{new Date(r.performedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label>Test type</Label>
            <Select value={testType} onValueChange={(v) => { setTestType(v); setAntigen(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BED_SIDE_TEST_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
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

          {testType === 'blood_glucose' && (
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <Label className="text-xs font-semibold text-slate-800">Blood Glucose Reading *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={glucoseValue}
                  onChange={(e) => setGlucoseValue(e.target.value)}
                  placeholder="e.g., 110"
                  className="flex-1 bg-white"
                />
                <Select value={glucoseUnit} onValueChange={(v) => setGlucoseUnit(v as any)}>
                  <SelectTrigger className="w-28 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mg/dL">mg/dL</SelectItem>
                    <SelectItem value="mmol/L">mmol/L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-slate-500">
                Normal fasting: 70–100 mg/dL · Postprandial: &lt;140 mg/dL · Random &gt;200 indicates hyperglycemia
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
