"use client";

import { useState } from "react";
import { AuditLogEntry } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { TableRowsSkeleton } from "./skeleton";

function DetailsToggle({ metadataJson }: { metadataJson: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const hasDetails = metadataJson && Object.keys(metadataJson).length > 0;

  if (!hasDetails) return <span className="text-sage">—</span>;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-emerald underline"
      >
        {open ? "Hide" : "Details"}
      </button>
      {open && (
        <pre className="mt-2 max-w-md whitespace-pre-wrap break-words rounded-xl bg-emerald/5 border border-emerald/20 px-3 py-2 text-xs font-mono">
          {JSON.stringify(metadataJson, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditLogTable({
  entries,
  loading,
  hasLoadedOnce,
  showActor,
}: {
  entries: AuditLogEntry[];
  loading: boolean;
  hasLoadedOnce: boolean;
  showActor: boolean;
}) {
  const colCount = showActor ? 5 : 4;

  return (
    <div className="border border-emerald/20 rounded-2xl overflow-x-auto bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
            <th className="px-4 py-2">Timestamp</th>
            {showActor && <th className="px-4 py-2">Actor</th>}
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">Target</th>
            <th className="px-4 py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {loading && !hasLoadedOnce && <TableRowsSkeleton cols={colCount} />}
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-emerald/20 last:border-0 hover:bg-emerald/5">
              <td className="px-4 py-2 text-sage whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
              {showActor && (
                <td className="px-4 py-2">
                  {entry.actor ? (
                    <>
                      {entry.actor.name}{" "}
                      <span className="text-xs text-sage font-mono">({entry.actor.role})</span>
                    </>
                  ) : (
                    <span className="text-sage">—</span>
                  )}
                </td>
              )}
              <td className="px-4 py-2 font-mono text-xs">{entry.action}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {entry.targetType}:{entry.targetId}
              </td>
              <td className="px-4 py-2">
                <DetailsToggle metadataJson={entry.metadataJson} />
              </td>
            </tr>
          ))}
          {entries.length === 0 && !loading && (
            <tr>
              <td colSpan={colCount} className="px-4 py-8 text-center text-sage">
                No audit log entries match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
