import api from './api';
import { MedicationCategoryEnum } from '@/types/medication';

const normalizeMedication = (medication: any) => {
  if (!medication || typeof medication !== 'object') return medication;

  const stockQuantity = Number(
      medication.stockQuantity ??
      medication.quantityAvailable ??
      medication.stockAvailable ??
      medication.stock ??
      medication.calculatedStock ??
      medication.availableStock ??
      0,
  ) || 0;
  const packSizes = Array.isArray(medication.packSizes)
    ? medication.packSizes.map((pack: any) => ({
        ...pack,
        unitsPerPack: Number(pack.unitsPerPack ?? pack.quantityPerPack ?? 1) || 1,
        quantityPerPack: Number(pack.quantityPerPack ?? pack.unitsPerPack ?? 1) || 1,
      }))
    : medication.packSizes;
  const defaultPack = packSizes?.[0];
  const unitPrice = Number(
    medication.unitPrice ??
      (defaultPack?.sellingPrice && defaultPack?.unitsPerPack
        ? defaultPack.sellingPrice / defaultPack.unitsPerPack
        : undefined) ??
      medication.suggestedRetailPrice ??
      medication.sellingPrice ??
      medication.price ??
      medication.basePrice ??
      0,
  ) || 0;

  return {
    ...medication,
    stockQuantity,
    quantityAvailable: Number(medication.quantityAvailable ?? stockQuantity) || stockQuantity,
    stockAvailable: Number(medication.stockAvailable ?? medication.stock ?? stockQuantity) || stockQuantity,
    stock: Number(medication.stock ?? medication.stockAvailable ?? stockQuantity) || stockQuantity,
    unitPrice,
    baseUnit: medication.baseUnit || medication.unit || 'unit',
    packSizes,
  };
};

const normalizeMedicationList = (medications: any[]) => medications.map(normalizeMedication);

export const medicationService = {
  async create(data: {
    medicationCode: string;
    name: string;
    genericName: string;
    category?: MedicationCategoryEnum;
    description?: string;
    dosageForm?: string;
    strength?: string;
    manufacturer?: string;
    stockQuantity?: number;
    unit?: string;
    unitPrice?: number;
    reorderLevel?: number;
    batchNumber?: string;
    expiryDate?: Date;
  }): Promise<any> {
    const response = await api.post('/medications', data);
    return response.data;
  },

  async findAll(category?: MedicationCategoryEnum, lowStock?: boolean): Promise<any[]> {
    const response = await api.get('/medications', {
      params: {
        ...(category && { category }),
        ...(lowStock && { lowStock: true }),
      },
    });
    return normalizeMedicationList(response.data);
  },

  async search(searchTerm: string): Promise<any[]> {
    const response = await api.get('/medications/search', {
      params: { q: searchTerm },
    });
    return normalizeMedicationList(response.data);
  },

  async findById(id: string): Promise<any> {
    const response = await api.get(`/medications/${id}`);
    return normalizeMedication(response.data);
  },

  async update(id: string, data: any): Promise<any> {
    const response = await api.patch(`/medications/${id}`, data);
    return response.data;
  },

  async updateStock(id: string, quantity: number, operation: 'add' | 'subtract'): Promise<any> {
    const response = await api.patch(`/medications/${id}/stock`, {
      quantity,
      operation,
    });
    return response.data;
  },

  async getInventoryReport(): Promise<any> {
    const response = await api.get('/medications/report');
    return response.data;
  },

  async deactivate(id: string): Promise<any> {
    const response = await api.delete(`/medications/${id}`);
    return response.data;
  },
};
