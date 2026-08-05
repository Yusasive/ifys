"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCheckInStatus, scan, CheckInStatus } from "@/lib/checkin-api";
import { useAdminAuth, useRequireAdminAuth } from "@/lib/admin-auth-context";
import { getStationId } from "@/lib/station-id";
import { ApiError } from "@/lib/api";
import { useOnlineStatus } from "@/lib/use-online-status";
import { flushQueue, refreshIndex } from "@/lib/checkin-sync";
import {
  enqueueScan,
  getQueueSize,
  lookupLocal,
  markLocalUsed,
} from "@/lib/offline-store";
import { ScannerCamera } from "./scanner-camera";
import { ResultOverlay } from "./result-overlay";
import type { DisplayResult } from "./types";

const RESULT_DISPLAY_MS = 3000;
const SYNC_INTERVAL_MS = 10_000;
const INDEX_REFRESH_INTERVAL_MS = 60_000;

export default function CheckInPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const { logout } = useAdminAuth();
  const router = useRouter();
  const online = useOnlineStatus();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [stationId] = useState(() =>
    typeof window === "undefined" ? "" : getStationId(),
  );

  // Status counter poll — best-effort, only meaningful while online.
  useEffect(() => {
    if (!session || !online) return;
    let cancelled = false;
    async function poll() {
      if (!session) return;
      try {
        const s = await fetchCheckInStatus();
        if (!cancelled) setStatus(s);
      } catch {
        // best-effort; scanning still works without it
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, online, result]);

  // Keep the local offline index fresh while online, and flush any
  // queued offline scans the moment connectivity returns — this is the
  // "sync on reconnect" half of TRD §8.
  useEffect(() => {
    if (!session || !online) return;
    let cancelled = false;

    async function syncUp() {
      if (!session) return;
      try {
        const summary = await flushQueue();
        if (cancelled) return;
        if (summary.conflicts > 0) {
          setConflictCount((c) => c + summary.conflicts);
        }
        setPendingCount(await getQueueSize());
      } catch {
        // will retry on the next tick or the next 'online' event
      }
    }

    async function refresh() {
      if (!session) return;
      try {
        await refreshIndex();
      } catch {
        // keep using whatever snapshot we already have
      }
    }

    void syncUp();
    void refresh();
    const syncTimer = setInterval(() => void syncUp(), SYNC_INTERVAL_MS);
    const refreshTimer = setInterval(() => void refresh(), INDEX_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(syncTimer);
      clearInterval(refreshTimer);
    };
  }, [session, online]);

  useEffect(() => {
    void getQueueSize().then(setPendingCount);
  }, [result]);

  async function runScan(params: { qrToken?: string; shortCode?: string }) {
    if (!session || busy) return;
    setBusy(true);
    setError(null);

    function finish(res: DisplayResult) {
      setResult(res);
      setCode("");
      setTimeout(() => {
        setResult(null);
        setBusy(false);
      }, RESULT_DISPLAY_MS);
    }

    if (online) {
      try {
        const res = await scan({ ...params, stationId });
        finish(res);
        return;
      } catch (err) {
        if (err instanceof ApiError) {
          setBusy(false);
          setError(err.body.message);
          return;
        }
        // Network-level failure (not an API error response) — fall
        // through to the offline path rather than blocking the scan.
      }
    }

    // Offline path: resolve locally against the last-downloaded snapshot.
    const entry = await lookupLocal(params);
    if (!entry) {
      finish({ result: "not_found" });
      return;
    }
    if (entry.status === "void") {
      finish({ result: "void", attendee: entry.attendee });
      return;
    }
    if (entry.status === "used") {
      finish({ result: "already_used_offline", attendee: entry.attendee });
      return;
    }

    await markLocalUsed(entry.codeHash);
    await enqueueScan({
      clientScanId: crypto.randomUUID(),
      qrToken: params.qrToken,
      shortCode: params.shortCode?.trim().toUpperCase(),
      stationId,
      scannedAt: new Date().toISOString(),
      attendee: entry.attendee,
    });
    finish({ result: "recorded_offline", attendee: entry.attendee });
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    void runScan({ shortCode: code.trim() });
  }

  if (authLoading || !session) return null;

  if (result) {
    return <ResultOverlay result={result} />;
  }

  return (
    <main className="min-h-screen flex flex-col px-4 py-6">
      <div className="flex items-center justify-between mb-4 text-sm gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3 font-mono text-muted">
          <span>{status ? `${status.checkedIn} / ${status.totalTickets} checked in` : "…"}</span>
          <span className={online ? "text-emerald" : "text-gold"}>
            {online ? "online" : "offline"}
          </span>
          {pendingCount > 0 && <span className="text-gold">{pendingCount} queued</span>}
          {conflictCount > 0 && (
            <span className="text-red-600">{conflictCount} sync conflict{conflictCount > 1 ? "s" : ""}</span>
          )}
        </div>
        <button
          onClick={() => {
            logout();
            router.replace("/admin/login");
          }}
          className="text-muted underline shrink-0"
        >
          Sign out
        </button>
      </div>

      {scanning ? (
        <div className="max-w-md mx-auto w-full">
          <ScannerCamera paused={busy} onDetect={(text) => void runScan({ qrToken: text })} />
          <button
            onClick={() => setScanning(false)}
            className="mt-3 w-full text-muted underline text-sm"
          >
            Stop camera
          </button>
        </div>
      ) : (
        <button
          onClick={() => setScanning(true)}
          className="max-w-md mx-auto w-full aspect-[3/1] bg-white border border-line rounded-sm flex items-center justify-center text-lg font-medium text-emerald hover:bg-paper-2"
        >
          Start scanning
        </button>
      )}

      <form onSubmit={handleManualSubmit} className="mt-6 flex gap-2 max-w-md mx-auto w-full">
        <label htmlFor="manual-check-in-code" className="sr-only">
          Manual check-in code
        </label>
        <input
          id="manual-check-in-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter short code"
          autoCapitalize="characters"
          className="flex-1 bg-white border border-line rounded-sm px-4 py-3 text-lg font-mono tracking-widest text-center text-ink focus:outline-none focus:border-gold"
        />
        <button
          type="submit"
          className="bg-gold text-ink font-medium px-6 rounded-sm"
        >
          Check in
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-red-600 max-w-md mx-auto">
          {error}
        </p>
      )}
    </main>
  );
}
