import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Loader2, FileText } from 'lucide-react';
import { patientsAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PatientNotesPanelProps {
  patientId: string;
}

export function PatientNotesPanel({ patientId }: PatientNotesPanelProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Fetch notes
  const { data: notes, isLoading } = useQuery({
    queryKey: ['patient-notes', patientId],
    queryFn: async () => {
      // Assuming the backend returns notes with patient data
      const patient = await patientsAPI.getById(patientId);
      return patient.notes || [];
    }
  });

  // Add note mutation
  const addNote = useMutation({
    mutationFn: async (note: string) => {
      return await patientsAPI.addNote(patientId, note.trim());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
      setNewNote('');
      setIsAdding(false);
      toast.success('Note added successfully');
    },
    onError: () => {
      toast.error('Failed to add note');
    }
  });

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    addNote.mutate(newNote);
  };

  return (
    <div className="space-y-4">
      {/* Add Note Section */}
      {isAdding ? (
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <Textarea
            placeholder="Enter clinical note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={4}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={addNote.isPending || !newNote.trim()}
            >
              {addNote.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Note
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setIsAdding(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Clinical Note
        </Button>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : notes && notes.length > 0 ? (
          notes.map((note: any) => (
            <div key={note.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {note.createdBy?.fullName || 'Unknown User'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.note}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No clinical notes</p>
            <p className="text-sm">Add notes to track patient information</p>
          </div>
        )}
      </div>
    </div>
  );
}
