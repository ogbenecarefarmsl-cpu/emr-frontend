export type MedicationLike = {
  _id?: string;
  name?: string;
  genericName?: string;
  brand?: string;
  category?: string;
  dosageForm?: string;
  unit?: string;
  baseUnit?: string;
  strength?: string;
  stockQuantity?: number;
  quantityAvailable?: number;
  stockAvailable?: number;
  stock?: number;
  calculatedStock?: number;
  availableStock?: number;
  unitPrice?: number;
  suggestedRetailPrice?: number;
  sellingPrice?: number;
  price?: number;
  basePrice?: number;
  isControlled?: boolean;
  requiresPrescription?: boolean;
  __cafProduct?: boolean;
  isCafSourced?: boolean;
  packSizes?: Array<{
    name?: string;
    unit?: string;
    quantityPerPack?: number;
    unitsPerPack?: number;
    sellingPrice?: number;
  }>;
};

export type MedicationQuantityInput = {
  strengthPerDose?: string;
  dosesPerDay?: number;
  durationDays?: number;
  quantity?: number;
};

export type MedicationDispenseEstimate = {
  baseQuantity: number;
  sellQuantity: number;
  sellUnitLabel: string;
  pricePerSellUnit: number;
  lineTotal: number;
  mode: 'individual' | 'pack';
  packName?: string;
  packUnits?: number;
};

export type RouteHint =
  | 'oral'
  | 'intravenous'
  | 'intramuscular'
  | 'subcutaneous'
  | 'topical'
  | 'ophthalmic'
  | 'otic'
  | 'nasal'
  | 'inhalation'
  | 'rectal'
  | 'sublingual'
  | 'other';

