export type RecentDirectoryStatus = "ready" | "needs-permission" | "unavailable";

export interface RecentDirectoryEntry {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  createdAt: string;
  lastUsedAt: string;
  status: RecentDirectoryStatus;
}

const DB_NAME = "openrad-persistence";
const DB_VERSION = 1;
const STORE_NAME = "recent-directories";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB operation failed"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("IndexedDB transaction failed"));
    };
  });
}

function sortByLastUsed(entries: RecentDirectoryEntry[]): RecentDirectoryEntry[] {
  return [...entries].sort((a, b) =>
    new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
  );
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `recent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function listRecentDirectories(): Promise<RecentDirectoryEntry[]> {
  const entries = await runTransaction<RecentDirectoryEntry[]>("readonly", (store) => store.getAll());
  return sortByLastUsed(entries || []);
}

export async function removeRecentDirectory(id: string): Promise<void> {
  await runTransaction("readwrite", (store) => store.delete(id));
}

export async function touchRecentDirectory(id: string): Promise<void> {
  const entry = await runTransaction<RecentDirectoryEntry | undefined>("readonly", (store) => store.get(id));
  if (!entry) return;

  const updated: RecentDirectoryEntry = {
    ...entry,
    lastUsedAt: new Date().toISOString(),
  };

  await runTransaction("readwrite", (store) => store.put(updated));
}

export async function markRecentDirectoryStatus(
  id: string,
  status: RecentDirectoryStatus
): Promise<void> {
  const entry = await runTransaction<RecentDirectoryEntry | undefined>("readonly", (store) => store.get(id));
  if (!entry) return;

  const updated: RecentDirectoryEntry = {
    ...entry,
    status,
  };

  await runTransaction("readwrite", (store) => store.put(updated));
}

export async function findMatchingRecent(
  handle: FileSystemDirectoryHandle
): Promise<RecentDirectoryEntry | null> {
  const entries = await listRecentDirectories();

  for (const entry of entries) {
    if (await entry.handle.isSameEntry(handle)) {
      return entry;
    }
  }

  return null;
}

export async function saveRecentDirectory(
  handle: FileSystemDirectoryHandle
): Promise<RecentDirectoryEntry> {
  const now = new Date().toISOString();
  const existing = await findMatchingRecent(handle);

  if (existing) {
    const updated: RecentDirectoryEntry = {
      ...existing,
      name: handle.name,
      handle,
      status: "ready",
      lastUsedAt: now,
    };
    await runTransaction("readwrite", (store) => store.put(updated));
    return updated;
  }

  const created: RecentDirectoryEntry = {
    id: generateId(),
    name: handle.name,
    handle,
    status: "ready",
    createdAt: now,
    lastUsedAt: now,
  };
  await runTransaction("readwrite", (store) => store.add(created));
  return created;
}
