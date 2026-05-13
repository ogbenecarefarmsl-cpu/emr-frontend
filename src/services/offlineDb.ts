import Dexie, { type Table } from 'dexie';

// ── Offline-cached entity shapes ─────────────────────────────────
export interface CachedTest {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  isActive: boolean;
  sampleType?: string;
  department?: string;
  parameters?: any[];
  /** raw JSON from the server */
  _raw: any;
  _syncedAt: number;
}

export interface CachedPanel {
  id: string;
  name: string;
  code: string;
  price: number;
  tests: string[];
  _raw: any;
  _syncedAt: number;
}

export interface CachedPatient {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  _raw: any;
  _syncedAt: number;
}

export interface CachedOrder {
  id: string;
  patientId: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  _raw: any;
  _syncedAt: number;
}

export interface CachedUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  _raw: any;
  _syncedAt: number;
}

export interface PendingMutation {
  id?: number;
  /** API method path, e.g. '/patients' */
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  createdAt: number;
  retries: number;
  /** 'pending' | 'syncing' | 'failed' */
  status: string;
  error?: string;
}

export interface SyncMeta {
  key: string;
  lastSyncedAt: number;
}

// ── Database definition ──────────────────────────────────────────
class HobourDB extends Dexie {
  tests!: Table<CachedTest, string>;
  panels!: Table<CachedPanel, string>;
  patients!: Table<CachedPatient, string>;
  orders!: Table<CachedOrder, string>;
  users!: Table<CachedUser, string>;
  pendingMutations!: Table<PendingMutation, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('hobour-lis');
    this.version(1).stores({
      tests: 'id, name, code, category, isActive, _syncedAt',
      panels: 'id, name, code, _syncedAt',
      patients: 'id, fullName, phone, email, _syncedAt',
      orders: 'id, patientId, status, createdAt, _syncedAt',
      users: 'id, email, fullName, _syncedAt',
      pendingMutations: '++id, url, status, createdAt',
      syncMeta: 'key',
    });
  }
}

export const db = new HobourDB();

// ── Helper: upsert many records ──────────────────────────────────
export async function bulkUpsert<T>(
  table: Table<T, string>,
  records: Array<T & { id?: unknown }>,
): Promise<void> {
  const validRecords = records.filter((record) => {
    if (!record || record.id === undefined || record.id === null) return false;
    const key = String(record.id).trim();
    return key.length > 0;
  });

  if (validRecords.length === 0) return;

  if (validRecords.length !== records.length) {
    console.warn(
      `[offlineDb] Skipped ${records.length - validRecords.length} record(s) with invalid id while writing ${table.name}`,
    );
  }

  await table.bulkPut(validRecords as T[]);
}

// ── Queue an offline mutation ────────────────────────────────────
export async function queueMutation(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: any,
): Promise<number> {
  return db.pendingMutations.add({
    url,
    method,
    body,
    createdAt: Date.now(),
    retries: 0,
    status: 'pending',
  });
}

// ── Get pending mutations count ──────────────────────────────────
export async function getPendingCount(): Promise<number> {
  return db.pendingMutations.where('status').equals('pending').count();
}
