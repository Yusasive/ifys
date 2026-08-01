"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCheckInStatus, scan, ScanResult, CheckInStatus } from "@/lib/checkin-api";
import { useAdminAuth, useRequireAdminAuth } from "@/lib/admin-auth-context";
import { getStationId } from "@/lib/station-id";
import { ApiError } from "@/lib/api";
import { ScannerCamera } from "./scanner-camera";
import { ResultOverlay } from "./result-overlay";

const RESULT_DISPLAY_MS = 3000;

export default function CheckInPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const { logout } = useAdminAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const stationIdRef = useRef<string>("");

  useEffect(() => {
    stationIdRef.current = getStationId();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function poll() {
      if (!session) return;
      try {
        const s = await fetchCheckInStatus(session.token);
        if (!cancelled) setStatus(s);
      } catch {
        // status counter is best-effort; scanning still works without it
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, result]);

  async function runScan(params: { qrToken?: string; shortCode?: string }) {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await scan(session.token, {
        ...params,
        stationId: stationIdRef.current,
      });
      setResult(res);
      setCode("");
      setTimeout(() => {
        setResult(null);
        setBusy(false);
      }, RESULT_DISPLAY_MS);
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.body.message : "Scan failed — try again.");
    }
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
      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="font-mono text-neutral-400">
          {status ? `${status.checkedIn} / ${status.totalTickets} checked in` : "…"}
        </span>
        <button
          onClick={() => {
            logout();
            router.replace("/admin/login");
          }}
          className="text-neutral-400 underline"
        >
          Sign out
        </button>
      </div>

      <ScannerCamera paused={busy} onDetect={(text) => void runScan({ qrToken: text })} />

      <form onSubmit={handleManualSubmit} className="mt-6 flex gap-2 max-w-md mx-auto w-full">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter short code"
          autoCapitalize="characters"
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-sm px-4 py-3 text-lg font-mono tracking-widest text-center focus:outline-none focus:border-gold-light"
        />
        <button
          type="submit"
          className="bg-gold text-black font-medium px-6 rounded-sm"
        >
          Check in
        </button>
      </form>

      {error && (
        <p className="mt-4 text-center text-sm text-red-400 max-w-md mx-auto">{error}</p>
      )}
    </main>
  );
}
