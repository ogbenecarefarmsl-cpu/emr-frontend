import { useEffect, useMemo, useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useAllBranches } from '@/hooks/useBranch';
import { useBranchServicePrices, useUpdateBranchServicePrices } from '@/hooks/useServicePrices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Save, Search, Tag } from 'lucide-react';
import { toast } from 'sonner';

type ServicePriceDraft = {
  _id?: string;
  code: string;
  label: string;
  category: string;
  description: string;
  amount: string;
  isActive: boolean;
  isCustom: boolean;
};

const emptyService = {
  label: '',
  category: '',
  description: '',
  amount: '',
};

function normalizeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function ServicePricingPage() {
  const { profile } = useAuth();
  const { data: branches = [], isLoading: branchesLoading } = useAllBranches();
  const [branchId, setBranchId] = useState('');
  const { data: prices = [], isLoading: pricesLoading } = useBranchServicePrices(branchId);
  const updatePrices = useUpdateBranchServicePrices();
  const [draftItems, setDraftItems] = useState<ServicePriceDraft[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [newService, setNewService] = useState(emptyService);

  useEffect(() => {
    if (!branchId && Array.isArray(branches) && branches.length > 0) {
      setBranchId(branches[0]._id);
    }
  }, [branchId, branches]);

  useEffect(() => {
    if (!Array.isArray(prices)) return;
    setDraftItems(prices.map((price: any) => ({
      _id: price._id,
      code: price.code,
      label: price.label || price.code,
      category: price.category || 'Other',
      description: price.description || '',
      amount: String(price.amount ?? 0),
      isActive: price.isActive ?? true,
      isCustom: Boolean(price.isCustom),
    })));
  }, [prices]);

  const selectedBranch = Array.isArray(branches) ? branches.find((branch: any) => branch._id === branchId) : null;
  const loading = branchesLoading || pricesLoading;

  const categories = useMemo(() => {
    return Array.from(new Set(draftItems.map((item) => item.category || 'Other'))).sort();
  }, [draftItems]);

  const groupedPrices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return draftItems
      .filter((item) => categoryFilter === 'all' || item.category === categoryFilter)
      .filter((item) => {
        if (!query) return true;
        return [item.label, item.code, item.category, item.description].some((value) =>
          value.toLowerCase().includes(query),
        );
      })
      .reduce<Record<string, ServicePriceDraft[]>>((acc, price) => {
        const category = price.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(price);
        return acc;
      }, {});
  }, [categoryFilter, draftItems, search]);

  const updateItem = (code: string, patch: Partial<ServicePriceDraft>) => {
    setDraftItems((prev) => prev.map((item) => (item.code === code ? { ...item, ...patch } : item)));
  };

  const addService = () => {
    const label = newService.label.trim();
    const category = newService.category.trim();
    const code = normalizeCode(label);
    const amount = Number(newService.amount || 0);

    if (!label || !category) {
      toast.error('Enter a service name and category');
      return;
    }
    if (!code) {
      toast.error('Service name must include letters or numbers');
      return;
    }
    if (draftItems.some((item) => item.code === code)) {
      toast.error('A service with this name already exists for this branch');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Service price must be zero or higher');
      return;
    }

    setDraftItems((prev) => [
      ...prev,
      {
        code,
        label,
        category,
        description: newService.description.trim(),
        amount: String(amount),
        isActive: true,
        isCustom: true,
      },
    ]);
    setNewService(emptyService);
    setCategoryFilter(category);
  };

  const save = async () => {
    if (!branchId) {
      toast.error('Select a branch first');
      return;
    }

    const payload = draftItems.map((item) => ({
      code: item.code,
      label: item.label.trim(),
      category: item.category.trim(),
      description: item.description.trim(),
      amount: Number(item.amount || 0),
      isActive: item.isActive,
      isCustom: item.isCustom,
    }));

    if (payload.some((item) => Number.isNaN(item.amount) || item.amount < 0)) {
      toast.error('Prices must be zero or higher');
      return;
    }
    if (payload.some((item) => item.isCustom && (!item.label || !item.category))) {
      toast.error('Custom services need a name and category');
      return;
    }

    try {
      await updatePrices.mutateAsync({ branchId, prices: payload });
      toast.success('Service catalog updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update prices');
    }
  };

  return (
    <RoleLayout
      title="Service Pricing"
      subtitle="Manage branch-specific services, workflow prices, and custom charges"
      role="admin"
      userName={profile?.fullName}
    >
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4 text-primary" />
              Branch Service Catalog
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
            <div className="space-y-1">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder={branchesLoading ? 'Loading branches...' : 'Select branch'} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch: any) => (
                    <SelectItem key={branch._id} value={branch._id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBranch && (
                <p className="text-xs text-muted-foreground">
                  Editing prices for <span className="font-medium text-foreground">{selectedBranch.name}</span>
                  {selectedBranch.code ? ` (${selectedBranch.code})` : ''}
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>New service</Label>
                <Input
                  value={newService.label}
                  onChange={(event) => setNewService((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="e.g. ECG"
                />
              </div>
              <div className="space-y-1">
                <Label>Group</Label>
                <Input
                  value={newService.category}
                  onChange={(event) => setNewService((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="e.g. Cardiology"
                />
              </div>
              <div className="space-y-1">
                <Label>Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newService.amount}
                  onChange={(event) => setNewService((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" className="w-full gap-2" onClick={addService} disabled={!branchId}>
                  <Plus className="w-4 h-4" />
                  Add Service
                </Button>
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                <Label>Description</Label>
                <Input
                  value={newService.description}
                  onChange={(event) => setNewService((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional receipt/admin note"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Search services"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filter group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={save} disabled={!branchId || updatePrices.isPending}>
              {updatePrices.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Catalog
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedPrices).map(([category, items]) => (
              <Card key={category}>
                <CardHeader className="border-b py-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{category}</span>
                    <Badge variant="outline">{items.length} services</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y p-0">
                  {items.map((price) => (
                    <div key={price.code} className="grid gap-3 p-4 lg:grid-cols-[1.4fr_120px_110px] lg:items-center">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {price.isCustom ? (
                            <Input
                              value={price.label}
                              onChange={(event) => updateItem(price.code, { label: event.target.value })}
                              className="h-9 max-w-sm font-medium"
                            />
                          ) : (
                            <p className="font-medium">{price.label}</p>
                          )}
                          <Badge variant={price.isCustom ? 'default' : 'secondary'}>
                            {price.isCustom ? 'Custom' : 'Workflow'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{price.code}</span>
                        </div>
                        {price.isCustom ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                              value={price.category}
                              onChange={(event) => updateItem(price.code, { category: event.target.value })}
                              placeholder="Group"
                            />
                            <Input
                              value={price.description}
                              onChange={(event) => updateItem(price.code, { description: event.target.value })}
                              placeholder="Description"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{price.description || 'Protected service used by EMR workflows.'}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Branch price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={price.amount}
                          onChange={(event) => updateItem(price.code, { amount: event.target.value })}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 lg:justify-center lg:gap-3">
                        <Label className="text-xs">Active</Label>
                        <Switch
                          checked={price.isActive}
                          onCheckedChange={(checked) => updateItem(price.code, { isActive: checked })}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
            {Object.keys(groupedPrices).length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No services match the current filter.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </RoleLayout>
  );
}
