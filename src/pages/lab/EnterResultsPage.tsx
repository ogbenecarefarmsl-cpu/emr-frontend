import { useEffect, useRef, useState, useMemo } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useProcessingOrders, useUpdateOrder } from '@/hooks/useOrders';
import { useCreateResult, useCreateBulkResults, useResults } from '@/hooks/useResults';
import { useAllTests } from '@/hooks/useTestCatalog';
import { useWebSocket } from '@/context/WebSocketContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Check, AlertTriangle, Loader2, Search, Radio, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderWithDetails } from '@/hooks/useOrders';
import { getPatientName, getOrderNumber } from '@/utils/orderHelpers';
import { SendToAnalyzerDialog } from '@/components/machines/SendToAnalyzerDialog';

type ResultFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' | 'no_range';

const MONGO_OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

// Standard options for qualitative/semi-quantitative tests
const QUALITATIVE_OPTIONS: Record<string, string[]> = {
  // ── Urinalysis physical ─────────────────────────────────────────────────
  'URINE-COLOR': ['Yellow', 'Pale Yellow', 'Straw', 'Amber', 'Dark Yellow', 'Orange', 'Brown', 'Red', 'Colorless'],
  'URINE-CLARITY': ['Clear', 'Slightly cloudy', 'Cloudy', 'Turbid', 'Very Turbid', 'Hazy'],
  // ── Urinalysis chemical ─────────────────────────────────────────────────
  'URINE-PROTEIN': ['Negative', 'Trace', '+1', '+2', '+3', '+4'],
  'UPROTEIN': ['Negative', 'Trace', '+1', '+2', '+3', '+4'],
  'U-PROTEIN': ['Negative', 'Trace', '+1', '+2', '+3', '+4'],
  'URINE-GLUCOSE': ['Negative', 'Trace', '+1', '+2', '+3', '+4'],
  'URINE-KETONES': ['Negative', 'Trace', '+1', '+2', '+3'],
  'URINE-BLOOD': ['Negative', 'Trace', '+1', '+2', '+3'],
  'URINE-BILI': ['Negative', '+1', '+2', '+3'],
  'URINE-URO': ['Normal (0.1–1.0 mg/dL)', '2 mg/dL', '4 mg/dL', '8 mg/dL'],
  'URINE-NITRITE': ['Negative', 'Positive'],
  'URINE-LE': ['Negative', 'Trace', '+1', '+2', '+3'],
  // ── Urinalysis microscopy ───────────────────────────────────────────────
  'URINE-BACTERIA': ['None', '+1 (Rare)', '+2 (Few)', '+3 (Moderate)', '+4 (Many)'],
  'URINE-EPI': ['None', 'Rare', 'Few', 'Moderate', 'Many'],
  'URINE-CASTS': ['None Seen', 'Rare', '0–1/LPF', '1–2/LPF', '2–5/LPF', '>5/LPF'],
  'URINE-CRYSTALS': ['None', 'Rare', 'Few', 'Moderate', 'Many'],
  // ── Rapid tests (Positive / Negative) ──────────────────────────────────
  'MALARIA': ['Negative', 'Positive (P. falciparum)', 'Positive (P. vivax)', 'Positive (Mixed)'],
  'RVS': ['Non-Reactive', 'Reactive'],
  'HBSAG': ['Non-Reactive', 'Reactive'],
  'HCV': ['Non-Reactive', 'Reactive'],
  'RVSP24': ['Non-Reactive', 'Reactive'],
  'HPYLORI': ['Non-Reactive', 'Reactive'],
  'HPYLORI_IA': ['Non-Reactive', 'Reactive'],
  'IFOB': ['Negative', 'Positive'],
  'GONORRHEA': ['Negative', 'Positive'],
  'CHLAMYDIA': ['Negative', 'Positive'],
  'HSV': ['Non-Reactive', 'Reactive (HSV-1)', 'Reactive (HSV-2)', 'Reactive (HSV-1 & 2)'],
  'PREGNANCY': ['Negative', 'Positive'],
  // ── Serology (titered) ──────────────────────────────────────────────────
  'VDRL': ['Non-Reactive', 'Weakly Reactive', 'Reactive (1:1)', 'Reactive (1:2)', 'Reactive (1:4)', 'Reactive (1:8)', 'Reactive (1:16)', 'Reactive (1:32)'],
  // ── Typhoid strip — IgM / IgG ───────────────────────────────────────────
  'WIDAL': [
    'IgM: Non-Reactive  |  IgG: Non-Reactive',
    'IgM: Reactive      |  IgG: Non-Reactive',
    'IgM: Non-Reactive  |  IgG: Reactive',
    'IgM: Reactive      |  IgG: Reactive',
  ],
  'HPAG': ['Negative', 'Positive'],
  // ── Hematology special ──────────────────────────────────────────────────
  'BLOODGROUP': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'SICKLE': ['AA – Normal', 'AS – Sickle Cell Trait', 'SS – Sickle Cell Disease', 'SC – Sickle-Haemoglobin C'],
  'HBGENO': ['AA', 'AS', 'SS', 'SC'],
};

// Tests that need a free-text area (complex/descriptive results)
const TEXTAREA_TESTS = new Set(['STOOLMICRO']);

// Structured fields for Stool Microscopy (replaces plain textarea)
const STOOL_MICRO_FIELDS = {
  color: { label: 'Color', options: ['Yellow', 'Brown', 'Red', 'Black', 'Green', 'Clay-colored', 'White'] },
  appearance: { label: 'Appearance', options: ['Soft', 'Coarse', 'Watery', 'Mucoid', 'Formed', 'Semi-formed', 'Hard', 'Pellet-like'] },
  blood: { label: 'Blood', options: ['None', 'Trace', 'Moderate', 'Frank', 'Occult'] },
  mucus: { label: 'Mucus', options: ['None', 'Trace', 'Moderate', 'Abundant'] },
  microscopy: { label: 'Microscopy', textarea: true },
};
const STOOL_MICRO_TEST_CODES = new Set(['STOOLMICRO', 'STOOL', 'STOOLEXAM']);

// Hormone tests that have phase-specific ranges
const HORMONE_TESTS_WITH_PHASES = new Set(['FSH', 'LH', 'PROG', 'PROGESTERONE', 'E2', 'ESTRADIOL']);

// Menstrual phase options for hormone tests
const MENSTRUAL_PHASE_OPTIONS = [
  { value: 'follicular', label: 'Follicular Phase (Day 1-14)' },
  { value: 'ovulation', label: 'Ovulation Phase (Day 14-16)' },
  { value: 'luteal', label: 'Luteal Phase (Day 15-28)' },
  { value: 'menopause', label: 'Menopause' },
  { value: 'pregnancy', label: 'Pregnancy' },
];

