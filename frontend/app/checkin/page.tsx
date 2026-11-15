"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchCheckInStatus,
  scan,
  undoCheckIn,
  CheckInStatus,
} from "@/lib/checkin-api";
import { useAdminAuth, useRequireAdminAuth } from "@/lib/admin-auth-context";
import { getStationId, getStationName, setStationName } from "@/lib/station-id";
import { CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { primeFeedback, signalResult, type FeedbackKind } from "@/lib/feedback";
import { ApiError, describeError } from "@/lib/api";
import { useOnlineStatus } from "@/lib/use-online-status";
import { runSyncCycle } from "@/lib/checkin-sync";
import {
  enqueueScan,
  getIndexInfo,
  getQueueSize,
  getSyncProblems,
  lookupLocal,
  markLocalUsed,
  undoOfflineScan,
  type SyncProblem,
} from "@/lib/offline-store";
import { GuestSearch } from "./guest-search";
import { ScannerCamera } from "./scanner-camera";
import { ProblemsPanel } from "./problems-panel";
import { ResultOverlay } from "./result-overlay";
import type { DisplayResult } from "./types";

// A successful check-in stays up long enough to find the guest's name tag;
// staff can tap to move on sooner.
const SUCCESS_DISPLAY_MS = 6000;
const RESULT_DISPLAY_MS = 3000;
const SYNC_INTERVAL_MS = 10_000;
const INDEX_REFRESH_INTERVAL_MS = 60_000;
// An offline list older than this is flagged so staff know how much to trust it.
const STALE_INDEX_MS = 10 * 60_000;
const CAMERA_DEDUPE_MS = 6000;
// Matches the server's undo window; after this an organizer has to review it.
const UNDO_WINDOW_MS = 2 * 60_000;

interface UndoTarget {
  name: string;
  online?: { ticketId: string };
  offline?: { clientScanId: string; codeHash: string };
}

function feedbackFor(res: DisplayResult): FeedbackKind {
  switch (res.result) {
    case "valid_first_use":
      return "success";
    case "recorded_offline":
    case "offline_unavailable":
      return "warning";
    default:
      return "error";
  }
}

// A struggling server answers 429/5xx; the scan should still go through
// offline rather than blocking the door.
function shouldFallBackOffline(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 429 || err.status >= 500;
}

function isStale(lastSyncAt: string | null): boolean {
  return (
    !lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() > STALE_INDEX_MS
  );
}

function formatAgo(lastSyncAt: string | null): string {
  if (!lastSyncAt) return "never";
  const minutes = Math.round(
    (Date.now() - new Date(lastSyncAt).getTime()) / 60_000,
  );
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

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
  const [problems, setProblems] = useState<SyncProblem[]>([]);
  const [showProblems, setShowProblems] = useState(false);
  const [indexInfo, setIndexInfo] = useState<{
    size: number;
    lastSyncAt: string | null;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Set synchronously: React state would only flip after a re-render, and
  // several camera frames can fire before that.
  const busyRef = useRef(false);
  const lastCameraScan = useRef<{ code: string; at: number } | null>(null);
  const [stationName, setStationNameState] = useState(() =>
    typeof window === "undefined" ? "" : getStationName(),
  );
  const [editingStation, setEditingStation] = useState(false);
  const [stationId, setStationId] = useState(() =>
    typeof window === "undefined" ? "" : getStationId(),
  );
  const [undoTarget, setUndoTarget] = useState<UndoTarget | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function loadLocalState() {
    const [info, list, queued] = await Promise.all([
      getIndexInfo(),
      getSyncProblems(),
      getQueueSize(),
    ]);
    return { info, list, queued };
  }

  function applyLocalState(local: Awaited<ReturnType<typeof loadLocalState>>) {
    setIndexInfo({ size: local.info.size, lastSyncAt: local.info.lastSyncAt });
    setProblems(local.list);
    setPendingCount(local.queued);
  }

  async function reloadLocalState() {
    applyLocalState(await loadLocalState());
  }

  useEffect(() => {
    if (!session || !online) return;
    let cancelled = false;
    let running = false;
    let lastRefreshAt = 0;

    async function cycle() {
      if (!session || running) return;
      running = true;
      const refresh = Date.now() - lastRefreshAt >= INDEX_REFRESH_INTERVAL_MS;
      try {
        await runSyncCycle({ refresh });
        if (refresh) lastRefreshAt = Date.now();
        if (!cancelled) setSyncError(null);
      } catch (err) {
        // Scans stay queued and retry on the next tick, but tell the
        // operator so a stuck queue isn't invisible.
        if (!cancelled)
          setSyncError(describeError(err, "Sync failed. Retrying…"));
      } finally {
        running = false;
        if (!cancelled) await reloadLocalState();
      }
    }

    void cycle();
    const timer = setInterval(() => void cycle(), SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // reloadLocalState only sets state from local storage; it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, online]);

  useEffect(() => {
    void loadLocalState().then(applyLocalState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function runScan(params: {
    qrToken?: string;
    shortCode?: string;
    ticketId?: string;
  }) {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);

    function release() {
      busyRef.current = false;
      setBusy(false);
    }

    function finish(res: DisplayResult, undo?: UndoTarget) {
      signalResult(feedbackFor(res));
      setResult(res);
      setCode("");
      if (undo) offerUndo(undo);
      if (resultTimer.current) clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(
        dismissResult,
        feedbackFor(res) === "error" ? RESULT_DISPLAY_MS : SUCCESS_DISPLAY_MS,
      );
    }

    if (online) {
      try {
        const res = await scan({ ...params, stationId });
        finish(
          res,
          res.result === "valid_first_use"
            ? {
                name: res.attendee.fullName,
                online: { ticketId: res.ticketId },
              }
            : undefined,
        );
        return;
      } catch (err) {
        if (!shouldFallBackOffline(err)) {
          release();
          setError(describeError(err));
          return;
        }
        // Network failure or a struggling server (429/5xx) — fall
        // through to the offline path rather than blocking the scan.
      }
    }

    if (params.ticketId) {
      release();
      setError(
        "Can't check in by name while offline. Scan the QR code or enter the short code.",
      );
      return;
    }
    const entry = await lookupLocal(params);
    if (!entry) {
      // An empty list means nothing was ever downloaded — say so instead of
      // calling every guest invalid.
      const info = await getIndexInfo();
      finish({ result: info.size === 0 ? "offline_unavailable" : "not_found" });
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

    const clientScanId = crypto.randomUUID();
    await markLocalUsed(entry.codeHash);
    await enqueueScan({
      clientScanId,
      qrToken: params.qrToken,
      shortCode: params.shortCode?.trim().toUpperCase(),
      codeHash: entry.codeHash,
      stationId,
      scannedAt: new Date().toISOString(),
      attendee: entry.attendee,
    });
    finish(
      {
        result: "recorded_offline",
        attendee: entry.attendee,
        undo: { clientScanId, codeHash: entry.codeHash },
      },
      {
        name: entry.attendee.fullName,
        offline: { clientScanId, codeHash: entry.codeHash },
      },
    );
  }

  function dismissResult() {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = null;
    setResult(null);
    busyRef.current = false;
    setBusy(false);
  }

  function offerUndo(target: UndoTarget) {
    setUndoTarget(target);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoTarget(null), UNDO_WINDOW_MS);
  }

  async function handleUndo() {
    if (!undoTarget) return;
    try {
      if (undoTarget.online) await undoCheckIn(undoTarget.online.ticketId);
      else if (undoTarget.offline) {
        await undoOfflineScan(
          undoTarget.offline.clientScanId,
          undoTarget.offline.codeHash,
        );
      }
      setUndoTarget(null);
      setError(null);
    } catch (err) {
      setError(describeError(err, "Couldn't undo that check-in."));
    }
  }

  function handleStationSave(e: FormEvent) {
    e.preventDefault();
    setStationName(stationName);
    setStationId(getStationId());
    setEditingStation(false);
  }

  function handleCameraDetect(text: string) {
    const last = lastCameraScan.current;
    const now = Date.now();
    if (
      busyRef.current ||
      (last && last.code === text && now - last.at < CAMERA_DEDUPE_MS)
    ) {
      return;
    }
    lastCameraScan.current = { code: text, at: now };
    void runScan({ qrToken: text });
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    void runScan({ shortCode: code.trim() });
  }

  if (authLoading || !session) return null;

  return (
    <main className="min-h-screen bg-white flex flex-col px-4 py-6">
      {result && <ResultOverlay result={result} onDismiss={dismissResult} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b border-rust/20 pb-4">
        <div className="flex flex-wrap items-center gap-2 font-plex text-sm text-emerald/70">
          <span className="font-medium text-emerald">
            {status
              ? `${status.checkedIn} / ${status.totalTickets} checked in`
              : "…"}
          </span>

          {editingStation ? (
            <form
              onSubmit={handleStationSave}
              className="inline-flex items-center gap-1"
            >
              <input
                autoFocus
                value={stationName}
                onChange={(e) => setStationNameState(e.target.value)}
                placeholder="e.g. Main gate"
                aria-label="Station name"
                className="w-32 rounded-full border border-rust/50 px-3 py-1 text-xs text-emerald focus:outline-none"
              />
              <button
                type="submit"
                className="text-xs font-semibold text-rust underline"
              >
                Save
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditingStation(true)}
              className="rounded-full border border-rust/30 px-2.5 py-1 text-xs font-medium text-emerald/70 hover:text-rust"
            >
              {stationName ? `Station: ${stationName}` : "Name this station"}
            </button>
          )}

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              online ? "bg-emerald/10 text-emerald" : "bg-rust/10 text-rust"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald" : "bg-rust"}`}
              aria-hidden="true"
            />
            {online ? "Online" : "Offline"}
          </span>

          {pendingCount > 0 && (
            <span className="rounded-full bg-rust/10 text-rust text-xs font-medium px-2.5 py-1">
              {pendingCount} queued
            </span>
          )}
          {problems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowProblems((v) => !v)}
              className="rounded-full bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1"
            >
              {problems.length} to review
            </button>
          )}
        </div>

        <button
          onClick={() => {
            logout();
            router.replace("/admin/login");
          }}
          className="self-start sm:self-auto text-sm font-medium text-emerald/60 hover:text-rust border border-rust/30 hover:border-rust rounded-full px-4 py-1.5 shrink-0 transition-colors"
        >
          Sign out
        </button>
      </div>

      {status && status.groups.length > 0 && (
        <details className="mb-4 max-w-md mx-auto w-full text-sm text-emerald/80">
          <summary className="cursor-pointer text-center font-medium">
            {Object.entries(
              status.groups.reduce<Record<string, [number, number]>>(
                (acc, g) => {
                  const [done, total] = acc[g.category] ?? [0, 0];
                  acc[g.category] = [done + g.checkedIn, total + g.total];
                  return acc;
                },
                {},
              ),
            )
              .map(
                ([cat, [done, total]]) =>
                  `${CATEGORY_LABELS[cat] ?? cat} ${done}/${total}`,
              )
              .join(" · ")}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {status.groups.map((g) => (
              <li
                key={`${g.category}:${g.tier}`}
                className="flex justify-between"
              >
                <span>
                  {CATEGORY_LABELS[g.category] ?? g.category} ·{" "}
                  {TIER_LABELS[g.tier] ?? g.tier}
                </span>
                <span className="font-medium">
                  {g.checkedIn} / {g.total}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {undoTarget && (
        <div className="mb-4 max-w-md mx-auto w-full flex items-center justify-between gap-3 rounded-2xl border border-rust/30 bg-rust/5 px-4 py-2 text-sm">
          <span className="min-w-0 truncate">
            Checked in <strong>{undoTarget.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => void handleUndo()}
            className="shrink-0 font-semibold text-rust underline"
          >
            Undo
          </button>
        </div>
      )}

      {showProblems && problems.length > 0 && (
        <ProblemsPanel
          problems={problems}
          onDismissed={() => void reloadLocalState()}
        />
      )}

      {indexInfo && indexInfo.size === 0 && (
        <p
          role="alert"
          className="mb-4 text-center text-sm text-rust max-w-md mx-auto"
        >
          No offline ticket list on this device yet.{" "}
          {online
            ? "Downloading…"
            : "Reconnect to download it — offline scans can't be verified until then."}
        </p>
      )}
      {indexInfo &&
        indexInfo.size > 0 &&
        !online &&
        isStale(indexInfo.lastSyncAt) && (
          <p
            role="alert"
            className="mb-4 text-center text-sm text-rust max-w-md mx-auto"
          >
            Offline list last updated {formatAgo(indexInfo.lastSyncAt)} — recent
            changes (voided or reissued tickets) may be missing.
          </p>
        )}

      {scanning ? (
        <div className="max-w-md mx-auto w-full">
          <ScannerCamera paused={busy} onDetect={handleCameraDetect} />
          <button
            onClick={() => setScanning(false)}
            className="mt-3 w-full text-emerald/60 hover:text-rust underline text-sm transition-colors"
          >
            Stop camera
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            primeFeedback();
            setScanning(true);
          }}
          className="max-w-md mx-auto w-full aspect-[3/1] bg-rust text-white rounded-[20px] flex items-center justify-center text-lg font-sans font-medium hover:bg-rust/90 transition-colors"
        >
          Start scanning
        </button>
      )}

      <GuestSearch
        online={online}
        disabled={busy}
        onCheckIn={(ticketId) => void runScan({ ticketId })}
      />

      <form
        onSubmit={handleManualSubmit}
        className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto w-full"
      >
        <label htmlFor="manual-check-in-code" className="sr-only">
          Manual check-in code
        </label>
        <input
          id="manual-check-in-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter short code"
          autoCapitalize="characters"
          className="flex-1 min-w-0 bg-white border border-rust/70 rounded-full px-5 py-3 text-base sm:text-lg font-mono tracking-widest text-center text-emerald placeholder:text-emerald/50 focus:outline-none focus:border-rust"
        />
        <button
          type="submit"
          className="w-full sm:w-auto flex items-center justify-center bg-rust text-white font-sans font-semibold px-6 py-3 rounded-full hover:bg-rust/90 transition-colors"
        >
          Check in
        </button>
      </form>

      {syncError && (
        <p
          role="alert"
          className="mt-4 text-center text-sm text-rust max-w-md mx-auto"
        >
          Offline scans could not sync: {syncError}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 text-center text-sm text-red-600 max-w-md mx-auto"
        >
          {error}
        </p>
      )}
    </main>
  );
}
