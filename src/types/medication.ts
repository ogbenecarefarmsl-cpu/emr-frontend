export enum MedicationCategoryEnum {
  ANALGESIC = 'analgesic',
  ANTIBIOTIC = 'antibiotic',
  ANTIVIRAL = 'antiviral',
  ANTIHISTAMINE = 'antihistamine',
  ANTIHYPERTENSIVE = 'antihypertensive',
  ANTIDIABETIC = 'antidiabetic',
  ANTACID = 'antacid',
  ANTIDEPRESSANT = 'antidepressant',
  VITAMIN = 'vitamin',
  SUPPLEMENT = 'supplement',
  OTHER = 'other',
}

export interface Medication {
  _id: string;
  medicationCode: string;
  name: string;
  genericName: string;
  category?: MedicationCategoryEnum;
  description?: string;
  dosageForm?: string;
  strength?: string;
  manufacturer?: string;
  stockQuantity: number;
  unit?: string;
  unitPrice: number;
  reorderLevel: number;
  batchNumber?: string;
  expiryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryReport {
  total: number;
  lowStock: number;
  outOfStock: number;
  byCategory: Array<{ category: string; count: number }>;
}
