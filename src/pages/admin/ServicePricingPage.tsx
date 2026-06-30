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
import { Loader2, Save, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function ServicePricingPage() {
  const { profile } = useAuth();
  const { data: branches = [], isLoading: branchesLoading } = useAllBranches();
  const [branchId, setBranchId] = useState('');
  const { data: prices = [], isLoading: pricesLoading } = useBranchServicePrices(branchId);
  const updatePrices = useUpdateBranchServicePrices();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!branchId && Array.isArray(branches) && branches.length > 0) {
      setBranchId(branches[0]._id);
    }
  }, [branchId, branches]);

  useEffect(() => {
    if (!Array.isArray(prices)) return;
    const next: Record<string, string> = {};
    prices.forEach((price: any) => {
      next[price.code] = String(price.amount ?? 0);
    });
    setDraft(next);
  }, [prices]);

  const groupedPrices = useMemo(() => {
    if (!Array.isArray(prices)) return {};
    return prices.reduce<Record<string, any[]>>((acc, price: any) => {
      const category = price.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(price);
      return acc;
    }, {});
  }, [prices]);

  const selectedBranch = Array.isArray(branches) ? branches.find((branch: any) => branch._id === branchId) : null;
  const loading = branchesLoading || pricesLoading;

  const save = async () => {
    if (!branchId) {
      toast.error('Select a branch first');
      return;
    }

    const payload = Object.entries(draft).map(([code, amount]) => ({
      code,
      amount: Number(amount || 0),
      isActive: true,
    }));

    if (payload.some((item) => Number.isNaN(item.amount) || item.amount < 0)) {
      toast.error('Prices must be zero or higher');
      return;
    }

    try {
      await updatePrices.mutateAsync({ branchId, prices: payload });
      toast.success('Service prices updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update prices');
    }
  };

  return (
    <RoleLayout
      title="Service Pricing"
      subtitle="Set branch-specific prices for reception, admission, and rapid services"
      role="admin"
      userName={profile?.fullName}
    >
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4 text-primary" />
              Branch Price List
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1 min-w-[260px]">
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
            </div>
            {selectedBranch && (
              <Badge variant="outline" className="w-fit">
                {selectedBranch.code}
              </Badge>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {Object.entries(groupedPrices).map(([category, items]) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((price: any) => (
                    <div key={price.code} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm">{price.label}</Label>
                        <span className="text-xs text-muted-foreground">{price.code}</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft[price.code] ?? ''}
                        onChange={(event) => setDraft((prev) => ({ ...prev, [price.code]: event.target.value }))}
                      />
                      {price.description && (
                        <p className="text-xs text-muted-foreground">{price.description}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={!branchId || updatePrices.isPending}>
            {updatePrices.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Prices
          </Button>
        </div>
      </div>
    </RoleLayout>
  );
}
