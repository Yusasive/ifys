import { openDB, DBSchema, IDBPDatabase } from "idb";
import { sha256Hex } from "./sha256";
import type { AttendeeSummary } from "./checkin-api";

export interface LocalIndexEntry {
  ticketId: string;
  codeHash: string;
  qrHash: string;
  status: string;
  attendee: AttendeeSummary;
  // Marked used here but not yet confirmed by the server. A refresh must not
  // revert it, or this station could admit the same ticket twice.
  pendingSync?: boolean;
}

export interface QueuedScan {
  clientScanId: string;
  qrToken?: string;
  shortCode?: string;
  // Lets the pendingSync mark be cleared once the server has answered.
  codeHash?: string;
  stationId: string;
  scannedAt: string;
  attendee: AttendeeSummary;
}

// An offline scan the server did not accept cleanly. Kept until staff
// dismiss it, so it survives a reload and nobody has to remember it.
export interface SyncProblem {
  clientScanId: string;
  kind: "conflict" | "void" | "not_found" | "invalid";
  attendee?: AttendeeSummary;
  stationId: string;
  scannedAt: string;
  firstUsedAt?: string;
  firstUsedStation?: string;
  reason?: string;
  recordedAt: string;
}

interface IndexMeta {
  lastSyncAt: string | null;
  lastFullAt: string | null;
}

interface CheckInDB extends DBSchema {
  index: {
    key: string; // codeHash
    value: LocalIndexEntry;
    indexes: { byQrHash: string; byTicketId: string };
  };
  queue: {
    key: string; // clientScanId
    value: QueuedScan;
  };
  meta: {
    key: string;
    value: IndexMeta & { key: string };
  };
  problems: {
    key: string; // clientScanId
    value: SyncProblem;
  };
}

const META_KEY = "index";

let dbPromise: Promise<IDBPDatabase<CheckInDB>> | null = null;

function getDb() {
  dbPromise ??= openDB<CheckInDB>("ify-checkin", 3, {
    upgrade(db, oldVersion) {
      if (oldVersion >= 1) {
        // The v1 store name is valid at runtime but not in the v2 schema type.
        (db as unknown as IDBPDatabase).deleteObjectStore("index");
      }
      const index = db.createObjectStore("index", { keyPath: "codeHash" });
      index.createIndex("byQrHash", "qrHash");
      index.createIndex("byTicketId", "ticketId");
      if (oldVersion < 1) {
        db.createObjectStore("queue", { keyPath: "clientScanId" });
      }
      if (oldVersion < 2) {
        db.createObjectStore("meta", { keyPath: "key" });
        db.createObjectStore("problems", { keyPath: "clientScanId" });
      }
    },
  });
  return dbPromise;
}

export async function applyIndexUpdate(
  entries: LocalIndexEntry[],
  update: { full: boolean; syncedAt: string },
) {
  const db = await getDb();
  const tx = db.transaction(["index", "meta"], "readwrite");
  const store = tx.objectStore("index");

  if (update.full) {
    const incoming = new Set(entries.map((e) => e.codeHash));
    const existing = await store.getAll();
    for (const entry of existing) {
      if (!incoming.has(entry.codeHash) && !entry.pendingSync) {
        await store.delete(entry.codeHash);
      }
    }
  }

  for (const entry of entries) {
    const local = await store.get(entry.codeHash);
    if (local?.pendingSync) continue;
    // Reissue: same ticket, new code/QR — remove the superseded hashes.
    const sameTicket = await store.index("byTicketId").getAll(entry.ticketId);
    for (const old of sameTicket) {
      if (old.codeHash !== entry.codeHash && !old.pendingSync) {
        await store.delete(old.codeHash);
      }
    }
    await store.put(entry);
  }

  const metaStore = tx.objectStore("meta");
  const prev = await metaStore.get(META_KEY);
  await metaStore.put({
    key: META_KEY,
    lastSyncAt: update.syncedAt,
    lastFullAt: update.full ? update.syncedAt : (prev?.lastFullAt ?? null),
  });
  await tx.done;
}

export async function getIndexInfo(): Promise<IndexMeta & { size: number }> {
  const db = await getDb();
  const [meta, size] = await Promise.all([db.get("meta", META_KEY), db.count("index")]);
  return {
    lastSyncAt: meta?.lastSyncAt ?? null,
    lastFullAt: meta?.lastFullAt ?? null,
    size,
  };
}

export async function lookupLocal(params: {
  qrToken?: string;
  shortCode?: string;
}): Promise<LocalIndexEntry | undefined> {
  const db = await getDb();
  if (params.qrToken) {
    const hash = await sha256Hex(params.qrToken);
    return db.getFromIndex("index", "byQrHash", hash);
  }
  const hash = await sha256Hex(params.shortCode!.trim().toUpperCase());
  return db.get("index", hash);
}

export async function markLocalUsed(codeHash: string) {
  const db = await getDb();
  const entry = await db.get("index", codeHash);
  if (entry) {
    await db.put("index", { ...entry, status: "used", pendingSync: true });
  }
}

export async function clearPendingSync(codeHash: string) {
  const db = await getDb();
  const entry = await db.get("index", codeHash);
  if (entry?.pendingSync) {
    await db.put("index", { ...entry, pendingSync: false });
  }
}

export async function enqueueScan(scan: QueuedScan) {
  const db = await getDb();
  await db.put("queue", scan);
}

export async function getQueue(): Promise<QueuedScan[]> {
  const db = await getDb();
  return db.getAll("queue");
}

export async function getQueueSize(): Promise<number> {
  const db = await getDb();
  return db.count("queue");
}

export async function removeFromQueue(clientScanId: string) {
  const db = await getDb();
  await db.delete("queue", clientScanId);
}

export async function addSyncProblem(problem: SyncProblem) {
  const db = await getDb();
  await db.put("problems", problem);
}

export async function getSyncProblems(): Promise<SyncProblem[]> {
  const db = await getDb();
  const all = await db.getAll("problems");
  return all.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export async function dismissSyncProblem(clientScanId: string) {
  const db = await getDb();
  await db.delete("problems", clientScanId);
}

// Takes back an offline check-in that has not synced yet: drops it from the
// queue and frees the ticket again on this device.
export async function undoOfflineScan(clientScanId: string, codeHash: string) {
  const db = await getDb();
  await db.delete("queue", clientScanId);
  const entry = await db.get("index", codeHash);
  if (entry) {
    await db.put("index", { ...entry, status: "unused", pendingSync: false });
  }
}
