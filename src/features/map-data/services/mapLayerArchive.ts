/**
 * TarlaPusula ortak cihaz önbelleği / katman arşivi.
 *
 * Amaç:
 * - Tüm harita katmanları için tek IndexedDB altyapısı kullanmak.
 * - Tarihli uydu/radar kayıtlarını kalıcı tutmak.
 * - Dinamik katmanları TTL ile yenilemek.
 * - İşleme algoritması değiştiğinde processingVersion ile eski hesapları
 *   otomatik devre dışı bırakmak.
 */

 const DB_NAME = 'tarlapusula-map-layer-archive-v1';
 const DB_VERSION = 1;
 const STORE_NAME = 'entries';
 
 export type MapLayerArchiveEntry<T> = {
   key: string;
   namespace: string;
   savedAt: number;
   expiresAt: number | null;
   processingVersion: string;
   data: T;
 };
 
 export type MapLayerArchiveReadOptions = {
   namespace: string;
   key: string;
   processingVersion: string;
   ttlMs?: number | null;
   allowExpired?: boolean;
 };
 
 export type MapLayerArchiveWriteOptions<T> = {
   namespace: string;
   key: string;
   processingVersion: string;
   data: T;
   ttlMs?: number | null;
 };
 
 let dbPromise: Promise<IDBDatabase | null> | null = null;
 
 function openDb() {
   if (typeof indexedDB === 'undefined') {
     return Promise.resolve<IDBDatabase | null>(null);
   }
 
   if (dbPromise) return dbPromise;
 
   dbPromise = new Promise<IDBDatabase | null>((resolve) => {
     try {
       const request = indexedDB.open(DB_NAME, DB_VERSION);
 
       request.onupgradeneeded = () => {
         const db = request.result;
         if (!db.objectStoreNames.contains(STORE_NAME)) {
           db.createObjectStore(STORE_NAME, { keyPath: 'key' });
         }
       };
 
       request.onsuccess = () => resolve(request.result);
       request.onerror = () => resolve(null);
       request.onblocked = () => resolve(null);
     } catch {
       resolve(null);
     }
   });
 
   return dbPromise;
 }
 
 function storageKey(namespace: string, key: string) {
   return `${namespace}:${key}`;
 }
 
 function effectiveExpiresAt(
   savedAt: number,
   storedExpiresAt: unknown,
   ttlMs: number | null | undefined,
 ) {
   const explicit = Number(storedExpiresAt);
   if (Number.isFinite(explicit) && explicit > 0) return explicit;
   if (ttlMs == null) return null;
   return savedAt + Math.max(0, ttlMs);
 }
 
 async function removeByStorageKey(key: string) {
   const db = await openDb();
   if (!db) return;
 
   await new Promise<void>((resolve) => {
     try {
       const transaction = db.transaction(STORE_NAME, 'readwrite');
       transaction.objectStore(STORE_NAME).delete(key);
       transaction.oncomplete = () => resolve();
       transaction.onerror = () => resolve();
       transaction.onabort = () => resolve();
     } catch {
       resolve();
     }
   });
 }
 
 export async function readMapLayerArchive<T>(
   options: MapLayerArchiveReadOptions,
 ): Promise<T | null> {
   const db = await openDb();
   if (!db) return null;
 
   const key = storageKey(options.namespace, options.key);
 
   return new Promise<T | null>((resolve) => {
     try {
       const transaction = db.transaction(STORE_NAME, 'readonly');
       const request = transaction.objectStore(STORE_NAME).get(key);
 
       request.onsuccess = () => {
         const entry = request.result as MapLayerArchiveEntry<T> | undefined;
 
         if (!entry || entry.processingVersion !== options.processingVersion) {
           resolve(null);
           if (entry) void removeByStorageKey(key);
           return;
         }
 
         const savedAt = Number(entry.savedAt || 0);
         const expiresAt = effectiveExpiresAt(
           savedAt,
           entry.expiresAt,
           options.ttlMs,
         );
 
         if (
           !options.allowExpired &&
           expiresAt != null &&
           Number.isFinite(expiresAt) &&
           expiresAt <= Date.now()
         ) {
           resolve(null);
           void removeByStorageKey(key);
           return;
         }
 
         resolve(entry.data ?? null);
       };
 
       request.onerror = () => resolve(null);
     } catch {
       resolve(null);
     }
   });
 }
 
 export async function writeMapLayerArchive<T>(
   options: MapLayerArchiveWriteOptions<T>,
 ) {
   const db = await openDb();
   if (!db) return;
 
   const savedAt = Date.now();
   const expiresAt =
     options.ttlMs == null
       ? null
       : savedAt + Math.max(0, Number(options.ttlMs) || 0);
 
   const entry: MapLayerArchiveEntry<T> = {
     key: storageKey(options.namespace, options.key),
     namespace: options.namespace,
     savedAt,
     expiresAt,
     processingVersion: options.processingVersion,
     data: options.data,
   };
 
   await new Promise<void>((resolve) => {
     try {
       const transaction = db.transaction(STORE_NAME, 'readwrite');
       transaction.objectStore(STORE_NAME).put(entry);
       transaction.oncomplete = () => resolve();
       transaction.onerror = () => resolve();
       transaction.onabort = () => resolve();
     } catch {
       resolve();
     }
   });
 }
 
 export async function deleteMapLayerArchive(
   namespace: string,
   key: string,
 ) {
   await removeByStorageKey(storageKey(namespace, key));
 }
 
 export async function requestMapLayerPersistentStorage() {
   try {
     if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
       return false;
     }
     return await navigator.storage.persist();
   } catch {
     return false;
   }
 }
 
 /** Küçük, deterministik bir imza. Geometri/filtre değişince cache scope'u da değişir. */
 export function mapLayerStableHash(value: unknown) {
   let text = '';
   try {
     text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
   } catch {
     text = String(value ?? '');
   }
 
   let hash = 2166136261;
   for (let index = 0; index < text.length; index += 1) {
     hash ^= text.charCodeAt(index);
     hash = Math.imul(hash, 16777619);
   }
   return (hash >>> 0).toString(36);
 }
 
 export function mapLayerArchiveIsFresh(
   syncedAt: number | null | undefined,
   intervalMs: number,
   now = Date.now(),
 ) {
   const value = Number(syncedAt);
   return Number.isFinite(value) && value > 0 && now - value < intervalMs;
 }
 
 export async function listMapLayerArchiveEntries(
   options: {
     namespacePrefix?: string;
     keyPrefix?: string;
   } = {},
 ): Promise<MapLayerArchiveEntry<unknown>[]> {
   const db = await openDb();
   if (!db) return [];
 
   return new Promise<MapLayerArchiveEntry<unknown>[]>((resolve) => {
     try {
       const transaction = db.transaction(STORE_NAME, 'readonly');
       const request = transaction.objectStore(STORE_NAME).getAll();
 
       request.onsuccess = () => {
         const rows = Array.isArray(request.result)
           ? (request.result as MapLayerArchiveEntry<unknown>[])
           : [];
 
         resolve(
           rows.filter((entry) => {
             if (
               options.namespacePrefix &&
               !String(entry.namespace ?? '').startsWith(options.namespacePrefix)
             ) {
               return false;
             }
 
             if (
               options.keyPrefix &&
               !String(entry.key ?? '').startsWith(options.keyPrefix)
             ) {
               return false;
             }
 
             return true;
           }),
         );
       };
 
       request.onerror = () => resolve([]);
     } catch {
       resolve([]);
     }
   });
 }
 