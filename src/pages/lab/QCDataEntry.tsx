import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useMachines } from '@/hooks/useMachines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Save, TrendingUp, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { qcAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function QCDataEntry() {
  const { profile, user } = useAuth();
  const { data: machines } = useMachines();
  const queryClient = useQueryClient();

  const [selectedMachine, setSelectedMachine] = useState('');
  const [testCode, setTestCode] = useState('');
  const [level, setLevel] = useState<'level_1' | 'level_2' | 'level_3'>('level_1');
  const [value, setValue] = useState('');
  const [lotNumber, setLotNumber] = useState('');

  // Fetch QC samples
  const { data: qcSamples } = useQuery({
    queryKey: ['qc-samples', selectedMachine],
    queryFn: async () => {
      const params = selectedMachine ? { machineId: selectedMachine } : {};
      return await qcAPI.getSamples(params);
    }
  });

  // Fetch recent QC results
  const { data: recentResults } = useQuery({
    queryKey: ['qc-results', selectedMachine],
    queryFn: async () => {
      return await qcAPI.getResults({ limit: 20 });
    }
  });

  // Add QC result
  const addResult = useMutation({
    mutationFn: async () => {
      if (!selectedMachine || !testCode || !value) {
        throw new Error('Please fill all required fields');
      }

      // Find or create QC sample
      let qcSample = qcSamples?.find((s: any) => 
        s.machineId === selectedMachine && 
        s.testCode === testCode && 
        s.level === level
      );

      if (!qcSample) {
        qcSample = await qcAPI.createSample({
          machineId: selectedMachine,
          testCode,
          level,
          lotNumber: lotNumber || undefined
        });
      }

      // Add result
      await qcAPI.createResult({
        qcSampleId: qcSample.id,
        value: parseFloat(value),
        testedBy: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-results'] });
      queryClient.invalidateQueries({ queryKey: ['qc-samples'] });
      setValue('');
      toast.success('QC result recorded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record QC result');
    }
  });

  return (
    <RoleLayout 
      title="Quality Control Data Entry" 
      subtitle="Record and monitor QC results"
      role="lab_tech"
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold">Enter QC Result</h3>

            <div className="space-y-2">
              <Label>Machine *</Label>
              <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                <SelectTrigger>
                  <SelectValue placeholder="Select machine" />
                </SelectTrigger>
                <SelectContent>
                  {machines?.map(machine => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Test Code *</Label>
              <Input
                placeholder="CBC"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="space-y-2">
              <Label>QC Level *</Label>
              <Select value={level} onValueChange={(v: any) => setLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="level_1">Level 1 (Low)</SelectItem>
                  <SelectItem value="level_2">Level 2 (Normal)</SelectItem>
                  <SelectItem value="level_3">Level 3 (High)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Value *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="12.5"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Lot Number</Label>
              <Input
                placeholder="LOT123"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => addResult.mutate()}
              disabled={addResult.isPending || !selectedMachine || !testCode || !value}
            >
              {addResult.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Record Result
            </Button>
          </div>
        </div>

        {/* Recent Results */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Recent QC Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Machine</th>
                    <th>Test</th>
                    <th>Level</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Tested By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentResults?.map((result: any) => {
                    const machine = machines?.find((m: any) => m.id === result.qcSample?.machineId);
                    return (
                      <tr key={result.id}>
                        <td className="text-sm">
                          {new Date(result.testedAt).toLocaleTimeString()}
                        </td>
                        <td>{machine?.name || 'Unknown'}</td>
                        <td className="font-mono">{result.qcSample?.testCode}</td>
                        <td>
                          <Badge variant="outline">
                            {result.qcSample?.level?.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="font-mono font-semibold">{result.value}</td>
                        <td>
                          {result.isInRange === null ? (
                            <Badge variant="outline">No Target</Badge>
                          ) : result.isInRange ? (
                            <div className="flex items-center gap-1 text-status-normal">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm">In Range</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-status-critical">
                              <XCircle className="w-4 h-4" />
                              <span className="text-sm">Out of Range</span>
                            </div>
                          )}
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {result.testedBy || 'System'}
                        </td>
                      </tr>
                    );
                  })}
                  {(!recentResults || recentResults.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        No QC results recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}