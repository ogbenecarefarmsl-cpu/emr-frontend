import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { visitsAPI } from '@/services/api';

interface FollowUpSchedulerProps {
  visitId: string;
  followUpDate?: Date;
  followUpNotes?: string;
  onComplete?: () => void;
}

export function FollowUpScheduler({ visitId, followUpDate, followUpNotes, onComplete }: FollowUpSchedulerProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(followUpDate ? new Date(followUpDate).toISOString().split('T')[0] : '');
  const [notes, setNotes] = useState(followUpNotes || '');

  const scheduleFollowUp = useMutation({
    mutationFn: async () => {
      return visitsAPI.update(visitId, {
        followUpDate: date ? new Date(date) : undefined,
        followUpNotes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['patient-chart'] });
      toast.success(date ? `Follow-up scheduled for ${new Date(date).toLocaleDateString()}` : 'Follow-up cleared');
      onComplete?.();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to schedule follow-up');
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Follow-up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Follow-up Date</Label>
          <Input
            type="date"
            value={date}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Follow-up Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Review lab results, Check blood pressure..."
            rows={2}
          />
        </div>
        <Button
          size="sm"
          onClick={() => scheduleFollowUp.mutate()}
          disabled={scheduleFollowUp.isPending}
          className="w-full"
        >
          {scheduleFollowUp.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {date ? 'Schedule Follow-up' : 'Clear Follow-up'}
        </Button>
      </CardContent>
    </Card>
  );
}
