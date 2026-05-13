import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useTestCatalog, useCreateTest, useUpdateTest, useDeleteTest } from '@/hooks/useTestCatalog';
import { useMachines } from '@/hooks/useMachines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type TestCategory = Database['public']['Enums']['test_category'];
type SampleType = Database['public']['Enums']['sample_type'];

const categoryColors: Record<TestCategory, string> = {
  hematology: 'bg-red-100 text-red-800 border-red-200',
  chemistry: 'bg-blue-100 text-blue-800 border-blue-200',
  immunoassay: 'bg-purple-100 text-purple-800 border-purple-200',
  serology: 'bg-pink-100 text-pink-800 border-pink-200',
  urinalysis: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  microbiology: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

interface TestFormData {
  code: string;
  name: string;
  category: TestCategory;
  sample_type: SampleType;
  price: string;
  unit: string;
  reference_range: string;
  turnaround_time: string;
  machine_id: string;
}

const initialFormData: TestFormData = {
  code: '',
  name: '',
  category: 'other',
  sample_type: 'blood',
  price: '',
  unit: '',
  reference_range: '',
  turnaround_time: '60',
  machine_id: '',
};

export default function TestCatalog() {
  const { profile } = useAuth();
  const { data: tests, isLoading } = useTestCatalog(false);
  const { data: machines } = useMachines();
  const createTest = useCreateTest();
  const updateTest = useUpdateTest();
  const deleteTest = useDeleteTest();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TestCategory | 'all'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TestFormData>(initialFormData);

  const filteredTests = tests?.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || test.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = async () => {
    if (!formData.code || !formData.name || !formData.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const testData = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        category: formData.category,
        sample_type: formData.sample_type,
        price: parseFloat(formData.price),
        unit: formData.unit || null,
        reference_range: formData.reference_range || null,
        turnaround_time: parseInt(formData.turnaround_time) || 60,
        machine_id: formData.machine_id || null,
      };

      if (editingId) {
        await updateTest.mutateAsync({ id: editingId, updates: testData });
        toast.success('Test updated successfully');
      } else {
        await createTest.mutateAsync(testData);
        toast.success('Test created successfully');
      }

      setShowDialog(false);
      setFormData(initialFormData);
      setEditingId(null);
    } catch (error) {
      toast.error('Failed to save test');
    }
  };

  const handleEdit = (test: typeof tests extends (infer T)[] | undefined ? T : never) => {
    if (!test) return;
    setFormData({
      code: test.code,
      name: test.name,
      category: test.category,
      sample_type: test.sample_type,
      price: test.price.toString(),
      unit: test.unit || '',
      reference_range: test.reference_range || '',
      turnaround_time: test.turnaround_time?.toString() || '60',
      machine_id: test.machine_id || '',
    });
    setEditingId(test.id);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this test?')) return;
    
    try {
      await deleteTest.mutateAsync(id);
      toast.success('Test deactivated');
    } catch (error) {
      toast.error('Failed to deactivate test');
    }
  };

  return (
    <RoleLayout 
      title="Test Catalog" 
      subtitle="Manage available laboratory tests"
      role="admin"
      userName={profile?.full_name}
    >
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search tests..." 
              className="pl-10 w-80"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as TestCategory | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="hematology">Hematology</SelectItem>
              <SelectItem value="chemistry">Chemistry</SelectItem>
              <SelectItem value="immunoassay">Immunoassay</SelectItem>
              <SelectItem value="serology">Serology</SelectItem>
              <SelectItem value="urinalysis">Urinalysis</SelectItem>
              <SelectItem value="microbiology">Microbiology</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => {
          setFormData(initialFormData);
          setEditingId(null);
          setShowDialog(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Test
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-7 gap-4 mb-6">
        {(['hematology', 'chemistry', 'immunoassay', 'serology', 'urinalysis', 'microbiology', 'other'] as TestCategory[]).map(cat => (
          <div key={cat} className="bg-card border rounded-lg p-3">
            <p className="text-xs text-muted-foreground capitalize">{cat}</p>
            <p className="text-xl font-bold">
              {tests?.filter(t => t.category === cat && t.is_active).length || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Tests Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Sample</th>
                <th>Price</th>
                <th>Reference Range</th>
                <th>TAT</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests?.map(test => (
                <tr key={test.id} className={cn(!test.is_active && 'opacity-50')}>
                  <td className="font-mono font-medium">{test.code}</td>
                  <td>{test.name}</td>
                  <td>
                    <Badge variant="outline" className={cn('capitalize', categoryColors[test.category])}>
                      {test.category}
                    </Badge>
                  </td>
                  <td className="capitalize">{test.sample_type}</td>
                  <td className="font-medium">Le {Number(test.price).toLocaleString()}</td>
                  <td className="text-muted-foreground text-sm">
                    {test.reference_range || '-'} {test.unit || ''}
                  </td>
                  <td>{test.turnaround_time} min</td>
                  <td>
                    <Badge variant={test.is_active ? 'default' : 'secondary'}>
                      {test.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(test)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(test.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!filteredTests || filteredTests.length === 0) && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    No tests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Test' : 'Add New Test'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Test Code *</Label>
              <Input 
                value={formData.code}
                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g., CBC, FBS"
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label>Test Name *</Label>
              <Input 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Full test name"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={v => setFormData(prev => ({ ...prev, category: v as TestCategory }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hematology">Hematology</SelectItem>
                  <SelectItem value="chemistry">Chemistry</SelectItem>
                  <SelectItem value="immunoassay">Immunoassay</SelectItem>
                  <SelectItem value="serology">Serology</SelectItem>
                  <SelectItem value="urinalysis">Urinalysis</SelectItem>
                  <SelectItem value="microbiology">Microbiology</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sample Type</Label>
              <Select value={formData.sample_type} onValueChange={v => setFormData(prev => ({ ...prev, sample_type: v as SampleType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blood">Blood</SelectItem>
                  <SelectItem value="urine">Urine</SelectItem>
                  <SelectItem value="stool">Stool</SelectItem>
                  <SelectItem value="swab">Swab</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price (Le) *</Label>
              <Input 
                type="number"
                value={formData.price}
                onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input 
                value={formData.unit}
                onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                placeholder="e.g., mg/dL, K/uL"
              />
            </div>
            <div className="space-y-2">
              <Label>Reference Range</Label>
              <Input 
                value={formData.reference_range}
                onChange={e => setFormData(prev => ({ ...prev, reference_range: e.target.value }))}
                placeholder="e.g., 70-100"
              />
            </div>
            <div className="space-y-2">
              <Label>Turnaround Time (min)</Label>
              <Input 
                type="number"
                value={formData.turnaround_time}
                onChange={e => setFormData(prev => ({ ...prev, turnaround_time: e.target.value }))}
                placeholder="60"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Analyzer</Label>
              <Select value={formData.machine_id} onValueChange={v => setFormData(prev => ({ ...prev, machine_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select analyzer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {machines?.map(machine => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.name} ({machine.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createTest.isPending || updateTest.isPending}>
              {(createTest.isPending || updateTest.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? 'Update' : 'Create'} Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
