import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useAuth } from '@/context/AuthContext';
import { inventoryAPI } from '@/services/api';
import { medicationService } from '@/services/medicationService';

// UI
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Icons
import {
  Package, AlertTriangle, Clock, TrendingUp, Plus, Save,
  Boxes, Building2, ArrowUpCircle, ArrowDownCircle, Loader2, Search, Calendar,
  Trash2, RotateCcw, ShoppingCart,
} from 'lucide-react';

export default function InventoryDashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['inventory', 'dashboard'],
    queryFn: () => inventoryAPI.getDashboard(),
    refetchInterval: 60 * 1000,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryAPI.getLowStock(),
    refetchInterval: 60 * 1000,
  });

  const { data: expiring = [] } = useQuery({
    queryKey: ['inventory', 'expiring'],
    queryFn: () => inventoryAPI.getExpiringSoon(90),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: expired = [] } = useQuery({
    queryKey: ['inventory', 'expired'],
    queryFn: () => inventoryAPI.getExpiringSoon(0),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['inventory', 'movements'],
    queryFn: () => inventoryAPI.getMovements({ limit: 50 }),
    refetchInterval: 30 * 1000,
  });

  const { data: allMedications = [] } = useQuery({
    queryKey: ['medications'],
    queryFn: () => medicationService.findAll(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => inventoryAPI.listSuppliers(),
    staleTime: 5 * 60 * 1000,
  });

  // Receive stock modal
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    medicationId: '',
    quantity: '',
    batchNumber: '',
    expiryDate: '',
    unitCost: '',
    supplierId: '',
    invoiceNumber: '',
    notes: '',
  });
  const [medSearch, setMedSearch] = useState('');

  // Adjust stock modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    medicationId: '',
    quantity: '',
    reason: '',
    notes: '',
  });

  // Supplier modal
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
  });

  const filteredMeds = useMemo(() => {
    if (!medSearch) return allMedications.slice(0, 50);
    return allMedications
      .filter((m: any) => m.name?.toLowerCase().includes(medSearch.toLowerCase()) || m.genericName?.toLowerCase().includes(medSearch.toLowerCase()))
      .slice(0, 50);
  }, [allMedications, medSearch]);

  const reorderList = useMemo(() => {
    if (!Array.isArray(lowStock)) return [];
    return lowStock
      .filter((m: any) => m.reorderLevel && m.stockQuantity <= m.reorderLevel)
      .map((m: any) => ({
        ...m,
        suggestedOrderQty: Math.max((m.reorderLevel * 2) - m.stockQuantity, m.reorderLevel),
      }));
  }, [lowStock]);

  const expiredItems = useMemo(() => {
    if (!Array.isArray(expired)) return [];
    return expired.filter((m: any) => m.expiryDate && new Date(m.expiryDate) < new Date());
  }, [expired]);

  const receiveStock = useMutation({
    mutationFn: () =>
      inventoryAPI.receiveStock({
        medicationId: receiveForm.medicationId,
        quantity: parseInt(receiveForm.quantity),
        batchNumber: receiveForm.batchNumber || undefined,
        expiryDate: receiveForm.expiryDate || undefined,
        unitCost: receiveForm.unitCost ? parseFloat(receiveForm.unitCost) : undefined,
        supplierId: receiveForm.supplierId || undefined,
        invoiceNumber: receiveForm.invoiceNumber || undefined,
        notes: receiveForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Stock received successfully');
      setReceiveOpen(false);
      setReceiveForm({ medicationId: '', quantity: '', batchNumber: '', expiryDate: '', unitCost: '', supplierId: '', invoiceNumber: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
    },
    onError: () => toast.error('Failed to receive stock'),
  });

  const adjustStock = useMutation({
    mutationFn: () =>
      inventoryAPI.adjustStock({
        medicationId: adjustForm.medicationId,
        quantity: parseInt(adjustForm.quantity),
        reason: adjustForm.reason,
        notes: adjustForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Stock adjusted');
      setAdjustOpen(false);
      setAdjustForm({ medicationId: '', quantity: '', reason: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
    },
    onError: () => toast.error('Failed to adjust stock'),
  });

  const createSupplier = useMutation({
    mutationFn: () => inventoryAPI.createSupplier(supplierForm),
    onSuccess: () => {
      toast.success('Supplier added');
      setSupplierOpen(false);
      setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: () => toast.error('Failed to add supplier'),
  });

  const formatCurrency = (n: number) => `Le ${Number(n || 0).toLocaleString()}`;

  return (
    <RoleLayout
      title="Inventory"
      subtitle="Stock management, supplier relations, and pharmacy inventory"
      role="inventory_manager"
      userName={profile?.fullName}
    >
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MetricCard title="Total SKUs" value={dashboard?.totalMedications || 0} icon={Package} />
        <MetricCard
          title="Low Stock"
          value={dashboard?.lowStockCount || 0}
          icon={AlertTriangle}
          variant={(dashboard?.lowStockCount || 0) > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Expiring (90d)"
          value={dashboard?.expiringSoonCount || 0}
          icon={Clock}
          variant={(dashboard?.expiringSoonCount || 0) > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Expired"
          value={expiredItems.length}
          icon={Trash2}
          variant={expiredItems.length > 0 ? 'critical' : 'default'}
        />
        <MetricCard
          title="Stock Value"
          value={formatCurrency(dashboard?.stockValue || 0)}
          icon={TrendingUp}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setReceiveOpen(true)}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary hover:border-primary transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <ArrowUpCircle className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
          </div>
          <span className="text-sm font-semibold text-primary group-hover:text-white">Receive Stock</span>
        </button>
        <button
          onClick={() => setAdjustOpen(true)}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border bg-card hover:bg-secondary transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <Boxes className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold">Adjust Stock</span>
        </button>
        <button
          onClick={() => setSupplierOpen(true)}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border bg-card hover:bg-secondary transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <Building2 className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold">Add Supplier</span>
        </button>
      </div>

      <Tabs defaultValue="low-stock" className="w-full">
        <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0">
          <TabsTrigger value="low-stock" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Low Stock
            {lowStock.length > 0 && <Badge variant="destructive" className="ml-2">{lowStock.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reorder" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Reorder List
            {reorderList.length > 0 && <Badge className="ml-2 bg-blue-500">{reorderList.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expiring" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Expiring Soon
            {expiring.length > 0 && <Badge className="ml-2 bg-amber-500">{expiring.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expired" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Expired
            {expiredItems.length > 0 && <Badge variant="destructive" className="ml-2">{expiredItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="movements" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Movements
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Suppliers
          </TabsTrigger>
        </TabsList>

        {/* Low Stock Tab */}
        <TabsContent value="low-stock" className="mt-4">
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Items at or Below Reorder Level
              </h3>
            </div>
            {lowStock.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                All items are well stocked
              </div>
            ) : (
              <div className="divide-y">
                {lowStock.map((m: any) => (
                  <div key={m._id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.medicationCode} - {m.dosageForm || 'N/A'} {m.strength ? `- ${m.strength}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600">{m.stockQuantity} in stock</p>
                        <p className="text-xs text-muted-foreground">reorder at {m.reorderLevel}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setReceiveForm({ ...receiveForm, medicationId: m._id });
                          setMedSearch(m.name);
                          setReceiveOpen(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Restock
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Reorder List Tab */}
        <TabsContent value="reorder" className="mt-4">
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-500" />
                Automated Reorder List
              </h3>
              {reorderList.length > 0 && (
                <Badge className="bg-blue-500">{reorderList.length} item(s) need reorder</Badge>
              )}
            </div>
            {reorderList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No items need reordering — all stock levels are adequate
              </div>
            ) : (
              <div className="divide-y">
                {reorderList.map((m: any) => (
                  <div key={m._id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.medicationCode} · Current: {m.stockQuantity} · Reorder at: {m.reorderLevel}
                      </p>
                      <p className="text-xs text-blue-600 font-medium mt-0.5">
                        Suggested order qty: {m.suggestedOrderQty} {m.unit || 'units'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {m.supplierId?.name || m.supplier || 'No supplier'}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => {
                          setReceiveForm({ ...receiveForm, medicationId: m._id, quantity: String(m.suggestedOrderQty) });
                          setMedSearch(m.name);
                          setReceiveOpen(true);
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Reorder
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Expiring Tab */}
        <TabsContent value="expiring" className="mt-4">
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Expiring Within 90 Days
              </h3>
            </div>
            {expiring.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No items expiring in the next 90 days
              </div>
            ) : (
              <div className="divide-y">
                {expiring.map((m: any) => {
                  const daysLeft = m.expiryDate
                    ? Math.ceil((new Date(m.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <div key={m._id} className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Batch: {m.batchNumber || 'N/A'} - Stock: {m.stockQuantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : 'N/A'}
                        </p>
                        <p className={`text-xs ${daysLeft && daysLeft < 30 ? 'text-red-600' : 'text-amber-600'}`}>
                          {daysLeft ? `${daysLeft} days left` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Expired Tab */}
        <TabsContent value="expired" className="mt-4">
          <div className="bg-card border rounded-xl shadow-sm border-l-4 border-l-red-500">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                Expired Medications
              </h3>
              {expiredItems.length > 0 && (
                <Alert variant="destructive" className="max-w-xs py-1 px-2">
                  <AlertDescription className="text-xs">
                    {expiredItems.length} expired batch(es) must be removed immediately
                  </AlertDescription>
                </Alert>
              )}
            </div>
            {expiredItems.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No expired medications — all batches are within expiry date
              </div>
            ) : (
              <div className="divide-y">
                {expiredItems.map((m: any) => {
                  const daysExpired = m.expiryDate
                    ? Math.ceil((Date.now() - new Date(m.expiryDate).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <div key={m._id} className="px-5 py-3.5 flex items-center justify-between bg-red-50/50 dark:bg-red-950/10">
                      <div>
                        <p className="font-medium text-sm text-red-800 dark:text-red-300">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Batch: {m.batchNumber || 'N/A'} · Stock: {m.stockQuantity} · Supplier: {m.supplierId?.name || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="text-sm font-semibold text-red-600">
                            Expired {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : 'N/A'}
                          </p>
                          <p className="text-xs text-red-600">
                            {daysExpired ? `${daysExpired} days ago` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setAdjustForm({ ...adjustForm, medicationId: m._id, quantity: `-${m.stockQuantity}`, reason: 'Expired - removal from inventory' });
                            setAdjustOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="mt-4">
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">Recent Stock Movements</h3>
            </div>
            {movements.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No movements recorded yet
              </div>
            ) : (
              <div className="divide-y">
                {movements.map((m: any) => (
                  <div key={m._id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {m.quantity > 0 ? (
                        <ArrowUpCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4 text-red-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {m.medicationId?.name || 'Unknown medication'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.movementType} - {new Date(m.createdAt).toLocaleString()}
                          {m.reason ? ` - ${m.reason}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.stockBefore} → {m.stockAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="mt-4">
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Suppliers</h3>
              <Button size="sm" onClick={() => setSupplierOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Supplier
              </Button>
            </div>
            {suppliers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No suppliers added yet
              </div>
            ) : (
              <div className="divide-y">
                {suppliers.map((s: any) => (
                  <div key={s._id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        {s.contactPerson && (
                          <p className="text-xs text-muted-foreground">Contact: {s.contactPerson}</p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {s.phone && <p>{s.phone}</p>}
                        {s.email && <p>{s.email}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Receive Stock Modal */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Medication</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Search medication..."
                  className="pl-8"
                />
              </div>
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {filteredMeds.map((m: any) => (
                  <div
                    key={m._id}
                    className={`p-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 ${receiveForm.medicationId === m._id ? 'bg-primary/10' : ''}`}
                    onClick={() => {
                      setReceiveForm({ ...receiveForm, medicationId: m._id });
                      setMedSearch(m.name);
                    }}
                  >
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.medicationCode} - stock: {m.stockQuantity}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={receiveForm.quantity}
                  onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  value={receiveForm.unitCost}
                  onChange={(e) => setReceiveForm({ ...receiveForm, unitCost: e.target.value })}
                />
              </div>
              <div>
                <Label>Batch Number</Label>
                <Input value={receiveForm.batchNumber} onChange={(e) => setReceiveForm({ ...receiveForm, batchNumber: e.target.value })} />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={receiveForm.expiryDate} onChange={(e) => setReceiveForm({ ...receiveForm, expiryDate: e.target.value })} />
              </div>
              <div>
                <Label>Supplier</Label>
                <Select value={receiveForm.supplierId} onValueChange={(v) => setReceiveForm({ ...receiveForm, supplierId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input value={receiveForm.invoiceNumber} onChange={(e) => setReceiveForm({ ...receiveForm, invoiceNumber: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button
              onClick={() => receiveStock.mutate()}
              disabled={receiveStock.isPending || !receiveForm.medicationId || !receiveForm.quantity}
            >
              {receiveStock.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Record Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Modal */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Medication</Label>
              <Select value={adjustForm.medicationId} onValueChange={(v) => setAdjustForm({ ...adjustForm, medicationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select medication" />
                </SelectTrigger>
                <SelectContent>
                  {allMedications.slice(0, 100).map((m: any) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name} (stock: {m.stockQuantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Adjustment Quantity (use negative for decrease)</Label>
              <Input
                type="number"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                placeholder="e.g., -5 or 10"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                placeholder="e.g., Count correction, damaged"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button
              onClick={() => adjustStock.mutate()}
              disabled={adjustStock.isPending || !adjustForm.medicationId || !adjustForm.quantity || !adjustForm.reason}
            >
              {adjustStock.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Modal */}
      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Contact Person</Label>
              <Input value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSupplier.mutate()}
              disabled={createSupplier.isPending || !supplierForm.name}
            >
              {createSupplier.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Add Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}

