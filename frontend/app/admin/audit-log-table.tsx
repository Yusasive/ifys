"use client";

import { useState } from "react";
import { AuditLogEntry } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { DetailsGrid, DetailsModal } from "./details-modal";
import { TableRowsSkeleton } from "./skeleton";

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
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const hasMetadata = (entry: AuditLogEntry) =>
    entry.metadataJson && Object.keys(entry.metadataJson).length > 0;

  return (
    <>
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
                  {hasMetadata(entry) ? (
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="text-sm text-emerald underline"
                    >
                      Details
                    </button>
                  ) : (
                    <span className="text-sage">—</span>
                  )}
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

      <DetailsModal
        open={selectedEntry !== null}
        title="Audit log entry"
        description={selectedEntry ? formatDateTime(selectedEntry.createdAt) : undefined}
        onClose={() => setSelectedEntry(null)}
      >
        {selectedEntry && (
          <div className="space-y-4">
            <DetailsGrid
              items={[
                { label: "Action", value: <span className="font-mono text-xs">{selectedEntry.action}</span> },
                {
                  label: "Target",
                  value: (
                    <span className="font-mono text-xs">
                      {selectedEntry.targetType}:{selectedEntry.targetId}
                    </span>
                  ),
                },
                ...(showActor
                  ? [
                      {
                        label: "Actor",
                        value: selectedEntry.actor
                          ? `${selectedEntry.actor.name} (${selectedEntry.actor.role})`
                          : "—",
                      },
                    ]
                  : []),
              ]}
            />
            <div>
              <div className="text-sage text-xs uppercase tracking-wide mb-1">Metadata</div>
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-emerald/5 border border-emerald/20 px-3 py-2 text-xs font-mono">
                {JSON.stringify(selectedEntry.metadataJson, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DetailsModal>
    </>
  );
}
