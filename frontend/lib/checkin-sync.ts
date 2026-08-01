import { fetchOfflineIndex, syncScans } from "./checkin-api";
import { getQueue, refreshLocalIndex, removeFromQueue } from "./offline-store";

export async function refreshIndex(token: string): Promise<void> {
  const entries = await fetchOfflineIndex(token);
  await refreshLocalIndex(entries);
}

export interface FlushSummary {
  synced: number;
  conflicts: number;
}

// Sends every queued offline scan to the server and clears each one from
// the local queue once the server has a final answer for it — a
// `sync_conflict` is still a resolved outcome (TRD §8: flagged for
// review, not re-queued for another attempt).
export async function flushQueue(token: string): Promise<FlushSummary> {
  const queue = await getQueue();
  if (queue.length === 0) {
    return { synced: 0, conflicts: 0 };
  }

  const results = await syncScans(
    token,
    queue.map((item) => ({
      clientScanId: item.clientScanId,
      qrToken: item.qrToken,
      shortCode: item.shortCode,
      stationId: item.stationId,
      scannedAt: item.scannedAt,
    })),
  );

  let synced = 0;
  let conflicts = 0;
  for (const result of results) {
    await removeFromQueue(result.clientScanId);
    if (result.result === "sync_conflict") {
      conflicts += 1;
    } else {
      synced += 1;
    }
  }
  return { synced, conflicts };
}
