import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { medicationService } from '@/services/medicationService';
import { inventoryAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, AlertTriangle, Package, Info, ExternalLink, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InventoryManagement() {
  const { profile, primaryRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const isAdmin = primaryRole === 'admin';

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ['medications', 'inventory'],
    queryFn: () => medicationService.findAll(),
    staleTime: 60 * 1000,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryAPI.getLowStock(),
    staleTime: 60 * 1000,
  });

  const { data: expiring = [] } = useQuery({
    queryKey: ['inventory', 'expiring'],
    queryFn: () => inventoryAPI.getExpiringSoon(90),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!searchTerm) return medications;
    const q = searchTerm.toLowerCase();
    return medications.filter((m: any) =>
      m.name?.toLowerCase().includes(q) ||
      m.genericName?.toLowerCase().includes(q) ||
      m.medicationCode?.toLowerCase().includes(q)
    );
  }, [medications, searchTerm]);

  return (
    <RoleLayout
      title="Pharmacy Inventory"
      subtitle="Read-only view of drug stock levels"
      role="pharmacist"
      userName={profile?.fullName}
    >
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Inventory is managed centrally</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Stock receipts, adjustments, and supplier management are handled by the Inventory Manager.
            {isAdmin && (
              <>
                {' '}As admin, you can access the full inventory system.
              </>
            )}
          </p>
        </div>
        {isAdmin && (
          <Link to="/inventory">
            <Button size="sm" variant="outline">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open Inventory
            </Button>
          </Link>
        )}
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total SKUs</p>
              <p className="text-xl font-semibold">{medications.length}</p>
            </div>
            <Package className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div className="bg-card border rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Low Stock</p>
              <p className={cn('text-xl font-semibold', lowStock.length > 0 && 'text-amber-600')}>
                {lowStock.length}
              </p>
            </div>
            <AlertTriangle className={cn('w-5 h-5', lowStock.length > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
          </div>
        </div>
        <div className="bg-card border rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Expiring (90d)</p>
              <p className={cn('text-xl font-semibold', expiring.length > 0 && 'text-red-600')}>
                {expiring.length}
              </p>
            </div>
            <Clock className={cn('w-5 h-5', expiring.length > 0 ? 'text-red-500' : 'text-muted-foreground')} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search medications by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Medications table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Medication Stock</h3>
          <span className="text-xs text-muted-foreground">{filtered.length} items</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Form / Strength</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reorder at</TableHead>
                <TableHead>Batch / Expiry</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    {searchTerm ? 'No medications match your search' : 'No medications in inventory'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m: any) => {
                  const isLow = m.stockQuantity <= m.reorderLevel;
                  const isExpiringSoon = m.expiryDate && new Date(m.expiryDate).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;
                  return (
                    <TableRow key={m._id}>
                      <TableCell>
                        <p className="font-medium text-sm">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.genericName}</p>
                      </TableCell>
                      <TableCell className="text-xs">{m.medicationCode}</TableCell>
                      <TableCell className="text-xs">
                        {m.dosageForm || '—'}{m.strength ? ` • ${m.strength}` : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={isLow ? 'destructive' : 'outline'}>
                          {m.stockQuantity} {m.unit || ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {m.reorderLevel}
                      </TableCell>
                      <TableCell className="text-xs">
                        <p>{m.batchNumber || '—'}</p>
                        <p className={isExpiringSoon ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '—'}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        Le {Number(m.unitPrice || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </RoleLayout>
  );
}

