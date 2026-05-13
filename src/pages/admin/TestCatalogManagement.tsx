import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Save, X, Copy, ChevronDown, ChevronRight, FlaskConical, Layers, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import api from '@/services/api';

interface ReferenceRange {
  ageGroup?: string;
  ageMin?: number;
  ageMax?: number;
  gender?: 'M' | 'F' | 'all';
  pregnancy?: boolean;
  condition?: string;
  range: string;
  unit?: string;
  criticalLow?: string;
  criticalHigh?: string;
}

interface Test {
  _id: string;
  code: string;
  name: string;
  category: string;
  sampleType: string;
  price: number;
  unit?: string;
  referenceRange?: string;
  referenceRanges?: ReferenceRange[];
  panelCode?: string;
  panelName?: string;
  linkedTests?: string[];
  turnaroundTime?: number;
  machineId?: string;
  isActive: boolean;
  description?: string;
}

const CATEGORIES = [
  { value: 'hematology', label: 'Hematology', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'chemistry', label: 'Clinical Chemistry', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'immunoassay', label: 'Immunoassay', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'serology', label: 'Serology', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { value: 'urinalysis', label: 'Urinalysis', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'microbiology', label: 'Microbiology', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800 border-gray-200' },
];

const SAMPLE_TYPES = [
  { value: 'serum', label: 'Serum' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'whole blood', label: 'Whole Blood' },
  { value: 'urine', label: 'Urine' },
  { value: 'csf', label: 'CSF' },
  { value: 'other', label: 'Other' },
];

export default function TestCatalogManagement() {
  const queryClient = useQueryClient();
  const { hasRole, profile, primaryRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [formData, setFormData] = useState<Partial<Test>>({});
  const [referenceRanges, setReferenceRanges] = useState<ReferenceRange[]>([]);

  // Fetch all tests
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['tests'],
    queryFn: async () => {
      const response = await api.get('/test-catalog');
      return response.data;
    },
  });

  // Create test mutation
  const createTest = useMutation({
    mutationFn: async (data: Partial<Test>) => {
      const response = await api.post('/test-catalog', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      toast.success('Test created successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create test');
    },
  });

  // Update test mutation
  const updateTest = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Test> }) => {
      const response = await api.patch(`/test-catalog/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      toast.success('Test updated successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update test');
    },
  });

  // Delete test mutation
  const deleteTest = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/test-catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      toast.success('Test deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete test');
    },
  });

  const handleOpenDialog = (test?: Test) => {
    if (test) {
      setEditingTest(test);
      setFormData(test);
      setReferenceRanges(test.referenceRanges || []);
    } else {
      setEditingTest(null);
      setFormData({ isActive: true });
      setReferenceRanges([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTest(null);
    setFormData({});
    setReferenceRanges([]);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      referenceRanges: referenceRanges.length > 0 ? referenceRanges : undefined,
    };

    if (editingTest) {
      updateTest.mutate({ id: editingTest._id, data });
    } else {
      createTest.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this test?')) {
      deleteTest.mutate(id);
    }
  };

  const handleDuplicate = (test: Test) => {
    const duplicated = {
      ...test,
      code: `${test.code}_COPY`,
      name: `${test.name} (Copy)`,
    };
    delete (duplicated as any)._id;
    handleOpenDialog(duplicated as Test);
  };

  const addReferenceRange = () => {
    setReferenceRanges([
      ...referenceRanges,
      { range: '', gender: 'all', ageGroup: 'Adults' },
    ]);
  };

  const updateReferenceRange = (index: number, field: keyof ReferenceRange, value: any) => {
    const updated = [...referenceRanges];
    updated[index] = { ...updated[index], [field]: value };
    setReferenceRanges(updated);
  };

  const removeReferenceRange = (index: number) => {
    setReferenceRanges(referenceRanges.filter((_, i) => i !== index));
  };

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const toggleCategory = (cat: string) => setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  // Panel creation state
  const [panelForm, setPanelForm] = useState({ name: '', code: '', description: '', price: '' });
  const [panelTestCodes, setPanelTestCodes] = useState('');
  const [panelSaving, setPanelSaving] = useState(false);

  const handleCreatePanel = async () => {
    if (!panelForm.code || !panelForm.name) {
      toast.error('Panel code and name are required');
      return;
    }
    const testCodeList = panelTestCodes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (testCodeList.length < 2) {
      toast.error('A panel needs at least 2 test codes');
      return;
    }
    setPanelSaving(true);
    try {
      const matchedTests = tests.filter((t: Test) => testCodeList.includes(t.code));
      const missing = testCodeList.filter(c => !matchedTests.find((t: Test) => t.code === c));
      if (missing.length) {
        toast.error(`Tests not found in catalog: ${missing.join(', ')}`);
        return;
      }
      await api.post('/test-panels', {
        code: panelForm.code.toUpperCase(),
        name: panelForm.name,
        description: panelForm.description,
        price: parseFloat(panelForm.price) || 0,
        isActive: true,
        tests: matchedTests.map((t: Test) => ({ testId: t._id, testCode: t.code, testName: t.name })),
      });
      toast.success(`Panel "${panelForm.name}" created successfully`);
      setPanelForm({ name: '', code: '', description: '', price: '' });
      setPanelTestCodes('');
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || 'Failed to create panel');
    } finally {
      setPanelSaving(false);
    }
  };

  // Filter tests
  const filteredTests = tests.filter((test: Test) => {
    const matchesCategory = selectedCategory === 'all' || test.category === selectedCategory;
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         test.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group by category
  const testsByCategory = CATEGORIES.map(cat => ({
    ...cat,
    tests: filteredTests.filter((t: Test) => t.category === cat.value),
  })).filter(g => g.tests.length > 0);

  const activeCount = tests.filter((t: Test) => t.isActive).length;

  return (
    <RoleLayout 
      title="Test Catalog Management" 
      subtitle="Manage tests, reference ranges, and categories"
      role={primaryRole || 'admin'} 
      userName={profile?.full_name}
    >
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          {!isAdmin && <p className="text-sm text-amber-600">(Lab Technician View - Delete restricted to Admins)</p>}
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Test
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <FlaskConical className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{tests.length}</p>
                <p className="text-xs text-muted-foreground">Total Tests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-700 font-bold text-sm">{activeCount}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Layers className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{CATEGORIES.length}</p>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tests grouped by category */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tests...</div>
      ) : testsByCategory.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No tests found</div>
      ) : (
        <div className="space-y-3">
          {testsByCategory.map(group => (
            <Collapsible
              key={group.value}
              open={openCategories[group.value] !== false}
              onOpenChange={() => toggleCategory(group.value)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/40 rounded-t-lg select-none">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${group.color}`}>{group.label}</span>
                      <span className="text-sm text-muted-foreground">{group.tests.length} test{group.tests.length !== 1 ? 's' : ''}</span>
                    </div>
                    {openCategories[group.value] === false ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="text-left px-5 py-2">Code</th>
                          <th className="text-left px-5 py-2">Name</th>
                          <th className="text-left px-5 py-2">Unit</th>
                          <th className="text-left px-5 py-2">Reference Range</th>
                          <th className="text-left px-5 py-2">Price</th>
                          <th className="text-left px-5 py-2">Status</th>
                          <th className="text-right px-5 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.tests.map((test: Test) => (
                          <tr key={test._id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-2.5 font-mono font-semibold text-xs">{test.code}</td>
                            <td className="px-5 py-2.5 font-medium">
                              {test.name}
                              {test.panelName && (
                                <span className="ml-2 text-xs text-muted-foreground">({test.panelName})</span>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-muted-foreground">{test.unit || '—'}</td>
                            <td className="px-5 py-2.5 text-muted-foreground">
                              {test.referenceRanges && test.referenceRanges.length > 0
                                ? test.referenceRanges.map((r, i) => (
                                    <span key={i} className="block text-xs">{r.range} {r.unit}</span>
                                  ))
                                : test.referenceRange || '—'
                              }
                            </td>
                            <td className="px-5 py-2.5">Le {test.price?.toLocaleString()}</td>
                            <td className="px-5 py-2.5">
                              <Badge variant={test.isActive ? 'default' : 'secondary'} className="text-xs">
                                {test.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-5 py-2.5">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDuplicate(test)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleOpenDialog(test)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                {isAdmin && (
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(test._id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTest ? 'Edit Test' : 'Create New Test'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="ranges">Ref. Ranges</TabsTrigger>
              <TabsTrigger value="advanced">Create Panel</TabsTrigger>
              <TabsTrigger value="preview">Report Preview</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Test Code *</Label>
                  <Input
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., PSA, CA125"
                  />
                </div>
                <div>
                  <Label>Test Name *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Prostate Specific Antigen"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sample Type *</Label>
                  <Select
                    value={formData.sampleType}
                    onValueChange={(value) => setFormData({ ...formData, sampleType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sample type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SAMPLE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Price *</Label>
                  <Input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., mg/dL, ng/mL"
                  />
                </div>
                <div>
                  <Label>Turnaround Time (min)</Label>
                  <Input
                    type="number"
                    value={formData.turnaroundTime || ''}
                    onChange={(e) => setFormData({ ...formData, turnaroundTime: parseInt(e.target.value) })}
                    placeholder="15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Panel Code</Label>
                  <Input
                    value={formData.panelCode || ''}
                    onChange={(e) => setFormData({ ...formData, panelCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., TUMOR, CARDIAC"
                  />
                </div>
                <div>
                  <Label>Panel Name</Label>
                  <Input
                    value={formData.panelName || ''}
                    onChange={(e) => setFormData({ ...formData, panelName: e.target.value })}
                    placeholder="e.g., Tumor Markers, Cardiac Markers"
                  />
                </div>
              </div>

              <div>
                <Label>Simple Reference Range</Label>
                <Input
                  value={formData.referenceRange || ''}
                  onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
                  placeholder="e.g., 0-4.0 ng/mL or < 35 U/mL"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use this for tests with a single reference range. For age/gender-specific ranges, use the Reference Ranges tab.
                </p>
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive !== false}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isActive">Active (available for ordering)</Label>
              </div>
            </TabsContent>

            {/* Reference Ranges Tab */}
            <TabsContent value="ranges" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Add multiple reference ranges for different age groups, genders, or conditions
                </p>
                <Button size="sm" onClick={addReferenceRange}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Range
                </Button>
              </div>

              {referenceRanges.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No dynamic ranges defined. Click "Add Range" to create age/gender-specific ranges.
                </div>
              ) : (
                <div className="space-y-4">
                  {referenceRanges.map((range, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-semibold">Range #{index + 1}</h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeReferenceRange(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Age Group Label</Label>
                            <Input
                              value={range.ageGroup || ''}
                              onChange={(e) => updateReferenceRange(index, 'ageGroup', e.target.value)}
                              placeholder="e.g., Adults, 40-49 years"
                            />
                          </div>
                          <div>
                            <Label>Gender</Label>
                            <Select
                              value={range.gender || 'all'}
                              onValueChange={(value) => updateReferenceRange(index, 'gender', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="M">Male</SelectItem>
                                <SelectItem value="F">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label>Min Age (years)</Label>
                            <Input
                              type="number"
                              value={range.ageMin || ''}
                              onChange={(e) => updateReferenceRange(index, 'ageMin', e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <Label>Max Age (years)</Label>
                            <Input
                              type="number"
                              value={range.ageMax || ''}
                              onChange={(e) => updateReferenceRange(index, 'ageMax', e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="Optional"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label>Range Value *</Label>
                            <Input
                              value={range.range}
                              onChange={(e) => updateReferenceRange(index, 'range', e.target.value)}
                              placeholder="e.g., 0-4.5, < 35, > 100"
                            />
                          </div>
                          <div>
                            <Label>Unit</Label>
                            <Input
                              value={range.unit || ''}
                              onChange={(e) => updateReferenceRange(index, 'unit', e.target.value)}
                              placeholder="e.g., ng/mL, U/mL"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <Label>Condition (Optional)</Label>
                          <Input
                            value={range.condition || ''}
                            onChange={(e) => updateReferenceRange(index, 'condition', e.target.value)}
                            placeholder="e.g., pre-menopausal, follicular, pregnancy"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Use for special conditions like menstrual cycle phases, pregnancy, etc.
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 mt-4">
                          <input
                            type="checkbox"
                            id={`pregnancy-${index}`}
                            checked={range.pregnancy || false}
                            onChange={(e) => updateReferenceRange(index, 'pregnancy', e.target.checked)}
                            className="rounded"
                          />
                          <Label htmlFor={`pregnancy-${index}`}>Pregnancy-specific range</Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Report Preview Tab */}
            <TabsContent value="preview" className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
                <div className="flex items-center gap-2 font-semibold text-base">
                  <Info className="h-4 w-4 text-blue-500" />
                  How this test appears on the result sheet
                </div>

                {/* Category heading */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Section heading on report</p>
                  <div className="bg-white border rounded px-4 py-2 font-bold text-sm uppercase tracking-widest">
                    {CATEGORIES.find(c => c.value === formData.category)?.label?.toUpperCase() || 'CATEGORY'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    All tests in the same category share this page heading.
                    {formData.category === 'hematology' && ' Coagulation Profile (COAG panel) always prints on its own page.'}
                    {formData.category === 'chemistry' && ' Urea, Creatinine, and Uric Acid print on a separate page when ordered individually.'}
                  </p>
                </div>

                {/* Panel vs individual */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Grouping</p>
                  {formData.panelCode ? (
                    <div className="bg-white border rounded px-4 py-2 text-sm">
                      <span className="font-semibold">{formData.panelName || formData.panelCode}</span>
                      <span className="text-muted-foreground ml-2 text-xs">(panel sub-header)</span>
                      <div className="mt-2 pl-3 border-l-2 border-muted">
                        <div className="flex justify-between text-xs py-1">
                          <span className="font-medium">{formData.name || 'Test Name'}</span>
                          <span className="text-muted-foreground">{formData.unit || 'unit'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border rounded px-4 py-2 text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Individual test row (no panel sub-header)</p>
                      <div className="flex justify-between text-xs py-1 border-b">
                        <span className="font-medium">{formData.name || 'Test Name'}</span>
                        <span className="text-muted-foreground">{formData.unit || 'unit'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reference range preview */}
                {(referenceRanges.length > 0 || formData.referenceRange) && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reference range shown alongside result</p>
                    <div className="bg-white border rounded px-4 py-2 text-xs space-y-1">
                      {referenceRanges.length > 0
                        ? referenceRanges.map((r, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-muted-foreground">{r.ageGroup}{r.gender && r.gender !== 'all' ? ` (${r.gender})` : ''}</span>
                              <span>{r.range} {r.unit}</span>
                            </div>
                          ))
                        : <span>{formData.referenceRange}</span>
                      }
                    </div>
                  </div>
                )}

                {/* Tips */}
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">Tips:</p>
                  <p>• Assign a <strong>Panel Code</strong> (Basic Info tab) to group this test under a panel sub-header on the report.</p>
                  <p>• Tests with no panel code appear as individual rows under the category heading.</p>
                  <p>• Use the <strong>Panel</strong> tab to create a new orderable panel combining multiple tests.</p>
                  <p>• Age/gender-specific ranges (Reference Ranges tab) are automatically matched to the patient at report time.</p>
                </div>
              </div>
            </TabsContent>

            {/* Panel Tab */}
            <TabsContent value="advanced" className="space-y-4">
              <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 space-y-4">
                <div className="font-semibold text-amber-900 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Create a New Orderable Panel
                </div>
                <p className="text-xs text-amber-700">A panel groups multiple individual tests so they can be ordered as one item. Enter the test codes that belong in the panel (must already exist in the catalog).</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Panel Code *</Label>
                    <Input value={panelForm.code} onChange={e => setPanelForm({...panelForm, code: e.target.value.toUpperCase()})} placeholder="e.g., LIPID, THYROID" />
                  </div>
                  <div>
                    <Label>Panel Name *</Label>
                    <Input value={panelForm.name} onChange={e => setPanelForm({...panelForm, name: e.target.value})} placeholder="e.g., Lipid Profile" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Price (Le)</Label>
                    <Input type="number" value={panelForm.price} onChange={e => setPanelForm({...panelForm, price: e.target.value})} placeholder="0" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={panelForm.description} onChange={e => setPanelForm({...panelForm, description: e.target.value})} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <Label>Test Codes (comma-separated) *</Label>
                  <Input value={panelTestCodes} onChange={e => setPanelTestCodes(e.target.value)} placeholder="e.g., CHOL, HDL, LDL, TG, VLDL" />
                  <p className="text-xs text-muted-foreground mt-1">These tests must already exist in the catalog above.</p>
                </div>
                <Button onClick={handleCreatePanel} disabled={panelSaving} className="w-full">
                  {panelSaving ? 'Creating...' : 'Create Panel'}
                </Button>
              </div>
            </TabsContent>

          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.code || !formData.name || !formData.category}>
              <Save className="h-4 w-4 mr-2" />
              {editingTest ? 'Update Test' : 'Create Test'}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
    </RoleLayout>
  );
}
