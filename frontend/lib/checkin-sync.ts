import { fetchOfflineIndex, syncScans } from "./checkin-api";
import {
  addSyncProblem,
  applyIndexUpdate,
  clearPendingSync,
  getIndexInfo,
  getQueue,
  removeFromQueue,
  type SyncProblem,
} from "./offline-store";

// Deltas keep the list current cheaply; a periodic full download also
// catches anything a delta can't express (e.g. a ticket that disappeared).
const FULL_RESYNC_MS = 30 * 60_000;

export async function refreshIndex(): Promise<void> {
  const info = await getIndexInfo();
  const needFull =
    !info.lastSyncAt ||
    info.size === 0 ||
    !info.lastFullAt ||
    Date.now() - new Date(info.lastFullAt).getTime() > FULL_RESYNC_MS;

  const res = await fetchOfflineIndex(needFull ? undefined : (info.lastSyncAt ?? undefined));
  await applyIndexUpdate(res.entries, { full: res.full, syncedAt: res.syncedAt });
}

export interface FlushSummary {
  synced: number;
  problems: number;
}

// Sends every queued offline scan to the server and clears each one from
// the local queue once the server has a final answer for it. Anything but a
// clean result (a conflict, a ticket voided in the meantime, a rejected
// item) is saved as a SyncProblem for staff to review — it is resolved, not
// re-queued for another attempt (TRD §8).
export async function flushQueue(): Promise<FlushSummary> {
  const queue = await getQueue();
  if (queue.length === 0) {
    return { synced: 0, problems: 0 };
  }
  const byId = new Map(queue.map((item) => [item.clientScanId, item]));

  const results = await syncScans(
    queue.map((item) => ({
      clientScanId: item.clientScanId,
      qrToken: item.qrToken,
      shortCode: item.shortCode,
      stationId: item.stationId,
      scannedAt: item.scannedAt,
    })),
  );

  let synced = 0;
  let problems = 0;
  for (const result of results) {
    const item = byId.get(result.clientScanId);
    if (
      result.result === "valid_first_use" ||
      result.result === "already_synced"
    ) {
      synced += 1;
    } else if (item) {
      const problem: SyncProblem = {
        clientScanId: result.clientScanId,
        kind: result.result === "sync_conflict" ? "conflict" : result.result,
        stationId: item.stationId,
        scannedAt: item.scannedAt,
        recordedAt: new Date().toISOString(),
        attendee:
          "attendee" in result ? result.attendee : item.attendee,
        ...(result.result === "sync_conflict"
          ? {
              firstUsedAt: result.firstUsedAt,
              firstUsedStation: result.firstUsedStation,
            }
          : {}),
        ...(result.result === "invalid" ? { reason: result.reason } : {}),
      };
      await addSyncProblem(problem);
      problems += 1;
    }
    if (item?.codeHash) await clearPendingSync(item.codeHash);
    await removeFromQueue(result.clientScanId);
  }
  return { synced, problems };
}

/**
 * One sync cycle: upload queued scans first, then download the list. The
 * order matters — refreshing before the queue is empty could revert this
 * station's own unsynced check-ins. If the upload fails, the download is
 * skipped and the error is rethrown so the UI can show it.
 */
export async function runSyncCycle(options: { refresh: boolean }): Promise<FlushSummary> {
  const summary = await flushQueue();
  if (options.refresh) {
    await refreshIndex();
  }
  return summary;
}
