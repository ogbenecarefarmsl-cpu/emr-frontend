import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  db,
  bulkUpsert,
  type CachedTest,
  type CachedPanel,
  type CachedPatient,
  type CachedOrder,
  type PendingMutation,
} from '@/services/offlineDb';
import {
  testCatalogAPI,
  patientsAPI,
  ordersAPI,
} from '@/services/api';
import axios from 'axios';
import { getAccessToken } from '@/services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Types ────────────────────────────────────────────────────────
export type ConnectionMode = 'online' | 'lan-only' | 'offline';

interface SyncState {
  /** Browser / Electron actual network status */
  isOnline: boolean;
  /** Can we reach the backend API? */
  isApiReachable: boolean;
  /** Is a sync currently running? */
  isSyncing: boolean;
  /** Number of queued offline mutations */
  pendingCount: number;
  /** ISO string of last successful full sync */
  lastSyncedAt: string | null;
  /** Force a full sync now */
  syncNow: () => Promise<void>;
  /** Connection mode: 'online' (internet), 'lan-only' (local network), 'offline' */
  connectionMode: ConnectionMode;
  /** If backend was found on LAN, its URL */
  lanBackendUrl: string | null;
  /** Manually set the server URL (returns error string or null on success) */
  setServerUrl: (url: string) => Promise<string | null>;
}

const SyncContext = createContext<SyncState>({
  isOnline: navigator.onLine,
  isApiReachable: false,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  syncNow: async () => {},
  connectionMode: 'offline',
  lanBackendUrl: null,
  setServerUrl: async () => null,
});

export const useSync = () => useContext(SyncContext);

// ── Interval constants ───────────────────────────────────────────
const PING_INTERVAL = 15_000;   // check API every 15 s
const SYNC_INTERVAL = 60_000;   // full data pull every 60 s
const FLUSH_INTERVAL = 10_000;  // try flushing mutations every 10 s
const MAX_RETRIES = 5;          // max retry attempts for failed mutations
const BATCH_SIZE = 10;          // process mutations in batches

