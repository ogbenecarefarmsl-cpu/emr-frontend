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
    'ml',
  ];

  return countUnits.some((unit) => unitText.startsWith(unit)) ? count : 1;
};

export const computeMedicationQuantity = (item: MedicationQuantityInput, _med?: MedicationLike) => {
  const unitsPerDose = parseDoseUnitCount(item.strengthPerDose);
  const dosesPerDay = Math.max(1, Number(item.dosesPerDay || 1));
  const durationDays = Math.max(1, Number(item.durationDays || 1));
  return Math.max(1, Math.round(unitsPerDose * dosesPerDay * durationDays * 100) / 100);
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
