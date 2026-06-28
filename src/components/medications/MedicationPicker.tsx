import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  getMedicationBaseUnit,
  getMedicationPrice,
  getMedicationRouteLabel,
  getMedicationStock,
  isParenteralOrInfusion,
  type MedicationLike,
} from '@/lib/medicationIntelligence';
import { Check, Package, Pill, Search, Syringe } from 'lucide-react';

type FilterKey = 'all' | 'injection' | 'infusion' | 'oral' | 'stock';

interface MedicationPickerProps {
  medications: MedicationLike[];
  loading?: boolean;
  selectedId?: string;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  onSelect: (medication: MedicationLike) => void;
  compact?: boolean;
  title?: string;
  emptyText?: string;
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'injection', label: 'IV/IM' },
  { key: 'infusion', label: 'Infusion' },
  { key: 'oral', label: 'Oral' },
  { key: 'stock', label: 'In stock' },
];

const matchesFilter = (med: MedicationLike, filter: FilterKey) => {
  const label = getMedicationRouteLabel(med).toLowerCase();
  const text = [med.name, med.genericName, med.category, med.unit, med.baseUnit].filter(Boolean).join(' ').toLowerCase();
  if (filter === 'all') return true;
  if (filter === 'stock') return getMedicationStock(med) > 0;
  if (filter === 'oral') return label === 'oral' || /\b(tablet|capsule|syrup|suspension)\b/.test(text);
  if (filter === 'infusion') return label === 'infusion' || /\b(infusion|drip|saline|dextrose|ringer|fluid)\b/.test(text);
  return isParenteralOrInfusion(med);
};

export function MedicationPicker({
  medications,
  loading,
  selectedId,
  searchTerm,
  onSearchTermChange,
  onSelect,
  compact,
  title = 'Medication',
  emptyText = 'No medications found',
}: MedicationPickerProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const query = searchTerm ?? internalSearch;
  const setQuery = onSearchTermChange ?? setInternalSearch;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (medications || [])
      .filter((med) => matchesFilter(med, filter))
      .filter((med) => {
        if (!q) return true;
        return [med.name, med.genericName, med.brand, med.category, med.unit, med.baseUnit, med._id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .slice(0, compact ? 60 : 120);
  }, [medications, filter, query, compact]);

  return (
    <div className="rounded-lg border bg-background">
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-[11px] text-muted-foreground">{medications.length} CAF/local products loaded</p>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Package className="h-3 w-3" />
            Units visible
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search drug, brand, SKU, route, unit..."
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={filter === item.key ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => setFilter(item.key)}
            >
              {item.key === 'injection' ? <Syringe className="mr-1 h-3 w-3" /> : item.key === 'oral' ? <Pill className="mr-1 h-3 w-3" /> : null}
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      <ScrollArea className={compact ? 'h-72' : 'h-80'}>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading medications...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          <div className="divide-y">
            {filtered.map((med) => {
              const stock = getMedicationStock(med);
              const unit = getMedicationBaseUnit(med);
              const routeLabel = getMedicationRouteLabel(med);
              const prominent = isParenteralOrInfusion(med);
              const selected = selectedId === med._id;

              return (
                <button
                  key={med._id || med.name}
                  type="button"
                  disabled={stock <= 0}
                  onClick={() => stock > 0 && onSelect(med)}
                  className={cn(
                    'w-full text-left transition-colors',
                    stock > 0 ? 'hover:bg-muted/60' : 'cursor-not-allowed bg-muted/20 opacity-60',
                    selected && 'bg-primary/5',
                  )}
                >
                  <div className={cn('flex gap-3 p-3', prominent && 'border-l-4 border-l-blue-500')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{med.name}</p>
                        {(med.__cafProduct || med.isCafSourced) && <Badge variant="outline" className="text-[10px]">CAF</Badge>}
                        {prominent && <Badge className="bg-blue-600 text-[10px] text-white">{routeLabel}</Badge>}
                        {!prominent && <Badge variant="secondary" className="text-[10px]">{routeLabel}</Badge>}
                        {med.isControlled && <Badge variant="destructive" className="text-[10px]">Controlled</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        {med.genericName && <span className="truncate">{med.genericName}</span>}
                        {med.category && <span>{med.category}</span>}
                        <span className="font-medium text-foreground">{unit}</span>
                        <span>Le {getMedicationPrice(med).toLocaleString()}</span>
                      </div>
                      {med.packSizes && med.packSizes.length > 0 && (
                        <p className="mt-1 truncate text-[10px] text-muted-foreground">
                          Packs: {med.packSizes.map((pack) => `${pack.name} (${pack.unitsPerPack ?? pack.quantityPerPack} ${unit})`).join(' | ')}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                      {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                      <span className={cn('text-xs font-semibold', stock > 0 ? 'text-emerald-700' : 'text-red-600')}>
                        {stock > 0 ? `${stock} ${unit}` : 'No stock'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
