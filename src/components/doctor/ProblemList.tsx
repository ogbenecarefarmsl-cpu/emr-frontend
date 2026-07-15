import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visitsAPI } from '@/services/api';

interface ProblemListProps {
  visitId: string;
  problems?: Array<{
    code?: string;
    name: string;
    status?: string;
    notedAt?: Date;
  }>;
}

export function ProblemList({ visitId, problems = [] }: ProblemListProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newProblem, setNewProblem] = useState('');
  const [newCode, setNewCode] = useState('');

  const addProblem = useMutation({
    mutationFn: async (data: { code?: string; name: string }) => {
      const visit = await visitsAPI.getById(visitId);
      const updatedProblems = [...(visit.problemList || []), {
        code: data.code || undefined,
        name: data.name,
        status: 'active',
        notedAt: new Date(),
      }];
      return visitsAPI.updateClinicalDraft(visitId, { problemList: updatedProblems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['patient-chart'] });
      toast.success('Problem added');
      setOpen(false);
      setNewProblem('');
      setNewCode('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to add problem');
    },
  });

  const resolveProblem = useMutation({
    mutationFn: async (index: number) => {
      const visit = await visitsAPI.getById(visitId);
      const updatedProblems = [...(visit.problemList || [])];
      if (updatedProblems[index]) {
        updatedProblems[index] = { ...updatedProblems[index], status: 'resolved' };
      }
      return visitsAPI.updateClinicalDraft(visitId, { problemList: updatedProblems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['patient-chart'] });
      toast.success('Problem marked as resolved');
    },
  });

  const removeProblem = useMutation({
    mutationFn: async (index: number) => {
      const visit = await visitsAPI.getById(visitId);
      const updatedProblems = (visit.problemList || []).filter((_: any, i: number) => i !== index);
      return visitsAPI.updateClinicalDraft(visitId, { problemList: updatedProblems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['patient-chart'] });
      toast.success('Problem removed');
    },
  });

  const activeProblems = problems.filter(p => p.status !== 'resolved');
  const resolvedProblems = problems.filter(p => p.status === 'resolved');

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Active Problems</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeProblems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active problems</p>
          ) : (
            <div className="space-y-2">
              {activeProblems.map((problem, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {problem.code && (
                        <Badge variant="outline" className="text-xs font-mono">{problem.code}</Badge>
                      )}
                      <span className="text-sm font-medium">{problem.name}</span>
                    </div>
                    {problem.notedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Noted {new Date(problem.notedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => resolveProblem.mutate(problems.indexOf(problem))}
                      title="Mark as resolved"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => removeProblem.mutate(problems.indexOf(problem))}
                      disabled={removeProblem.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {resolvedProblems.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Resolved ({resolvedProblems.length})
              </p>
              <div className="space-y-1">
                {resolvedProblems.map((problem, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                    {problem.code && <span className="font-mono text-xs">{problem.code}</span>}
                    <span>{problem.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Problem / Diagnosis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ICD-10 Code (optional)</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="e.g., E11.9, J06.9"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Problem / Diagnosis *</Label>
              <Input
                value={newProblem}
                onChange={(e) => setNewProblem(e.target.value)}
                placeholder="e.g., Type 2 diabetes, Upper respiratory infection"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newProblem.trim()) {
                  toast.error('Problem name is required');
                  return;
                }
                addProblem.mutate({
                  code: newCode.trim() || undefined,
                  name: newProblem.trim(),
                });
              }}
              disabled={addProblem.isPending || !newProblem.trim()}
            >
              {addProblem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Problem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