const normalizeTestCode = (value?: string) =>
  (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const TEST_CODE_ALIASES: Record<string, string[]> = {
  HSCRP: ['HSCR'],
  HSCR: ['HSCRP'],
  UPROTEIN: ['URINEPROTEIN', 'UPRO'],
  URINEPROTEIN: ['UPROTEIN', 'UPRO'],
  UPRO: ['UPROTEIN', 'URINEPROTEIN'],
};

const getComparableCodes = (code?: string): Set<string> => {
  const normalizedCode = normalizeTestCode(code);
  const codes = new Set<string>();
  if (!normalizedCode) return codes;

  codes.add(normalizedCode);
  const aliases = TEST_CODE_ALIASES[normalizedCode] || [];
  aliases.forEach((alias) => codes.add(alias));
  return codes;
};

const findCatalogTestByCode = (catalog: any[] | undefined, code?: string) => {
  const comparableCodes = getComparableCodes(code);
  if (comparableCodes.size === 0 || !catalog || catalog.length === 0) {
    return undefined;
  }

  return catalog.find((catalogTest: any) => {
    const catalogComparableCodes = getComparableCodes(catalogTest?.code);
    if (catalogComparableCodes.size === 0) return false;

    for (const candidate of comparableCodes) {
      if (catalogComparableCodes.has(candidate)) {
        return true;
      }
    }

    return false;
  });
};

const MCHC_CODE = 'MCHC';

const isMchcTest = (testCode?: string) => normalizeTestCode(testCode) === MCHC_CODE;

const formatScaledNumericValue = (numericValue: number): string => {
  if (!Number.isFinite(numericValue)) return '';
  return parseFloat(numericValue.toFixed(1)).toString();
};

const normalizeMchcValue = (testCode: string, rawValue?: string | number): string => {
  const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
  if (!value || !isMchcTest(testCode)) {
    return value;
  }

  const numericValue = parseFloat(value);
  if (Number.isNaN(numericValue)) {
    return value;
  }

  const normalizedValue = numericValue > 100 ? numericValue / 10 : numericValue;
  return formatScaledNumericValue(normalizedValue);
};

const normalizeMchcRange = (testCode: string, rawRange?: string): string => {
  const range = (rawRange || '').trim();
  if (!range || !isMchcTest(testCode)) {
    return range;
  }

  // Remove explicit unit text from range so the Unit column stays authoritative.
  const sanitizedRange = range.replace(/\bg\s*\/\s*(?:d)?l\b/gi, '').trim();

  const rangeMatch = sanitizedRange.match(/^(-?\d*\.?\d+)\s*(?:-|–)\s*(-?\d*\.?\d+)$/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const normalizedLow = low > 100 ? low / 10 : low;
    const normalizedHigh = high > 100 ? high / 10 : high;
    return `${formatScaledNumericValue(normalizedLow)}-${formatScaledNumericValue(normalizedHigh)}`;
  }

  const thresholdMatch = sanitizedRange.match(/^(<=|>=|<|>|≤|≥)\s*(-?\d*\.?\d+)$/);
  if (thresholdMatch) {
    const operator = thresholdMatch[1];
    const threshold = parseFloat(thresholdMatch[2]);
    const normalizedThreshold = threshold > 100 ? threshold / 10 : threshold;
    return `${operator} ${formatScaledNumericValue(normalizedThreshold)}`;
  }

  return sanitizedRange.replace(/-?\d*\.?\d+/g, (token) => {
    const numeric = parseFloat(token);
    if (Number.isNaN(numeric)) {
      return token;
    }

    const normalized = numeric > 100 ? numeric / 10 : numeric;
    return formatScaledNumericValue(normalized);
  });
};

const normalizeMchcThreshold = (testCode: string, rawThreshold?: string): string => {
  const threshold = (rawThreshold || '').trim();
  if (!threshold || !isMchcTest(testCode)) {
    return threshold;
  }

  const numericValue = parseFloat(threshold);
  if (Number.isNaN(numericValue)) {
    return threshold;
  }

  const normalizedValue = numericValue > 100 ? numericValue / 10 : numericValue;
  return formatScaledNumericValue(normalizedValue);
};

const normalizeMchcUnit = (testCode: string, rawUnit?: string): string => {
  if (isMchcTest(testCode)) {
    return 'g/dL';
  }

  return rawUnit || '';
};

interface ResultEntry {
  testId: string;
  orderTestId: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: ResultFlag;
  panelCode?: string;
  panelName?: string;
  category?: string;
  interpretation?: string; // Add interpretation field
  menstrualPhase?: string; // Add menstrual phase field
  allReferenceRanges?: Array<{ ageGroup: string; range: string; unit: string; gender?: string }>; // All applicable ranges
}

function includeLinkedInputTests(orderTests: any[]): any[] {
  const tests = Array.isArray(orderTests) ? [...orderTests] : [];
  const normalizeCode = (value?: string) => (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const existingCodes = new Set(
    tests.map((test) => normalizeCode(test.testCode || test.test_code)).filter(Boolean),
  );

  // UI fallback: always expose HSCRP entry when CRP is present.
  const hasCrp = existingCodes.has('CRP');
  const hasHsCrp = existingCodes.has('HSCRP') || existingCodes.has('HSCR');

  if (hasCrp && !hasHsCrp) {
    const crpTest = tests.find(
      (test) => normalizeCode(test.testCode || test.test_code) === 'CRP',
    );
    const linkedId = `linked-hscrp-${crpTest?.id || crpTest?._id || 'crp'}`;

    tests.push({
      id: linkedId,
      _id: linkedId,
      testId: linkedId,
      testCode: 'HSCRP',
      testName: 'hs CRP',
      category: crpTest?.category,
      panelCode: crpTest?.panelCode || crpTest?.panel_code,
      panelName: crpTest?.panelName || crpTest?.panel_name,
    });
  }

  // UI fallback: inject TCO2 and PH for orders that have the ELEC panel
  // but were placed before those two tests were added to the panel.
  const electCoreTests = ['K', 'NA', 'CL', 'ICA', 'NCA', 'TCA'];
  const hasElecPanel = electCoreTests.some(c => existingCodes.has(c));

  if (hasElecPanel) {
    // Find any existing ELEC panel test to copy its panelCode/panelName/category
    const electRef = tests.find((test) =>
      electCoreTests.includes(normalizeCode(test.testCode || test.test_code)),
    );

    const missingElecTests: Array<{ code: string; name: string }> = [
      { code: 'TCO2', name: 'Total Carbon Dioxide' },
      { code: 'PH',   name: 'Blood pH' },
    ];

    for (const missing of missingElecTests) {
      if (!existingCodes.has(missing.code)) {
        const linkedId = `linked-${missing.code.toLowerCase()}-for-elec`;
        tests.push({
          id: linkedId,
          _id: linkedId,
          testId: linkedId,
          testCode: missing.code,
          testName: missing.name,
          category: electRef?.category,
          panelCode: electRef?.panelCode || electRef?.panel_code,
          panelName: electRef?.panelName || electRef?.panel_name,
        });
      }
    }
  }

  return tests;
}

export default function EnterResultsPage() {
  const { profile, user, primaryRole } = useAuth();
  const { data: processingOrders, isLoading } = useProcessingOrders();
  const { data: testCatalog } = useAllTests(); // Use ALL tests, not just active ones
  const { socket } = useWebSocket();
  const updateOrder = useUpdateOrder();
  const createResult = useCreateResult();
  const createBulkResults = useCreateBulkResults();

  const searchRef = useRef<HTMLInputElement>(null);

  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [resultEntries, setResultEntries] = useState<Record<string, ResultEntry>>({});
  const [stoolMicroFields, setStoolMicroFields] = useState<Record<string, { color: string; appearance: string; blood: string; mucus: string; microscopy: string }>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSendToAnalyzer, setShowSendToAnalyzer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  // Track which entries were synced live from another user (testKey → time string)
  const [liveUpdates, setLiveUpdates] = useState<Record<string, string>>({});
  // FBC panel interpretation message (single line combining WBC, RBC, PLT messages)
  const [fbcMessage, setFbcMessage] = useState('');

  const getDraftStorageKey = (orderId?: string) => `result-draft:${orderId || 'unknown'}`;

  // Build combined stool microscopy value from individual fields
  const buildStoolMicroValue = (fields: { color: string; appearance: string; blood: string; mucus: string; microscopy: string }) => {
    const parts: string[] = [];
    if (fields.color) parts.push(`Color: ${fields.color}`);
    if (fields.appearance) parts.push(`Appearance: ${fields.appearance}`);
    if (fields.blood) parts.push(`Blood: ${fields.blood}`);
    if (fields.mucus) parts.push(`Mucus: ${fields.mucus}`);
    if (fields.microscopy) parts.push(`Microscopy: ${fields.microscopy}`);
    return parts.join('\n');
  };

  // Parse existing stool micro value back into individual fields
  const parseStoolMicroValue = (value: string) => {
    const fields = { color: '', appearance: '', blood: '', mucus: '', microscopy: '' };
    if (!value) return fields;
    const lines = value.split('\n');
    for (const line of lines) {
      if (line.startsWith('Color: ')) fields.color = line.replace('Color: ', '');
      else if (line.startsWith('Appearance: ')) fields.appearance = line.replace('Appearance: ', '');
      else if (line.startsWith('Blood: ')) fields.blood = line.replace('Blood: ', '');
      else if (line.startsWith('Mucus: ')) fields.mucus = line.replace('Mucus: ', '');
      else if (line.startsWith('Microscopy: ')) fields.microscopy = line.replace('Microscopy: ', '');
    }
    return fields;
  };

  const handleStoolMicroChange = (testKey: string, field: string, value: string) => {
    setStoolMicroFields(prev => {
      const current = prev[testKey] || parseStoolMicroValue(resultEntries[testKey]?.value || '');
      const updated = { ...current, [field]: value };
      // Also update the combined resultEntries value
      const combinedValue = buildStoolMicroValue(updated);
      setResultEntries(prevEntries => ({
        ...prevEntries,
        [testKey]: {
          ...prevEntries[testKey],
          testId: testKey,
          value: combinedValue,
          flag: 'normal' as const,
        },
      }));
      return { ...prev, [testKey]: updated };
    });
  };

  // Memoize the selected order ID to prevent infinite loops
  const selectedOrderId = useMemo(() => {
    if (!selectedOrder) return null;
    return selectedOrder.id || (selectedOrder as any)._id;
  }, [selectedOrder?.id, (selectedOrder as any)?._id]);

  // Fetch saved results from database for the selected order
  const { data: savedResults } = useResults(selectedOrderId || undefined);

  // Memoize the order tests to prevent infinite loops
  const selectedOrderTests = useMemo(() => {
    if (!selectedOrder) return [];
    const rawTests = (selectedOrder as any).tests || (selectedOrder as any).order_tests || [];
    return includeLinkedInputTests(rawTests);
  }, [selectedOrder]);

  const totalTests = selectedOrderTests.length;
  const completedTests = selectedOrderTests.filter((test: any) => {
    const testKey = test.id || test._id || test.testCode || test.test_code;
    return Boolean(resultEntries[testKey]?.value?.toString().trim());
  }).length;
  const progressPercent = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;

  useEffect(() => {
    if (!selectedOrder) {
      setResultEntries({});
      return;
    }

    const orderId = selectedOrder.id || (selectedOrder as any)._id;
    if (!orderId) {
      setResultEntries({});
      return;
    }

    // Build a map of saved results from database
    const savedResultsMap: Record<string, ResultEntry> = {};
    
    if (savedResults && Array.isArray(savedResults) && savedResults.length > 0) {
      for (const result of savedResults) {
        const testCode = result.testCode || result.test_code;
        
        // Find the matching order test to get the testKey
        const matchingTest = selectedOrderTests.find(
          (t: any) => (t.testCode || t.test_code) === testCode
        );
        
        if (matchingTest) {
          const testKey = matchingTest.id || matchingTest._id || testCode;
          const patient = typeof selectedOrder?.patient === 'object' ? selectedOrder.patient : null;
          const patientAge = patient?.age;
          const patientGender = patient?.gender;
          const testInfo = getTestInfo(testCode, patientAge, patientGender);
          const normalizedValue = normalizeMchcValue(testCode, result.value);
          const resolvedRange =
            result.referenceRange || result.reference_range || testInfo.referenceRange || '';
          const normalizedRange = normalizeMchcRange(testCode, resolvedRange);
          const normalizedUnit = normalizeMchcUnit(testCode, result.unit || testInfo.unit || '');
          
          savedResultsMap[testKey] = {
            testId: testKey,
            orderTestId: testKey,
            testCode: testCode,
            testName: result.testName || result.test_name || testCode,
            value: normalizedValue,
            unit: normalizedUnit,
            referenceRange: normalizedRange,
            flag: result.flag || 'normal',
            panelCode: matchingTest.panelCode || matchingTest.panel_code,
            panelName: matchingTest.panelName || matchingTest.panel_name,
            category: matchingTest.category,
          };
        }
      }
    }

    // Try to load draft from localStorage
    try {
      const savedDraft = localStorage.getItem(getDraftStorageKey(orderId));
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        // Merge: database results first, then override with draft (draft takes precedence)
        setResultEntries({ ...savedResultsMap, ...parsedDraft });
      } else {
        // No draft, just use database results
        setResultEntries(savedResultsMap);
      }
    } catch {
      // If draft parsing fails, just use database results
      setResultEntries(savedResultsMap);
    }
  }, [selectedOrder, savedResults, selectedOrderTests]);

  useEffect(() => {
    if (!selectedOrder) return;

    const orderId = selectedOrder.id || (selectedOrder as any)._id;
    if (!orderId) return;

    const timeout = setTimeout(() => {
      try {
        const hasValues = Object.values(resultEntries).some((entry) => entry?.value?.toString().trim());
        const storageKey = getDraftStorageKey(orderId);
        if (hasValues) {
          localStorage.setItem(storageKey, JSON.stringify(resultEntries));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // Ignore storage errors
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [selectedOrder, resultEntries]);

  // Clear live-update indicators when the selected order changes
  useEffect(() => {
    setLiveUpdates({});
    setFbcMessage('');
  }, [selectedOrderId]);

  // Real-time collaboration: listen for results saved by other users
  useEffect(() => {
    if (!socket || !selectedOrderId) return;

    const handleResultCreated = (result: any) => {
      // Only react if it belongs to the currently selected order
      if (result.orderId !== selectedOrderId) return;

      // Find the matching orderTest entry
      const matchingTest = selectedOrderTests.find(
        (t: any) => (t.testCode || t.test_code) === result.testCode,
      );
      if (!matchingTest) return;

      const testKey = matchingTest.id || matchingTest._id || result.testCode;
      const enteredBy: string = result.enteredBy || 'another user';

      setResultEntries(prev => ({
        ...prev,
        [testKey]: {
          testId: testKey,
          orderTestId: testKey,
          testCode: result.testCode,
          testName: result.testName || result.test_name || result.testCode,
          value: normalizeMchcValue(result.testCode, result.value),
          unit: normalizeMchcUnit(result.testCode, result.unit || prev[testKey]?.unit || ''),
          referenceRange: normalizeMchcRange(
            result.testCode,
            result.referenceRange || result.reference_range || prev[testKey]?.referenceRange || '',
          ),
          flag: result.flag || 'normal',
        },
      }));

      setLiveUpdates(prev => ({
        ...prev,
        [testKey]: new Date().toLocaleTimeString(),
      }));

      toast.info(`${result.testCode} updated${enteredBy !== 'another user' ? ` by ${enteredBy}` : ''}: ${result.value}`);
    };

    socket.on('result:created', handleResultCreated);
    return () => {
      socket.off('result:created', handleResultCreated);
    };
  }, [socket, selectedOrderId, selectedOrderTests]);

  // Get reference info from test catalog
  const getTestInfo = (testCode: string, patientAge?: number, patientGender?: string, selectedPhase?: string) => {
    const test = findCatalogTestByCode(testCatalog as any[] | undefined, testCode);

    if (!test) {
      return { unit: '', referenceRange: '', criticalLow: '', criticalHigh: '', allRanges: [] };
    }

    let referenceRange = test.referenceRange || '';
    let matchedAgeGroup = '';
    let criticalLow = '';
    let criticalHigh = '';
    let allRanges: Array<{ ageGroup: string; range: string; unit: string; gender?: string }> = [];

    // Check if this is a hormone test with phase-specific ranges
    const isHormoneTest = HORMONE_TESTS_WITH_PHASES.has(normalizeTestCode(testCode));

    if (test.referenceRanges && test.referenceRanges.length > 0) {
      // Collect all applicable ranges for hormone tests
      if (isHormoneTest && patientGender) {
        allRanges = test.referenceRanges
          .filter((r: any) => {
            // Include ranges that match patient gender or are gender-neutral
            return !r.gender || r.gender === 'all' || r.gender === patientGender;
          })
          .map((r: any) => ({
            ageGroup: r.ageGroup || '',
            range: r.range || '',
            unit: r.unit || test.unit || '',
            gender: r.gender,
          }));
      }

      let matchedRange: any;

      // If phase is selected for hormone test, match by phase
      if (isHormoneTest && selectedPhase && patientGender) {
        matchedRange = test.referenceRanges.find((r: any) => {
          const ageGroupLower = (r.ageGroup || '').toLowerCase();
          const genderMatch = !r.gender || r.gender === 'all' || r.gender === patientGender;
          
          // Match phase in age group name
          if (selectedPhase === 'follicular' && ageGroupLower.includes('follicular')) return genderMatch;
          if (selectedPhase === 'ovulation' && ageGroupLower.includes('ovulation')) return genderMatch;
          if (selectedPhase === 'luteal' && ageGroupLower.includes('luteal')) return genderMatch;
          if (selectedPhase === 'menopause' && ageGroupLower.includes('menopause')) return genderMatch;
          if (selectedPhase === 'pregnancy' && ageGroupLower.includes('pregnancy')) return genderMatch;
          
          return false;
        });
      }

      // If no phase match or not a hormone test, match by age and gender
      if (!matchedRange && patientAge !== undefined) {
        matchedRange = test.referenceRanges.find((r: any) => {
          const ageMatch =
            (r.ageMin === undefined || patientAge >= r.ageMin) &&
            (r.ageMax === undefined || patientAge <= r.ageMax);
          const genderMatch = !r.gender || r.gender === 'all' || r.gender === patientGender;
          return ageMatch && genderMatch;
        });

        if (!matchedRange) {
          matchedRange = test.referenceRanges.find((r: any) => {
            return (
              (r.ageMin === undefined || patientAge >= r.ageMin) &&
              (r.ageMax === undefined || patientAge <= r.ageMax)
            );
          });
        }
      }

      if (!matchedRange && !referenceRange) {
        matchedRange = test.referenceRanges[0];
      }

      if (matchedRange) {
        referenceRange = `${matchedRange.range} ${matchedRange.unit || test.unit || ''}`.trim();
        matchedAgeGroup = matchedRange.ageGroup || '';
        criticalLow = matchedRange.criticalLow || '';
        criticalHigh = matchedRange.criticalHigh || '';
      }
    }

    return {
      unit: normalizeMchcUnit(testCode, test.unit || ''),
      referenceRange: normalizeMchcRange(testCode, referenceRange),
      ageGroup: matchedAgeGroup,
      criticalLow: normalizeMchcThreshold(testCode, criticalLow),
      criticalHigh: normalizeMchcThreshold(testCode, criticalHigh),
      allRanges,
      isHormoneTest,
    };
  };

  const calculateFlag = (value: string, rangeStr: string, critLow?: string, critHigh?: string): ResultFlag => {
    if (!value?.trim()) return 'normal';

    // Parse comparison-style values like ">5", "<5", ">=5.2", "<=10"
    // e.g. user types ">5" for CRP → treat as a numeric value that is ABOVE the threshold
    const compValueMatch = value.trim().match(/^([<>]=?)\s*(\d+\.?\d*)$/);
    const numValue = compValueMatch ? parseFloat(compValueMatch[2]) : parseFloat(value);
    const compOp = compValueMatch ? compValueMatch[1] : null; // '<', '<=', '>', '>='

    if (isNaN(numValue)) return 'normal';
    if (!rangeStr) return 'no_range';

    // Handle threshold-style ranges: "< 5.0", "> 10", "<= 5", ">= 10"
    const thresholdMatch = rangeStr.trim().match(/^([<>]=?|≤|≥)\s*(\d+\.?\d*)$/);
    if (thresholdMatch) {
      const op = thresholdMatch[1];
      const threshold = parseFloat(thresholdMatch[2]);
      // Determine effective numeric value for flagging
      // If value was typed as ">5" and range is "< 5", the value is HIGH
      // If value was typed as "<5" and range is "< 5", the value is NORMAL
      let effectiveHigh: boolean;
      if (compOp === '>' || compOp === '>=') {
        effectiveHigh = true;
      } else if (compOp === '<' || compOp === '<=') {
        effectiveHigh = false;
      } else {
        // Plain number: compare against threshold
        effectiveHigh = (op === '<' || op === '≤') ? numValue >= threshold : numValue <= threshold;
      }
      return effectiveHigh ? 'high' : 'normal';
    }

    // Handle standard low–high range: "0-10.0", "5 - 50"
    const match = rangeStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    if (!match) return 'no_range';

    const low = parseFloat(match[1]);
    const high = parseFloat(match[2]);

    // For comparison-style values, resolve to a numeric position
    let effectiveValue = numValue;
    if (compOp === '>') effectiveValue = numValue + 0.001;
    if (compOp === '<') effectiveValue = numValue - 0.001;

    const cLow = critLow ? parseFloat(critLow) : low * 0.5;
    const cHigh = critHigh ? parseFloat(critHigh) : high * 1.5;

    if (!isNaN(cLow) && effectiveValue < cLow) return 'critical_low';
    if (!isNaN(cHigh) && effectiveValue > cHigh) return 'critical_high';
    if (effectiveValue < low) return 'low';
    if (effectiveValue > high) return 'high';
    return 'normal';
  };

  const handleValueChange = (orderTest: any, value: string, phase?: string) => {
    const testCode = orderTest.testCode || orderTest.test_code || '';
    const patient = typeof selectedOrder?.patient === 'object' ? selectedOrder.patient : null;
    const patientAge = patient?.age;
    const patientGender = patient?.gender;
    const entryKey = orderTest.id || orderTest._id || testCode;
    
    // Get current phase from entry or use provided phase
    const currentPhase = phase || resultEntries[entryKey]?.menstrualPhase;
    
    const testInfo = getTestInfo(testCode, patientAge, patientGender, currentPhase);
    const normalizedValue = normalizeMchcValue(testCode, value);
    const normalizedReferenceRange = normalizeMchcRange(testCode, testInfo.referenceRange);
    const normalizedCriticalLow = normalizeMchcThreshold(testCode, testInfo.criticalLow);
    const normalizedCriticalHigh = normalizeMchcThreshold(testCode, testInfo.criticalHigh);
    const flag = calculateFlag(
      normalizedValue,
      normalizedReferenceRange,
      normalizedCriticalLow,
      normalizedCriticalHigh,
    );

    // Generate automatic interpretation for HB Genotype
    let interpretation = '';
    if (testCode === 'HBGENO' && value) {
      const interpretations: Record<string, string> = {
        'AA': 'Normal - No sickle cell trait or disease',
        'AS': 'Trait - Sickle cell trait (carrier), usually asymptomatic',
        'SS': 'Sickle Cell Disease - Sickle cell anemia, requires medical management',
        'SC': 'Sickling - Hemoglobin SC disease, mild to moderate symptoms'
      };
      interpretation = interpretations[value] || '';
    }

    // Generate automatic interpretation for all serology Reactive/Non-Reactive tests
    const SEROLOGY_REACTIVE_TESTS = new Set(['RVS', 'HBSAG', 'HCV', 'RVSP24', 'HPYLORI', 'HPYLORI_IA', 'HSV', 'VDRL']);
    if (SEROLOGY_REACTIVE_TESTS.has(testCode) && value) {
      if (value === 'Non-Reactive') {
        interpretation = 'Negative';
      } else if (value === 'Weakly Reactive') {
        interpretation = 'Weakly Positive';
      } else if (value.startsWith('Reactive')) {
        interpretation = 'Positive';
      }
    }

    // Malaria
    if (testCode === 'MALARIA' && value) {
      interpretation = value === 'Negative' ? 'No malaria antigen detected' : value.replace('Positive ', '') + ' detected';
    }

    // Gonorrhea / Chlamydia / H.Pylori antigen (Positive/Negative → Detected/Not Detected)
    if (['GONORRHEA', 'CHLAMYDIA', 'HPAG'].includes(testCode) && value) {
      interpretation = value === 'Positive' ? 'Detected' : 'Not Detected';
    }

    // Widal
    if (testCode === 'WIDAL' && value) {
      const widalMap: Record<string, string> = {
        'IgM: Non-Reactive  |  IgG: Non-Reactive': 'Negative',
        'IgM: Reactive      |  IgG: Non-Reactive': 'Acute Infection',
        'IgM: Non-Reactive  |  IgG: Reactive':     'Past Infection / Immunity',
        'IgM: Reactive      |  IgG: Reactive':     'Positive (Active/Recent)',
      };
      interpretation = widalMap[value] || '';
    }

    setResultEntries(prev => ({
      ...prev,
      [entryKey]: {
        testId: orderTest.testId || orderTest.test_id || entryKey,
        orderTestId: entryKey,
        testCode,
        testName: orderTest.testName || orderTest.test_name || testCode,
        panelCode: orderTest.panelCode || orderTest.panel_code,
        panelName: orderTest.panelName || orderTest.panel_name,
        category: orderTest.category,
        value: normalizedValue,
        unit: normalizeMchcUnit(testCode, testInfo.unit),
        referenceRange: normalizedReferenceRange,
        flag,
        interpretation,
        menstrualPhase: currentPhase,
        allReferenceRanges: testInfo.allRanges,
      },
    }));
  };

  const handlePhaseChange = (orderTest: any, phase: string) => {
    const testCode = orderTest.testCode || orderTest.test_code || '';
    const entryKey = orderTest.id || orderTest._id || testCode;
    const currentValue = resultEntries[entryKey]?.value || '';
    
    // Re-calculate with new phase
    handleValueChange(orderTest, currentValue, phase);
  };

  const handleSubmitResults = () => {
    if (!selectedOrder) return;

    const entries = Object.values(resultEntries);
    if (entries.length === 0) {
      toast.error('Please enter at least one result');
      return;
    }

    // Check for critical values
    const criticalEntries = entries.filter(e => e.flag === 'critical_high' || e.flag === 'critical_low');
    if (criticalEntries.length > 0) {
      setShowConfirmModal(true);
      return;
    }

    submitResults();
  };

  const submitResults = async () => {
    if (!selectedOrder) return;
    setIsSubmitting(true);

    try {
      const entries = Object.values(resultEntries);

      // Filter out entries without values (important for urinalysis where not all tests are filled)
      const entriesWithValues = entries.filter(entry => 
        entry?.value?.toString().trim() !== ''
      );

      if (entriesWithValues.length === 0) {
        toast.error('Please enter at least one result value');
        setIsSubmitting(false);
        return;
      }

      // Get valid MongoDB ObjectId for orderId
      const orderId = (selectedOrder as any)._id || selectedOrder.id;

      // Validate orderId is a valid MongoDB ObjectId
      if (!orderId || !MONGO_OBJECT_ID_REGEX.test(orderId)) {
        toast.error('Invalid order ID format');
        setIsSubmitting(false);
        return;
      }

      // Prepare all results for bulk insert (only entries with values)
      const resultsToCreate = entriesWithValues.map(entry => {
        const normalizedValue = normalizeMchcValue(entry.testCode, entry.value);
        const normalizedReferenceRange = normalizeMchcRange(entry.testCode, entry.referenceRange);
        const normalizedUnit = normalizeMchcUnit(entry.testCode, entry.unit);

        const payload: any = {
          orderId: orderId,
          testCode: entry.testCode,
          testName: entry.testName,
          value: normalizedValue,
          unit: normalizedUnit || undefined,
          referenceRange: normalizedReferenceRange || undefined,
          flag: entry.flag,
          panelCode: entry.panelCode || undefined,
          panelName: entry.panelName || undefined,
          category: entry.category || undefined,
        };

        if (entry.orderTestId && MONGO_OBJECT_ID_REGEX.test(entry.orderTestId)) {
          payload.orderTestId = entry.orderTestId;
        }

        // Add menstrual phase for hormone tests
        if (entry.menstrualPhase) {
          payload.menstrualPhase = entry.menstrualPhase;
        }

        // Add all reference ranges for hormone tests
        if (entry.allReferenceRanges && entry.allReferenceRanges.length > 0) {
          payload.allReferenceRanges = JSON.stringify(entry.allReferenceRanges);
        }

        // Add FBC interpretation message to WBC test (it will appear at bottom of FBC panel in report)
        if (entry.testCode === 'WBC' && entry.panelCode === 'FBC' && fbcMessage.trim()) {
          payload.comments = fbcMessage.trim();
        }

        // Add automatic interpretation for HB Genotype
        if (entry.testCode === 'HBGENO' && entry.interpretation) {
          payload.comments = entry.interpretation;
        }

        // Add automatic interpretation for all serology Reactive/Non-Reactive tests
    const SEROLOGY_REACTIVE_TESTS = new Set(['RVS', 'HBSAG', 'HCV', 'RVSP24', 'HPYLORI', 'HPYLORI_IA', 'HSV', 'VDRL']);
        if (SEROLOGY_REACTIVE_TESTS.has(entry.testCode) && entry.interpretation) {
          payload.comments = entry.interpretation;
        }

        // Add interpretation for Malaria, Gonorrhea, Chlamydia, HPAG, Widal
        if (['MALARIA', 'GONORRHEA', 'CHLAMYDIA', 'HPAG', 'WIDAL'].includes(entry.testCode) && entry.interpretation) {
          payload.comments = entry.interpretation;
        }

        return payload;
      });

      // Create all results in one bulk operation (much faster!)
      await createBulkResults.mutateAsync(resultsToCreate);

      // Update order status if all tests have results
      const orderTests = selectedOrderTests;
      if (entriesWithValues.length >= orderTests.length) {
        await updateOrder.mutateAsync({
          id: orderId,
          updates: { status: 'completed' },
        });
      } else {
        await updateOrder.mutateAsync({
          id: orderId,
          updates: { status: 'processing' },
        });
      }

      toast.success('Results submitted successfully');
      localStorage.removeItem(getDraftStorageKey(orderId));
      setShowConfirmModal(false);
      setResultEntries({});
      setFbcMessage('');
      setSelectedOrder(null);
    } catch (error: unknown) {
      console.error('Failed to submit results:', error);
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosError?.response?.data?.message || axiosError?.message || 'Failed to submit results';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark an order as completed (removes from processing queue)
  const handleCompleteOrder = async (orderId: string) => {
    if (!orderId) return;

    try {
      await updateOrder.mutateAsync({
        id: orderId,
        updates: { status: 'completed' },
      });
      toast.success('Order marked as completed');

      // If the completed order was selected, clear the selection
      if (selectedOrder?.id === orderId || (selectedOrder as any)?._id === orderId) {
        setSelectedOrder(null);
        setResultEntries({});
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosError?.response?.data?.message || axiosError?.message || 'Failed to complete order';
      toast.error(errorMessage);
    }
  };

  const flagStyles: Record<ResultFlag, string> = {
    normal: 'bg-status-normal/10 text-status-normal',
    low: 'bg-status-warning/10 text-status-warning',
    high: 'bg-status-warning/10 text-status-warning',
    critical_low: 'bg-status-critical/10 text-status-critical',
    critical_high: 'bg-status-critical/10 text-status-critical',
    no_range: 'bg-muted text-muted-foreground',
  };

  // Filter the order list by the search term
  const filteredOrders = (processingOrders || []).filter(order => {
    if (!orderSearch.trim()) return true;
    const term = orderSearch.trim().toLowerCase();
    const name = getPatientName(order).toLowerCase();
    const num = getOrderNumber(order).toLowerCase();
    return name.includes(term) || num.includes(term);
  });

  return (
    <RoleLayout
      title="Enter Results"
      subtitle="Input test results — changes are synced to all users in real time"
      role={primaryRole === 'receptionist' ? 'receptionist' : primaryRole === 'admin' ? 'admin' : 'lab_tech'}
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
        {/* Orders List */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-card border rounded-lg lg:max-h-[calc(100vh-10rem)] lg:flex lg:flex-col">
            <div className="px-4 py-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Active Orders</h3>
                <div className="flex items-center gap-1.5 text-xs text-status-normal">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Live</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{filteredOrders.length} awaiting results</p>
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Search by name or order #…"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto lg:max-h-none lg:flex-1">
                {filteredOrders.map(order => (
                  <button
                    key={order.id}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors',
                      selectedOrder?.id === order.id && 'bg-primary/5 border-l-4 border-primary'
                    )}
                    onClick={() => {
                      setSelectedOrder(order);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">
                        {getPatientName(order)}
                      </p>
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        order.priority === 'stat' ? 'bg-status-critical/10 text-status-critical' :
                          order.priority === 'urgent' ? 'bg-status-warning/10 text-status-warning' :
                            'bg-muted'
                      )}>
                        {order.priority?.toUpperCase() || 'ROUTINE'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{getOrderNumber(order)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-status-normal hover:text-status-normal hover:bg-status-normal/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteOrder(order.id || (order as any)._id);
                        }}
                        title="Mark as completed (skip remaining tests)"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Button>
                    </div>
                    {(() => {
                      const codes = ((order as any).tests || (order as any).order_tests || [])
                        .map((t: any) => t.testCode || t.test_code || '')
                        .filter(Boolean);
                      const previewCodes = codes.slice(0, 5);
                      const extraCount = Math.max(codes.length - previewCodes.length, 0);

                      return (
                        <p className="text-xs mt-1 text-muted-foreground">
                          {previewCodes.join(', ')}
                          {extraCount > 0 ? ` +${extraCount} more` : ''}
                        </p>
                      );
                    })()}
                  </button>
                ))}
                {(!filteredOrders || filteredOrders.length === 0) && (
                  <div className="px-4 py-12 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">{orderSearch ? 'No orders match' : 'No orders processing'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Result Entry Panel */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg p-4">
            {selectedOrder ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {getPatientName(selectedOrder)}
                      </h3>
                      <p className="text-sm text-muted-foreground">{getOrderNumber(selectedOrder)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSendToAnalyzer(true)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Send to Analyzer
                      </Button>
                      <Badge variant="outline" className={cn(
                        selectedOrder.priority === 'stat' ? 'bg-status-critical/10 text-status-critical' :
                          selectedOrder.priority === 'urgent' ? 'bg-status-warning/10 text-status-warning' :
                            'bg-muted text-muted-foreground'
                      )}>
                        {selectedOrder.priority.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>
                        {completedTests}/{totalTests} entered ({progressPercent}%)
                        {savedResults && Array.isArray(savedResults) && savedResults.length > 0 && (
                          <span className="ml-2 text-primary">• {savedResults.length} saved</span>
                        )}
                        <span className="ml-2">• Autosaved</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Send to Analyzer Dialog */}
                <SendToAnalyzerDialog
                  open={showSendToAnalyzer}
                  onOpenChange={setShowSendToAnalyzer}
                  orderId={selectedOrder.id || (selectedOrder as any)._id}
                  orderNumber={getOrderNumber(selectedOrder)}
                  testCodes={selectedOrderTests.map((t: any) => t.testCode || t.test_code || '').filter(Boolean)}
                />

                {(() => {
                  const allTests: any[] = selectedOrderTests;
                  const patient = typeof selectedOrder.patient === 'object' ? selectedOrder.patient : null;
                  const patientAge = patient?.age;
                  const patientGender = patient?.gender;

                  // Group tests: panels first (keyed by panelCode), then standalone
                  const panelMap = new Map<string, { panelName: string; tests: any[] }>();
                  const standaloneTests: any[] = [];

                  for (const test of allTests) {
                    const pc = test.panelCode || test.panel_code;
                    const pn = test.panelName || test.panel_name;
                    if (pc) {
                      if (!panelMap.has(pc)) panelMap.set(pc, { panelName: pn || pc, tests: [] });
                      panelMap.get(pc)!.tests.push(test);
                    } else {
                      standaloneTests.push(test);
                    }
                  }

                  // Sort ELEC panel tests in canonical order
                  const ELEC_ORDER = ['K', 'NA', 'CL', 'ICA', 'NCA', 'TCA', 'TCO2', 'PH'];
                  if (panelMap.has('ELEC')) {
                    panelMap.get('ELEC')!.tests.sort((a, b) => {
                      const ia = ELEC_ORDER.indexOf((a.testCode || a.test_code || '').toUpperCase());
                      const ib = ELEC_ORDER.indexOf((b.testCode || b.test_code || '').toUpperCase());
                      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                    });
                  }

                  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, testKey: string) => {
                    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                    e.preventDefault();
                    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="value-"]'));
                    const idx = inputs.findIndex(el => el.id === `value-${testKey}`);
                    if (idx === -1) return;
                    const target = inputs[e.key === 'ArrowDown' ? idx + 1 : idx - 1];
                    if (target) { target.focus(); target.select(); }
                  };

                  const renderTestRow = (test: any) => {
                    const testCode = test.testCode || test.test_code || '';
                    const testName = test.testName || test.test_name || testCode;
                    const testKey = test.id || test._id || testCode;
                    const entry = resultEntries[testKey];
                    const patient = typeof selectedOrder?.patient === 'object' ? selectedOrder.patient : null;
                    const patientAge = patient?.age;
                    const patientGender = patient?.gender;
                    const testInfo = getTestInfo(testCode, patientAge, patientGender, entry?.menstrualPhase);

                    const qualitativeOptions = QUALITATIVE_OPTIONS[testCode];
                    const isTextarea = TEXTAREA_TESTS.has(testCode);
                    const isStoolMicro = STOOL_MICRO_TEST_CODES.has(normalizeTestCode(testCode));
                    const isHormoneTest = testInfo.isHormoneTest && patientGender === 'F';
                    const showAllRanges = isHormoneTest && entry?.allReferenceRanges && entry.allReferenceRanges.length > 1;

                    return (
                      <div key={testKey} className={cn('grid gap-3 items-start py-3 px-3 border-b last:border-b-0', (isTextarea || isStoolMicro || showAllRanges) ? 'grid-cols-1' : 'grid-cols-12')}>
                        {isStoolMicro ? (
                          // Structured layout for Stool Microscopy
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <p className="font-medium text-sm">{testCode}</p>
                              <p className="text-xs text-muted-foreground">{testName}</p>
                            </div>
                            {(() => {
                              const smf = stoolMicroFields[testKey] || parseStoolMicroValue(entry?.value || '');
                              return (
                                <div className="grid grid-cols-2 gap-3">
                                  {Object.entries(STOOL_MICRO_FIELDS).map(([fieldKey, fieldDef]) => (
                                    <div key={fieldKey} className={fieldDef.textarea ? 'col-span-2' : ''}>
                                      <Label className="text-xs font-medium mb-1 block">{fieldDef.label}</Label>
                                      {fieldDef.textarea ? (
                                        <textarea
                                          placeholder="Enter microscopy findings (e.g. ova, cysts, parasites, cells)..."
                                          value={smf[fieldKey as keyof typeof smf] || ''}
                                          onChange={e => handleStoolMicroChange(testKey, fieldKey, e.target.value)}
                                          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                      ) : (
                                        <Select
                                          value={smf[fieldKey as keyof typeof smf] || ''}
                                          onValueChange={val => handleStoolMicroChange(testKey, fieldKey, val)}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue placeholder={`Select ${fieldDef.label.toLowerCase()}...`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {fieldDef.options!.map(opt => (
                                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        ) : isTextarea ? (
                          // Full-width layout for descriptive/textarea tests
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <p className="font-medium text-sm">{testCode}</p>
                              <p className="text-xs text-muted-foreground">{testName}</p>
                            </div>
                            <textarea
                              placeholder="Enter findings..."
                              value={entry?.value || ''}
                              onChange={e => handleValueChange(test, e.target.value)}
                              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        ) : showAllRanges ? (
                          // Special layout for hormone tests with multiple ranges
                          <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-3">
                              <div className="col-span-3">
                                <p className="font-medium text-sm">{testCode}</p>
                                <p className="text-xs text-muted-foreground">{testName}</p>
                              </div>
                              <div className="col-span-2">
                                <Input
                                  id={`value-${testKey}`}
                                  placeholder="Value"
                                  value={entry?.value || ''}
                                  onChange={e => handleValueChange(test, e.target.value)}
                                  onKeyDown={e => handleKeyDown(e, testKey)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="col-span-3">
                                <Select
                                  value={entry?.menstrualPhase || ''}
                                  onValueChange={val => handlePhaseChange(test, val)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Select phase..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MENSTRUAL_PHASE_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2 flex items-center">
                                {entry?.interpretation ? (
                                  <span className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
                                    entry.interpretation === 'Negative' || entry.interpretation === 'Not Detected' || entry.interpretation === 'No malaria antigen detected'
                                      ? 'bg-green-100 text-green-700'
                                      : entry.interpretation.toLowerCase().includes('weakly')
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  )}>
                                    {entry.interpretation}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                              <div className="col-span-1">
                                <p className="text-xs text-muted-foreground">{testInfo.unit || '-'}</p>
                              </div>
                              <div className="col-span-1">
                                {entry?.value && (
                                  <Badge variant="outline" className={cn('text-xs', flagStyles[entry.flag])}>
                                    {entry.flag === 'normal' ? '✓' : entry.flag === 'critical_high' || entry.flag === 'critical_low' ? '!!' : entry.flag === 'high' ? '↑' : entry.flag === 'low' ? '↓' : '—'}
                                  </Badge>
                                )}
                                {liveUpdates[testKey] && (
                                  <span className="text-[9px] text-primary/70 flex items-center gap-0.5" title={`Synced at ${liveUpdates[testKey]}`}>
                                    <Radio className="w-2.5 h-2.5" />
                                    live
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Display all reference ranges */}
                            <div className="pl-3 border-l-2 border-primary/20 bg-muted/30 p-2 rounded-r">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Reference Ranges ({patientGender === 'F' ? 'Female' : 'Male'}):</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {entry.allReferenceRanges?.map((range, idx) => {
                                  const isSelected = entry.menstrualPhase && (range.ageGroup || '').toLowerCase().includes(entry.menstrualPhase);
                                  return (
                                    <div key={idx} className={cn(
                                      'text-xs flex items-center gap-1',
                                      isSelected ? 'font-semibold text-primary' : 'text-muted-foreground'
                                    )}>
                                      {isSelected && <span className="text-primary">►</span>}
                                      <span>{range.ageGroup}:</span>
                                      <span className="font-mono">{range.range} {range.unit}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              {entry.menstrualPhase && (
                                <p className="text-xs text-primary mt-1.5 italic">
                                  ► Flagged based on {MENSTRUAL_PHASE_OPTIONS.find(p => p.value === entry.menstrualPhase)?.label || entry.menstrualPhase} range
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="col-span-3">
                              <p className="font-medium text-sm">{testCode}</p>
                              <p className="text-xs text-muted-foreground">{testName}</p>
                            </div>
                            <div className="col-span-2">
                              {qualitativeOptions && qualitativeOptions.length > 0 ? (
                                <Select
                                  value={entry?.value || ''}
                                  onValueChange={val => handleValueChange(test, val)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {qualitativeOptions.map(opt => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  id={`value-${testKey}`}
                                  placeholder="Value"
                                  value={entry?.value || ''}
                                  onChange={e => handleValueChange(test, e.target.value)}
                                  onKeyDown={e => handleKeyDown(e, testKey)}
                                  className="h-8 text-sm"
                                />
                              )}
                            </div>
                            <div className="col-span-3 flex items-center">
                              <p className="text-xs text-muted-foreground">
                                {testInfo.referenceRange
                                  ? `${testInfo.referenceRange}${testInfo.unit ? ' ' + testInfo.unit : ''}`
                                  : '—'}
                              </p>
                            </div>
                            <div className="col-span-2 flex items-center">
                              {entry?.interpretation ? (
                                <span className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
                                  entry.interpretation === 'Negative' || entry.interpretation === 'Not Detected' || entry.interpretation === 'No malaria antigen detected'
                                    ? 'bg-green-100 text-green-700'
                                    : entry.interpretation.toLowerCase().includes('weakly')
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                                )}>
                                  {entry.interpretation}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                            <div className="col-span-1">
                              <p className="text-xs text-muted-foreground">{testInfo.unit || '-'}</p>
                            </div>
                            <div className="col-span-1">
                              {entry?.value && (
                                <Badge variant="outline" className={cn('text-xs', flagStyles[entry.flag])}>
                                  {entry.flag === 'normal' ? '✓' : entry.flag === 'critical_high' || entry.flag === 'critical_low' ? '!!' : entry.flag === 'high' ? '↑' : entry.flag === 'low' ? '↓' : '—'}
                                </Badge>
                              )}
                              {liveUpdates[testKey] && (
                                <span className="text-[9px] text-primary/70 flex items-center gap-0.5" title={`Synced at ${liveUpdates[testKey]}`}>
                                  <Radio className="w-2.5 h-2.5" />
                                  live
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-4">
                      {/* Column header */}
                      <div className="grid grid-cols-12 gap-3 px-3 pb-1 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <div className="col-span-3">Test</div>
                        <div className="col-span-2">Result</div>
                        <div className="col-span-3">Range</div>
                        <div className="col-span-2">Interpretation</div>
                        <div className="col-span-1">Unit</div>
                        <div className="col-span-1"></div>
                      </div>

                      <Accordion type="multiple" className="w-full space-y-3">
                        {/* Panel groups */}
                        {Array.from(panelMap.entries()).map(([pc, group]) => {
                          // Check if tests have subcategories (e.g., urinalysis)
                          const hasSubcategories = group.tests.some(t => {
                            const testCode = t.testCode || t.test_code || '';
                            const test = findCatalogTestByCode(testCatalog as any[] | undefined, testCode);
                            return test?.subcategory;
                          });

                          // Group tests by subcategory if they exist
                          const subcategoryMap = new Map<string, any[]>();
                          if (hasSubcategories) {
                            for (const test of group.tests) {
                              const testCode = test.testCode || test.test_code || '';
                              const catalogTest = findCatalogTestByCode(testCatalog as any[] | undefined, testCode);
                              const subcategory = catalogTest?.subcategory || 'Other';
                              if (!subcategoryMap.has(subcategory)) {
                                subcategoryMap.set(subcategory, []);
                              }
                              subcategoryMap.get(subcategory)!.push(test);
                            }
                          }

                          return (
                            <AccordionItem key={pc} value={`panel-${pc}`} className="rounded-lg border overflow-hidden">
                              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-primary text-left">{group.panelName}</p>
                                  <Badge variant="outline" className="text-[10px]">{group.tests.length}</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pb-0">
                                <div className="border-t">
                                  {hasSubcategories ? (
                                    // Render tests grouped by subcategory
                                    <>
                                      {Array.from(subcategoryMap.entries()).map(([subcategory, tests]) => (
                                        <div key={subcategory}>
                                          <div className="px-3 py-1.5 bg-muted/50 border-b">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                              {subcategory}
                                            </p>
                                          </div>
                                          {tests.map(renderTestRow)}
                                        </div>
                                      ))}
                                    </>
                                  ) : (
                                    // Render tests without subcategory grouping
                                    group.tests.map(renderTestRow)
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}

                        {/* Standalone tests */}
                        {standaloneTests.length > 0 && (
                          <AccordionItem value="standalone-tests" className="rounded-lg border overflow-hidden">
                            <AccordionTrigger className="px-3 py-2 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Individual Tests</p>
                                <Badge variant="outline" className="text-[10px]">{standaloneTests.length}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-0">
                              <div className="border-t">
                                {standaloneTests.map(renderTestRow)}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                      </Accordion>

                      {/* FBC Panel Interpretation Message - shown only if FBC panel exists */}
                      {panelMap.has('FBC') && (
                        <div className="mt-4 border rounded-lg p-3 bg-muted/30">
                          <Label htmlFor="fbc-message" className="text-xs font-medium mb-2 block">
                            FBC Interpretation Message
                          </Label>
                          <Input
                            id="fbc-message"
                            placeholder="e.g., WBC MESSAGE: Lymphocytosis. PLT: Thrombocytosis"
                            value={fbcMessage}
                            onChange={(e) => setFbcMessage(e.target.value)}
                            className="h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Enter combined interpretation (e.g., "WBC MESSAGE: [condition]. RBC: [condition]. PLT: [condition]")
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitResults} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Check className="w-4 h-4 mr-2" />
                    Submit Results
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium text-lg">Select an order</p>
                <p className="text-sm">Choose an order from the list to enter results</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Critical Value Warning Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-critical">
              <AlertTriangle className="w-5 h-5" />
              Critical Values Detected
            </DialogTitle>
            <DialogDescription>
              Review critical results and confirm submission.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="mb-4">The following results are outside critical limits:</p>
            <div className="space-y-2">
              {Object.values(resultEntries)
                .filter(e => e.flag === 'critical_high' || e.flag === 'critical_low')
                .map(entry => (
                  <div key={entry.orderTestId} className="flex items-center justify-between p-3 bg-status-critical/10 rounded-lg">
                    <span className="font-medium">{entry.testCode}</span>
                    <div className="text-center">
                      <span className="font-bold">{entry.value} {entry.unit}</span>
                      <p className="text-xs text-muted-foreground">{entry.referenceRange || 'No range'}</p>
                    </div>
                    <Badge variant="outline" className="bg-status-critical/10 text-status-critical">
                      {entry.flag.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Please ensure the physician is notified immediately about these critical values.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Review Results
            </Button>
            <Button variant="destructive" onClick={submitResults} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
