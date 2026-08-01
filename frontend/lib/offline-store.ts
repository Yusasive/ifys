import { openDB, DBSchema, IDBPDatabase } from "idb";
import { sha256Hex } from "./sha256";
import type { AttendeeSummary } from "./checkin-api";

export interface LocalIndexEntry {
  codeHash: string;
  qrHash: string;
  status: string;
  attendee: AttendeeSummary;
}

export interface QueuedScan {
  clientScanId: string;
  qrToken?: string;
  shortCode?: string;
  stationId: string;
  scannedAt: string;
  attendee: AttendeeSummary;
}

interface CheckInDB extends DBSchema {
  index: {
    key: string; // codeHash
    value: LocalIndexEntry;
    indexes: { byQrHash: string };
  };
  queue: {
    key: string; // clientScanId
    value: QueuedScan;
  };
}

let dbPromise: Promise<IDBPDatabase<CheckInDB>> | null = null;

function getDb() {
  dbPromise ??= openDB<CheckInDB>("ify-checkin", 1, {
    upgrade(db) {
      const index = db.createObjectStore("index", { keyPath: "codeHash" });
      index.createIndex("byQrHash", "qrHash");
      db.createObjectStore("queue", { keyPath: "clientScanId" });
    },
  });
  return dbPromise;
}

// TRD §8: replaces the local snapshot wholesale on every successful
// refresh — stale entries from a prior event/day don't linger.
export async function refreshLocalIndex(entries: LocalIndexEntry[]) {
  const db = await getDb();
  const tx = db.transaction("index", "readwrite");
  await tx.store.clear();
  await Promise.all(entries.map((entry) => tx.store.put(entry)));
  await tx.done;
}

export async function getIndexSize(): Promise<number> {
  const db = await getDb();
  return db.count("index");
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

// Marks a ticket used in the LOCAL snapshot only — prevents the same
// offline station from accepting a second scan of a code it already
// admitted, before the real cross-station conflict check can happen at
// sync time.
export async function markLocalUsed(codeHash: string) {
  const db = await getDb();
  const entry = await db.get("index", codeHash);
  if (entry) {
    await db.put("index", { ...entry, status: "used" });
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
