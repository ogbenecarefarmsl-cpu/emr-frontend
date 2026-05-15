import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService } from '@/services/patientService';

interface AllergyManagerProps {
  patientId: string;
  allergies?: string[];
  allergyDetails?: Array<{
    allergen: string;
    severity?: string;
    reaction?: string;
    diagnosedAt?: Date;
  }>;
}

export function AllergyManager({ patientId, allergies = [], allergyDetails = [] }: AllergyManagerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newAllergen, setNewAllergen] = useState('');
  const [newSeverity, setNewSeverity] = useState('moderate');
  const [newReaction, setNewReaction] = useState('');

  const addAllergy = useMutation({
    mutationFn: async (data: { allergen: string; severity: string; reaction?: string }) => {
      const patient = await patientService.getById(patientId);
      const updatedAllergies = [...(patient.allergies || []), data.allergen];
      const updatedDetails = [...(patient.allergyDetails || []), {
        allergen: data.allergen,
        severity: data.severity,
        reaction: data.reaction,
        diagnosedAt: new Date(),
      }];
      return patientService.update(patientId, {
        allergies: updatedAllergies,
        allergyDetails: updatedDetails,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-chart', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Allergy added');
      setOpen(false);
      setNewAllergen('');
      setNewReaction('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to add allergy');
    },
  });

  const removeAllergy = useMutation({
    mutationFn: async (allergen: string) => {
      const patient = await patientService.getById(patientId);
      const updatedAllergies = (patient.allergies || []).filter((a: string) => a !== allergen);
      const updatedDetails = (patient.allergyDetails || []).filter((d: any) => d.allergen !== allergen);
      return patientService.update(patientId, {
        allergies: updatedAllergies,
        allergyDetails: updatedDetails,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-chart', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Allergy removed');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to remove allergy');
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'life-threatening': return 'destructive';
      case 'severe': return 'destructive';
      case 'moderate': return 'secondary';
      case 'mild': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Allergies
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allergies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No known allergies</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allergyDetails.length > 0 ? (
                allergyDetails.map((allergy, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 p-2 bg-muted/50 rounded-lg border">
                    <Badge variant={getSeverityColor(allergy.severity || '')} className="text-xs">
                      {allergy.severity}
                    </Badge>
                    <span className="text-sm font-medium">{allergy.allergen}</span>
                    {allergy.reaction && (
                      <span className="text-xs text-muted-foreground">→ {allergy.reaction}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1"
                      onClick={() => removeAllergy.mutate(allergy.allergen)}
                      disabled={removeAllergy.isPending}
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))
              ) : (
                allergies.map((allergy, idx) => (
                  <Badge key={idx} variant="destructive" className="gap-1">
                    {allergy}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 text-white hover:text-white"
                      onClick={() => removeAllergy.mutate(allergy)}
                      disabled={removeAllergy.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Allergy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Allergen *</Label>
              <Input
                value={newAllergen}
                onChange={(e) => setNewAllergen(e.target.value)}
                placeholder="e.g., Penicillin, Sulfa drugs, Latex"
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={newSeverity} onValueChange={setNewSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                  <SelectItem value="life-threatening">Life-threatening</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reaction</Label>
              <Input
                value={newReaction}
                onChange={(e) => setNewReaction(e.target.value)}
                placeholder="e.g., Rash, Anaphylaxis, Nausea"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newAllergen.trim()) {
                  toast.error('Allergen is required');
                  return;
                }
                addAllergy.mutate({
                  allergen: newAllergen.trim(),
                  severity: newSeverity,
                  reaction: newReaction.trim() || undefined,
                });
              }}
              disabled={addAllergy.isPending || !newAllergen.trim()}
            >
              {addAllergy.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Allergy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
