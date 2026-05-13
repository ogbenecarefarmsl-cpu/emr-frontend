import { TestCatalogItem } from '@/types/lis';

export const testCatalog: TestCatalogItem[] = [
  // Hematology - ZYBIO EXC 200
  { id: 'cbc', code: 'CBC', name: 'Complete Blood Count', category: 'hematology', price: 2500, turnaroundTime: 30, sampleType: 'blood', machineId: '1' },
  { id: 'wbc-diff', code: 'WBC-DIFF', name: 'WBC Differential', category: 'hematology', price: 1500, turnaroundTime: 30, sampleType: 'blood', machineId: '1' },
  { id: 'hb', code: 'HB', name: 'Hemoglobin', category: 'hematology', price: 800, turnaroundTime: 20, sampleType: 'blood', machineId: '1' },
  { id: 'pcv', code: 'PCV', name: 'Packed Cell Volume', category: 'hematology', price: 800, turnaroundTime: 20, sampleType: 'blood', machineId: '1' },
  { id: 'esr', code: 'ESR', name: 'Erythrocyte Sedimentation Rate', category: 'hematology', price: 1000, turnaroundTime: 60, sampleType: 'blood', machineId: '1' },
  { id: 'pt', code: 'PT', name: 'Prothrombin Time', category: 'hematology', price: 3000, turnaroundTime: 45, sampleType: 'blood', machineId: '1' },
  { id: 'aptt', code: 'APTT', name: 'Activated Partial Thromboplastin Time', category: 'hematology', price: 3000, turnaroundTime: 45, sampleType: 'blood', machineId: '1' },
  { id: 'inr', code: 'INR', name: 'International Normalized Ratio', category: 'hematology', price: 2000, turnaroundTime: 45, sampleType: 'blood', machineId: '1' },

  // Chemistry - ZYBIO Z52
  { id: 'bmp', code: 'BMP', name: 'Basic Metabolic Panel', category: 'chemistry', price: 5000, turnaroundTime: 45, sampleType: 'blood', machineId: '2' },
  { id: 'cmp', code: 'CMP', name: 'Comprehensive Metabolic Panel', category: 'chemistry', price: 8000, turnaroundTime: 60, sampleType: 'blood', machineId: '2' },
  { id: 'lft', code: 'LFT', name: 'Liver Function Tests', category: 'chemistry', price: 5500, turnaroundTime: 45, sampleType: 'blood', machineId: '2' },
  { id: 'rft', code: 'RFT', name: 'Renal Function Tests', category: 'chemistry', price: 4500, turnaroundTime: 45, sampleType: 'blood', machineId: '2' },
  { id: 'lipid', code: 'LIPID', name: 'Lipid Profile', category: 'chemistry', price: 4000, turnaroundTime: 45, sampleType: 'blood', machineId: '2' },
  { id: 'electrolytes', code: 'ELEC', name: 'Electrolytes (Na, K, Cl)', category: 'chemistry', price: 3500, turnaroundTime: 30, sampleType: 'blood', machineId: '2' },
  { id: 'glucose-fasting', code: 'FBS', name: 'Fasting Blood Sugar', category: 'chemistry', price: 1000, turnaroundTime: 20, sampleType: 'blood', machineId: '2' },
  { id: 'glucose-random', code: 'RBS', name: 'Random Blood Sugar', category: 'chemistry', price: 1000, turnaroundTime: 20, sampleType: 'blood', machineId: '2' },
  { id: 'uric-acid', code: 'UA', name: 'Uric Acid', category: 'chemistry', price: 1500, turnaroundTime: 30, sampleType: 'blood', machineId: '2' },
  { id: 'creatinine', code: 'CREAT', name: 'Creatinine', category: 'chemistry', price: 1200, turnaroundTime: 30, sampleType: 'blood', machineId: '2' },
  { id: 'bun', code: 'BUN', name: 'Blood Urea Nitrogen', category: 'chemistry', price: 1200, turnaroundTime: 30, sampleType: 'blood', machineId: '2' },

  // Immunoassay - WONDFO Finecare PLUS
  { id: 'crp', code: 'CRP', name: 'C-Reactive Protein', category: 'immunoassay', price: 3000, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 'pct', code: 'PCT', name: 'Procalcitonin', category: 'immunoassay', price: 5000, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 'd-dimer', code: 'DDIM', name: 'D-Dimer', category: 'immunoassay', price: 6000, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 'hba1c', code: 'HBA1C', name: 'Glycated Hemoglobin', category: 'immunoassay', price: 3500, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 'tsh', code: 'TSH', name: 'Thyroid Stimulating Hormone', category: 'immunoassay', price: 4000, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 't3', code: 'T3', name: 'Triiodothyronine', category: 'immunoassay', price: 3500, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 't4', code: 'T4', name: 'Thyroxine', category: 'immunoassay', price: 3500, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 'ctni', code: 'CTNI', name: 'Cardiac Troponin I', category: 'immunoassay', price: 5000, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 'nt-probnp', code: 'BNPRO', name: 'NT-proBNP', category: 'immunoassay', price: 8000, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },
  { id: 'psa', code: 'PSA', name: 'Prostate Specific Antigen', category: 'immunoassay', price: 4500, turnaroundTime: 15, sampleType: 'blood', machineId: '3' },

  // Urinalysis
  { id: 'urinalysis', code: 'URN', name: 'Urinalysis (Complete)', category: 'urinalysis', price: 1500, turnaroundTime: 30, sampleType: 'urine' },
  { id: 'urine-culture', code: 'UC', name: 'Urine Culture', category: 'urinalysis', price: 4000, turnaroundTime: 1440, sampleType: 'urine' },
  { id: 'urine-protein', code: 'UPRO', name: 'Urine Protein', category: 'urinalysis', price: 1200, turnaroundTime: 30, sampleType: 'urine' },

  // Microbiology
  { id: 'malaria', code: 'MP', name: 'Malaria Parasite (Blood Film)', category: 'microbiology', price: 1500, turnaroundTime: 30, sampleType: 'blood' },
  { id: 'widal', code: 'WIDAL', name: 'Widal Test', category: 'microbiology', price: 2000, turnaroundTime: 60, sampleType: 'blood' },
  { id: 'stool-exam', code: 'STOOL', name: 'Stool Examination', category: 'microbiology', price: 1500, turnaroundTime: 45, sampleType: 'stool' },
  { id: 'rvs-screen', code: 'RVS', name: 'RVS Screening', category: 'microbiology', price: 3000, turnaroundTime: 30, sampleType: 'blood' },
  { id: 'hbsag', code: 'HBSAG', name: 'Hepatitis B Surface Antigen', category: 'microbiology', price: 2500, turnaroundTime: 30, sampleType: 'blood' },
  { id: 'hcv', code: 'HCV', name: 'Hepatitis C Antibody', category: 'microbiology', price: 3000, turnaroundTime: 30, sampleType: 'blood' },
];

export const testCategories = [
  { id: 'hematology', name: 'Hematology', icon: 'droplet' },
  { id: 'chemistry', name: 'Chemistry', icon: 'flask' },
  { id: 'immunoassay', name: 'Immunoassay', icon: 'activity' },
  { id: 'urinalysis', name: 'Urinalysis', icon: 'test-tube' },
  { id: 'microbiology', name: 'Microbiology', icon: 'microscope' },
];