const textFor = (med: MedicationLike) =>
  [
    med.name,
    med.genericName,
    med.brand,
    med.category,
    med.dosageForm,
    med.unit,
    med.baseUnit,
    med.strength,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const getMedicationBaseUnit = (med: MedicationLike) =>
  med.baseUnit || med.unit || med.packSizes?.[0]?.unit || 'unit';

export const getMedicationStock = (med: MedicationLike) =>
  Number(
    med.stockQuantity ??
      med.quantityAvailable ??
      med.stockAvailable ??
      med.stock ??
      med.calculatedStock ??
      med.availableStock ??
      0,
  ) || 0;

export const getMedicationPrice = (med: MedicationLike) => {
  const defaultPack = med.packSizes?.[0];
  const packUnits = Number(defaultPack?.unitsPerPack ?? defaultPack?.quantityPerPack ?? 0);
  const packPrice = Number(defaultPack?.sellingPrice ?? 0);
  return (
    Number(
      med.unitPrice ??
        (packPrice > 0 && packUnits > 0 ? packPrice / packUnits : undefined) ??
        med.suggestedRetailPrice ??
        med.sellingPrice ??
        med.price ??
        med.basePrice ??
        0,
    ) || 0
  );
};

const getPackUnits = (pack?: MedicationLike['packSizes'][number]) =>
  Number(pack?.unitsPerPack ?? pack?.quantityPerPack ?? 0) || 0;

const getPackPrice = (pack?: MedicationLike['packSizes'][number]) =>
  Number(pack?.sellingPrice ?? 0) || 0;

const getSortedPacks = (med?: MedicationLike) =>
  [...(med?.packSizes || [])]
    .map((pack) => ({
      pack,
      units: getPackUnits(pack),
      price: getPackPrice(pack),
    }))
    .filter((entry) => entry.units > 0 && entry.price > 0)
    .sort((a, b) => a.units - b.units || a.price - b.price);

export const inferMedicationRoute = (med: MedicationLike): RouteHint => {
  const text = textFor(med);
  if (/\b(sublingual|sl)\b/.test(text)) return 'sublingual';
  if (/\b(inhaler|nebule|nebul|puff|inhalation)\b/.test(text)) return 'inhalation';
  if (/\b(rectal|suppository|enema)\b/.test(text)) return 'rectal';
  if (/\b(eye|ophthalmic)\b/.test(text)) return 'ophthalmic';
  if (/\b(ear|otic)\b/.test(text)) return 'otic';
  if (/\b(nasal|nose)\b/.test(text)) return 'nasal';
  if (/\b(cream|ointment|gel|lotion|topical)\b/.test(text)) return 'topical';
  if (/\b(subcutaneous|s\/c|sc)\b/.test(text)) return 'subcutaneous';
  if (/\b(intramuscular|i\/m| im |im\b)\b/.test(` ${text} `)) return 'intramuscular';
  if (/\b(infusion|intravenous|i\/v| iv |drip|normal saline|saline|dextrose|ringer|fluid)\b/.test(` ${text} `)) return 'intravenous';
  if (/\b(injection|inj|vial|ampoule|ampule|sodium)\b/.test(text)) return 'intravenous';
  return 'oral';
};

export const getMedicationRouteLabel = (med: MedicationLike) => {
  const text = textFor(med);
  if (/\b(infusion|drip|normal saline|saline|dextrose|ringer|fluid)\b/.test(text)) return 'Infusion';
  const route = inferMedicationRoute(med);
  if (route === 'intravenous' && /\b(injection|inj|vial|ampoule|ampule)\b/.test(text)) return 'IV/IM';
  const labels: Record<RouteHint, string> = {
    oral: 'Oral',
    intravenous: 'IV',
    intramuscular: 'IM',
    subcutaneous: 'SC',
    topical: 'Topical',
    ophthalmic: 'Eye',
    otic: 'Ear',
    nasal: 'Nasal',
    inhalation: 'Inhale',
    rectal: 'Rectal',
    sublingual: 'SL',
    other: 'Other',
  };
  return labels[route];
};

export const isParenteralOrInfusion = (med: MedicationLike) => {
  const text = textFor(med);
  return /\b(injection|inj|infusion|intravenous|i\/v| iv |intramuscular|i\/m| im |vial|ampoule|ampule|drip|saline|dextrose|ringer|fluid)\b/.test(` ${text} `);
};

export const buildSmartRegimen = (med: MedicationLike) => {
  const unit = getMedicationBaseUnit(med).toLowerCase();
  const route = inferMedicationRoute(med);
  const text = textFor(med);
  let strengthPerDose = med.strength || `1 ${unit}`;
  let dosesPerDay = 1;
  let durationDays = 7;

  if (/\b(tablet|tab)\b/.test(unit)) {
    strengthPerDose = '1 tablet';
    dosesPerDay = 2;
  } else if (/\b(capsule|cap)\b/.test(unit)) {
    strengthPerDose = '1 capsule';
    dosesPerDay = 2;
  } else if (/\b(syrup|suspension|ml)\b/.test(text)) {
    strengthPerDose = '5 ml';
    dosesPerDay = 3;
  } else if (/\b(drop|eye|ear|nasal)\b/.test(text)) {
    strengthPerDose = '1 drop';
    dosesPerDay = 3;
  } else if (/\b(cream|ointment|gel|lotion)\b/.test(text)) {
    strengthPerDose = 'thin layer';
    dosesPerDay = 2;
  } else if (isParenteralOrInfusion(med)) {
    strengthPerDose = `1 ${unit || 'vial'}`;
    dosesPerDay = 1;
    durationDays = 1;
  }

  return { strengthPerDose, dosesPerDay, durationDays, route };
};

export const parseDoseUnitCount = (strengthPerDose?: string) => {
  const value = (strengthPerDose || '').trim().toLowerCase();
  const match = value.match(/^(\d+(?:\.\d+)?)/);
  if (!match) return 1;

  const count = Number(match[1]);
  const unitText = value.slice(match[0].length).trim();
  const countUnits = [
    'tablet',
    'tablets',
    'tab',
    'tabs',
    'capsule',
    'capsules',
    'cap',
    'caps',
    'ampule',
    'ampules',
    'ampoule',
    'ampoules',
    'vial',
    'vials',
    'patch',
    'patches',
    'drop',
    'drops',
    'puff',
    'puffs',
    'sachet',
    'sachets',
  ];

  return countUnits.some((unit) => unitText.startsWith(unit)) ? count : 1;
};

export const computeMedicationQuantity = (item: MedicationQuantityInput, _med?: MedicationLike) => {
  const unitsPerDose = parseDoseUnitCount(item.strengthPerDose);
  const dosesPerDay = Math.max(1, Number(item.dosesPerDay || 1));
  const durationDays = Math.max(1, Number(item.durationDays || 1));
  return Math.max(1, Math.round(unitsPerDose * dosesPerDay * durationDays * 100) / 100);
};

export const estimateMedicationDispense = (
  item: MedicationQuantityInput,
  med?: MedicationLike,
): MedicationDispenseEstimate => {
  const baseQuantity = Number(item.quantity || computeMedicationQuantity(item, med) || 1);
  const packs = getSortedPacks(med);
  const baseUnit = med ? getMedicationBaseUnit(med) : 'unit';
  const shouldUsePack = !!med && med.sellMode !== 'individual' && packs.length > 0;

  if (shouldUsePack) {
    const exact = packs.find((entry) => entry.units === baseQuantity);
    const coveringPacks = packs
      .map((entry) => ({
        ...entry,
        sellQuantity: Math.max(1, Math.ceil(baseQuantity / entry.units)),
      }))
      .map((entry) => ({
        ...entry,
        coveredUnits: entry.sellQuantity * entry.units,
        lineTotal: entry.sellQuantity * entry.price,
      }))
      .filter((entry) => entry.coveredUnits >= baseQuantity)
      .sort((a, b) => a.coveredUnits - b.coveredUnits || a.lineTotal - b.lineTotal);
    const selected = exact
      ? { ...exact, sellQuantity: 1, coveredUnits: exact.units, lineTotal: exact.price }
      : coveringPacks[0];

    if (selected) {
      return {
        baseQuantity,
        sellQuantity: selected.sellQuantity,
        sellUnitLabel: selected.pack.name || selected.pack.unit || 'pack',
        pricePerSellUnit: selected.price,
        lineTotal: selected.lineTotal,
        mode: 'pack',
        packName: selected.pack.name,
        packUnits: selected.units,
      };
    }
  }

  const pricePerSellUnit = med ? getMedicationPrice(med) : 0;
  return {
    baseQuantity,
    sellQuantity: baseQuantity,
    sellUnitLabel: baseUnit,
    pricePerSellUnit,
    lineTotal: baseQuantity * pricePerSellUnit,
    mode: 'individual',
  };
};

export const validateMedicationRegimen = (item: MedicationQuantityInput) => {
  const errors: string[] = [];
  if (!item.strengthPerDose?.trim()) errors.push('Per dose is required.');
  if (Number(item.dosesPerDay || 0) < 1) errors.push('Doses/day must be at least 1.');
  if (Number(item.dosesPerDay || 0) > 24) errors.push('Doses/day cannot exceed 24.');
  if (Number(item.durationDays || 0) < 1) errors.push('Days must be at least 1.');
  if (Number(item.durationDays || 0) > 365) errors.push('Days cannot exceed 365.');
  if (Number(item.quantity || 0) < 1) errors.push('Qty to dispense must be at least 1.');
  return errors;
};

export const frequencyText = (dosesPerDay: number) => {
  if (dosesPerDay === 1) return 'once daily';
  if (dosesPerDay === 2) return 'twice daily';
  if (dosesPerDay === 3) return '3 times daily';
  if (dosesPerDay === 4) return '4 times daily';
  if (dosesPerDay === 6) return 'every 4 hours';
  if (dosesPerDay === 8) return 'every 3 hours';
  if (dosesPerDay === 12) return 'every 2 hours';
  return `${dosesPerDay || 1} times daily`;
};

export const buildSmartInstruction = ({
  strengthPerDose,
  dosesPerDay,
  durationDays,
  route,
}: {
  strengthPerDose?: string;
  dosesPerDay?: number;
  durationDays?: number;
  route?: string;
}) => {
  const dose = strengthPerDose?.trim() || '1 dose';
  const days = Number(durationDays || 1);
  const frequency = frequencyText(Number(dosesPerDay || 1));
  const routeText = route || 'oral';
  const prefix =
    routeText === 'oral'
      ? `Take ${dose} by mouth`
      : routeText === 'intravenous'
        ? `Administer ${dose} intravenously`
        : routeText === 'intramuscular'
          ? `Administer ${dose} intramuscularly`
          : routeText === 'subcutaneous'
            ? `Inject ${dose} subcutaneously`
            : routeText === 'topical'
              ? `Apply ${dose} topically`
              : routeText === 'ophthalmic'
                ? `Instill ${dose} into affected eye`
                : routeText === 'otic'
                  ? `Instill ${dose} into affected ear`
                  : routeText === 'nasal'
                    ? `Use ${dose} nasally`
                    : routeText === 'inhalation'
                      ? `Inhale ${dose}`
                      : `Use ${dose}`;

  return `${prefix} ${frequency} for ${days} ${days === 1 ? 'day' : 'days'}.`;
};

// ── Shorthand parser ──────────────────────────────────────────────────────────
// Parses clinical shorthand like "BD 5/7", "TDS 14d", "500mg OD 7days",
// "1tab QID 5/7 IV", "2 caps BD 2w", "500mg PRN", "TDS PRN 5/7" into structured regimen fields.

export type ShorthandParseResult = {
  strengthPerDose: string;
  dosesPerDay: number;
  durationDays: number;
  route: RouteHint;
  raw: string;
  /** True if PRN/SOS (as needed) — frequency is a maximum, not a schedule */
  isPrn: boolean;
  /** Human-readable interpretation, e.g. "2x/day for 5 days" or "as needed, max 3x/day" */
  interpretation: string;
};

const FREQ_MAP: Record<string, number> = {
  od: 1, qd: 1, daily: 1, once: 1,
  bd: 2, bid: 2, bi: 2, twice: 2,
  tds: 3, tid: 3, three: 3,
  qid: 4, qds: 4, four: 4,
  q4h: 6, '4hly': 6,
  q6h: 4, '6hly': 4,
  q8h: 3, '8hly': 3,
  q12h: 2, '12hly': 2,
  hs: 1, nocte: 1, bedtime: 1,
  stat: 1, now: 1,
  // PRN/SOS are NOT frequencies — handled separately as modifiers
};

const PRN_TOKENS = ['prn', 'sos', 'asneeded'];

const ROUTE_MAP: Record<string, RouteHint> = {
  iv: 'intravenous',
  im: 'intramuscular',
  sc: 'subcutaneous',
  sl: 'sublingual',
  topical: 'topical',
  local: 'topical',
  eye: 'ophthalmic',
  ear: 'otic',
  nasal: 'nasal',
  inh: 'inhalation',
  inhale: 'inhalation',
  rectal: 'rectal',
};

/** Parse slash-style durations: 5/7 (days), 3/52 (weeks), 6/12 (months) → total days */
const parseSlashDuration = (s: string): number | null => {
  const m = s.match(/^(\d{1,3})\s*\/\s*\/?\s*(\d{1,3})$/);
  if (!m) return null;
  const num = Number(m[1]);
  const denom = Number(m[2]);
  if (denom === 7) return num;            // 3/7 = 3 days
  if (denom === 52) return num * 7;       // 3/52 = 3 weeks = 21 days
  if (denom === 12) return num * 30;      // 6/12 = 6 months = 180 days
  return num;                              // fallback: numerator as days
};

/** Parse a single shorthand string into structured regimen */
export const parseShorthand = (input: string): ShorthandParseResult | null => {
  const raw = input.trim();
  if (!raw) return null;

  let lower = raw.toLowerCase().replace(/[;,]/g, ' ').replace(/\s+/g, ' ').trim();

  let dosesPerDay = 2;
  let durationDays = 7;
  let strengthPerDose = '';
  let route: RouteHint = 'oral';
  let isPrn = false;

  // 1. Extract PRN/SOS modifier (before frequency, so "TDS PRN" works)
  for (const token of PRN_TOKENS) {
    const re = new RegExp(`\\b${token}\\b`, 'i');
    if (re.test(lower)) {
      isPrn = true;
      lower = lower.replace(re, ' ').trim();
      break;
    }
  }

  // 2. Extract route from end or middle
  for (const [token, r] of Object.entries(ROUTE_MAP)) {
    const re = new RegExp(`\\b${token}\\b`, 'i');
    if (re.test(lower)) {
      route = r;
      lower = lower.replace(re, ' ').trim();
      break;
    }
  }

  // 3. Extract duration: "5/7", "5//7", "7d", "14days", "2w", "1m"
  const slashMatch = lower.match(/(\d{1,3}\s*\/\s*\/?\s*\d{1,3})/);
  if (slashMatch) {
    const d = parseSlashDuration(slashMatch[1]);
    if (d && d > 0) {
      durationDays = d;
      lower = lower.replace(slashMatch[1], ' ').trim();
    }
  }
  if (durationDays === 7) {
    const unitMatch = lower.match(/\b(\d{1,3})\s*(days?|d|weeks?|w|months?|m)\b/);
    if (unitMatch) {
      const n = Number(unitMatch[1]);
      const unit = unitMatch[2][0];
      if (unit === 'd') durationDays = n;
      else if (unit === 'w') durationDays = n * 7;
      else if (unit === 'm') durationDays = n * 30;
      lower = lower.replace(unitMatch[0], ' ').trim();
    }
  }

  // 4. Extract frequency
  const freqTokens = Object.keys(FREQ_MAP).sort((a, b) => b.length - a.length);
  for (const token of freqTokens) {
    const re = new RegExp(`\\b${token}\\b`, 'i');
    if (re.test(lower)) {
      dosesPerDay = FREQ_MAP[token];
      lower = lower.replace(re, ' ').trim();
      break;
    }
  }

  // 5. What remains should be the strength/dose, e.g. "500mg", "1 tab", "2 caps", "5ml"
  const remainder = lower.replace(/\s+/g, ' ').trim();
  if (remainder) {
    strengthPerDose = remainder;
  }

  // If no explicit strength was given, use sensible defaults
  if (!strengthPerDose) {
    strengthPerDose = '1 dose';
  }

  // PRN defaults: if no frequency specified alongside PRN, use 1 dose/day
  // (the "1" is just for quantity computation — the actual max is flexible)
  if (isPrn && dosesPerDay === 2) {
    // No explicit frequency given with PRN — default to "as needed, no fixed schedule"
    dosesPerDay = 1;
  }

  // Build interpretation
  let interpretation: string;
  if (isPrn) {
    if (dosesPerDay > 1) {
      interpretation = `${strengthPerDose} — as needed, max ${frequencyText(dosesPerDay)} for ${durationDays} day${durationDays === 1 ? '' : 's'}`;
    } else {
      interpretation = `${strengthPerDose} — as needed for ${durationDays} day${durationDays === 1 ? '' : 's'}`;
    }
  } else {
    interpretation = `${strengthPerDose} — ${frequencyText(dosesPerDay)} for ${durationDays} day${durationDays === 1 ? '' : 's'}`;
  }

  return {
    strengthPerDose,
    dosesPerDay,
    durationDays,
    route,
    raw,
    isPrn,
    interpretation,
  };
};

/** Apply a shorthand parse result to a prescription item */
export const applyShorthand = (
  item: Record<string, any>,
  parsed: ShorthandParseResult,
): Record<string, any> => {
  const updated = { ...item };
  updated.strengthPerDose = parsed.strengthPerDose;
  updated.dosesPerDay = parsed.dosesPerDay;
  updated.durationDays = parsed.durationDays;
  updated.route = parsed.route;
  updated.isPrn = parsed.isPrn;

  const nextComputedQuantity = computeMedicationQuantity(updated, { baseUnit: updated.baseUnit });
  updated.computedQuantity = nextComputedQuantity;
  if (!updated.quantityTouched) {
    updated.quantity = nextComputedQuantity;
  }

  // Build PRN-aware instructions
  let nextInstruction: string;
  if (parsed.isPrn) {
    const dose = parsed.strengthPerDose?.trim() || '1 dose';
    const routeText = parsed.route || 'oral';
    const prefix =
      routeText === 'oral'
        ? `Take ${dose} by mouth as needed`
        : routeText === 'intravenous'
          ? `Administer ${dose} intravenously as needed`
          : routeText === 'intramuscular'
            ? `Administer ${dose} intramuscularly as needed`
            : routeText === 'topical'
              ? `Apply ${dose} topically as needed`
              : `Use ${dose} as needed`;
    if (parsed.dosesPerDay > 1) {
      nextInstruction = `${prefix}, up to ${frequencyText(parsed.dosesPerDay)}, for ${parsed.durationDays} ${parsed.durationDays === 1 ? 'day' : 'days'}.`;
    } else {
      nextInstruction = `${prefix} for ${parsed.durationDays} ${parsed.durationDays === 1 ? 'day' : 'days'}.`;
    }
  } else {
    nextInstruction = buildSmartInstruction({
      strengthPerDose: updated.strengthPerDose,
      dosesPerDay: updated.dosesPerDay,
      durationDays: updated.durationDays,
      route: updated.route,
    });
  }

  if (!updated.instructions || updated.instructions === updated.smartInstruction) {
    updated.instructions = nextInstruction;
  }
  updated.smartInstruction = nextInstruction;

  return updated;
};