// ── Provider ─────────────────────────────────────────────────────
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isApiReachable, setIsApiReachable] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    localStorage.getItem('last_full_sync'),
  );
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('offline');
  const [lanBackendUrl, setLanBackendUrl] = useState<string | null>(null);
  const syncLock = useRef(false);

  // Load saved server URL from Electron on mount
  useEffect(() => {
    if (window.electronAPI?.getServerUrl) {
      window.electronAPI.getServerUrl().then((url) => {
        if (url) setLanBackendUrl(url);
      });
    }
  }, []);

  // ── Online / offline listeners ─────────────────────────────────
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => {
      setIsOnline(false);
      setIsApiReachable(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Ping the API to verify reachability ────────────────────────
  const pingApi = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setIsApiReachable(false);
      setConnectionMode('offline');
      return false;
    }

    const requestConfig = {
      timeout: 5_000,
      headers: { Authorization: `Bearer ${token}` },
    };

    // 1. Try the configured API URL
    try {
      await axios.get(`${API_BASE_URL}/health`, requestConfig);
      setIsApiReachable(true);
      setConnectionMode('online');
      return true;
    } catch {
      // configured URL failed
    }

    // 2. In Electron, try LAN discovery
    if (window.electronAPI?.discoverBackend) {
      try {
        const result = await window.electronAPI.discoverBackend();
        if (result?.url) {
          // Verify the discovered URL actually works
          await axios.get(`${result.url}/health`, {
            ...requestConfig,
            timeout: 3_000,
          });
          setLanBackendUrl(result.url);
          setIsApiReachable(true);
          setConnectionMode('lan-only');
          return true;
        }
      } catch {
        // LAN discovery failed too
      }
    }

    setIsApiReachable(false);
    setConnectionMode(navigator.onLine ? 'offline' : 'offline');
    setLanBackendUrl(null);
    return false;
  }, []);

  useEffect(() => {
    pingApi();
    const id = setInterval(pingApi, PING_INTERVAL);
    return () => clearInterval(id);
  }, [pingApi]);

  // ── Pull remote data into IndexedDB ────────────────────────────
  const pullData = useCallback(async () => {
    if (syncLock.current) return;
    syncLock.current = true;
    setIsSyncing(true);
    const now = Date.now();
    try {
      const resolveEntityId = (...candidates: unknown[]): string | undefined => {
        for (const candidate of candidates) {
          if (candidate === undefined || candidate === null) continue;
          const key = String(candidate).trim();
          if (key) return key;
        }
        return undefined;
      };

      // Pull test catalog
      const tests = await testCatalogAPI.getAll();
      const mapped: CachedTest[] = (Array.isArray(tests) ? tests : tests.data ?? []).map(
        (t: any) => ({
          id: resolveEntityId(t.id, t._id, t.code) || '',
          name: t.name,
          code: t.code,
          category: t.category,
          price: Number(t.price) || 0,
          isActive: t.isActive ?? true,
          sampleType: t.sampleType,
          department: t.department,
          parameters: t.parameters,
          _raw: t,
          _syncedAt: now,
        }),
      );
      await bulkUpsert(db.tests, mapped);

      // Pull panels
      try {
        const panels = await testCatalogAPI.getPanels();
        const mappedP: CachedPanel[] = (Array.isArray(panels) ? panels : []).map(
          (p: any) => ({
            id: resolveEntityId(p.id, p._id, p.code) || '',
            name: p.name,
            code: p.code,
            price: Number(p.price) || 0,
            tests: p.tests?.map((t: any) => t.id || t) ?? [],
            _raw: p,
            _syncedAt: now,
          }),
        );
        await bulkUpsert(db.panels, mappedP);
      } catch {
        // panels endpoint might not exist
      }

      // Pull patients (recent 500)
      try {
        const patients = await patientsAPI.getAll({ limit: 500 });
        const list = Array.isArray(patients) ? patients : patients.data ?? [];
        const mappedPat: CachedPatient[] = list.map((p: any) => ({
          id: resolveEntityId(p.id, p._id, p.patientId) || '',
          fullName: p.fullName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
          phone: p.phone,
          email: p.email,
          dateOfBirth: p.dateOfBirth,
          gender: p.gender,
          _raw: p,
          _syncedAt: now,
        }));
        await bulkUpsert(db.patients, mappedPat);
      } catch {
        // non-critical
      }

      // Pull recent orders (last 200)
      try {
        const orders = await ordersAPI.getAll({ limit: 200 });
        const list = Array.isArray(orders) ? orders : [];
        const mappedOrd: CachedOrder[] = list.map((o: any) => ({
          id: resolveEntityId(o.id, o._id, o.orderNumber, o.order_number) || '',
          patientId: resolveEntityId(o.patientId, o.patient?.id, o.patient?._id) || '',
          status: o.status,
          totalAmount: Number(o.totalAmount) || 0,
          paidAmount: Number(o.paidAmount) || 0,
          createdAt: o.createdAt,
          _raw: o,
          _syncedAt: now,
        }));
        await bulkUpsert(db.orders, mappedOrd);
      } catch {
        // non-critical
      }

      const ts = new Date().toISOString();
      localStorage.setItem('last_full_sync', ts);
      setLastSyncedAt(ts);
      await db.syncMeta.put({ key: 'lastFullSync', lastSyncedAt: now });
    } catch (err) {
      console.error('[Sync] Pull failed:', err);
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, []);

  // ── Flush queued offline mutations ─────────────────────────────
  const flushMutations = useCallback(async () => {
    const pending = await db.pendingMutations
      .where('status')
      .equals('pending')
      .limit(BATCH_SIZE) // Process in batches for better performance
      .sortBy('createdAt');

    if (pending.length === 0) return;

    // Use LAN URL if available and configured URL isn't reachable
    const baseUrl = lanBackendUrl || API_BASE_URL;

    console.log(`[Sync] Flushing ${pending.length} pending mutations...`);

    for (const mut of pending) {
      try {
        await db.pendingMutations.update(mut.id!, { status: 'syncing' });

        const token = getAccessToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        await axios({
          method: mut.method,
          url: `${baseUrl}${mut.url}`,
          data: mut.body,
          headers,
          timeout: 15_000, // Increased timeout for poor networks
        });

        await db.pendingMutations.delete(mut.id!);
        console.log(`[Sync] ✓ Mutation ${mut.id} synced successfully`);
      } catch (err: unknown) {
        const retries = (mut.retries || 0) + 1;
        const axiosErr = err as { response?: unknown; code?: string; message?: string };
        const isNetworkError = !axiosErr.response || axiosErr.code === 'ECONNABORTED';
        
        if (retries >= MAX_RETRIES) {
          await db.pendingMutations.update(mut.id!, {
            status: 'failed',
            retries,
            error: axiosErr?.message || 'Max retries exceeded',
          });
          console.error(`[Sync] ✗ Mutation ${mut.id} failed after ${MAX_RETRIES} retries`);
        } else {
          // Exponential backoff for network errors
          const backoffDelay = isNetworkError ? Math.min(1000 * Math.pow(2, retries), 30000) : 0;
          
          await db.pendingMutations.update(mut.id!, {
            status: 'pending',
            retries,
            error: err?.message,
          });
          
          if (backoffDelay > 0) {
            console.log(`[Sync] ⏳ Mutation ${mut.id} retry ${retries}/${MAX_RETRIES} (backoff: ${backoffDelay}ms)`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }
    }

    const count = await db.pendingMutations
      .where('status')
      .equals('pending')
      .count();
    setPendingCount(count);
  }, [lanBackendUrl]);

  // ── Sync loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isApiReachable) return;

    // Immediately sync on becoming reachable
    pullData();
    flushMutations();

    const pullId = setInterval(pullData, SYNC_INTERVAL);
    const flushId = setInterval(flushMutations, FLUSH_INTERVAL);
    return () => {
      clearInterval(pullId);
      clearInterval(flushId);
    };
  }, [isApiReachable, pullData, flushMutations]);

  // ── Refresh pending count on mount ─────────────────────────────
  useEffect(() => {
    db.pendingMutations
      .where('status')
      .equals('pending')
      .count()
      .then(setPendingCount);
  }, []);

  const syncNow = useCallback(async () => {
    const reachable = await pingApi();
    if (reachable) {
      await flushMutations();
      await pullData();
    }
  }, [pingApi, flushMutations, pullData]);

  const setServerUrl = useCallback(async (url: string): Promise<string | null> => {
    // In Electron, persist and validate via main process
    if (window.electronAPI?.setServerUrl) {
      const result = await window.electronAPI.setServerUrl(url);
      if (result.success) {
        setLanBackendUrl(url);
        setIsApiReachable(true);
        setConnectionMode('lan-only');
        return null;
      }
      return result.error || 'Server not reachable';
    }
    // In browser mode, just try hitting /health
    try {
      await axios.get(`${url}/health`, { timeout: 3000 });
      setLanBackendUrl(url);
      setIsApiReachable(true);
      setConnectionMode('lan-only');
      localStorage.setItem('manual_server_url', url);
      return null;
    } catch {
      return 'Server not reachable at that address';
    }
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isApiReachable,
        isSyncing,
        pendingCount,
        lastSyncedAt,
        syncNow,
        connectionMode,
        lanBackendUrl,
        setServerUrl,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
