"use client";

import { useEffect, useState } from "react";
import {
  approveSponsorApplication,
  listSponsorApplications,
  rejectSponsorApplication,
  SponsorApplication,
  SponsorApplicationStatus,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

const STATUS_LABEL: Record<SponsorApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_STYLE: Record<SponsorApplicationStatus, string> = {
  pending: "bg-gold/10 text-gold-deep",
  approved: "bg-emerald/10 text-emerald",
  rejected: "bg-coral/10 text-coral-deep",
};

export function ApplicantsTab() {
  const [applications, setApplications] = useState<SponsorApplication[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SponsorApplicationStatus | "all">(
    "pending",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { applications: list } = await listSponsorApplications(
          EVENT_SLUG,
          statusFilter === "all" ? undefined : statusFilter,
        );
        if (!cancelled) {
          setApplications(list);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof ApiError ? err.body.message : "Failed to load applicants.",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, reloadKey]);

  async function handleApprove(application: SponsorApplication) {
    setBusyId(application.id);
    try {
      await approveSponsorApplication(application.id);
      toast.success(`${application.organizationName} approved and added to the directory.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.body.message : "Failed to approve applicant.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(application: SponsorApplication) {
    setBusyId(application.id);
    try {
      await rejectSponsorApplication(application.id);
      toast.success(`${application.organizationName} rejected.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.body.message : "Failed to reject applicant.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-sage">Status</span>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as SponsorApplicationStatus | "all")
          }
          className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="border border-emerald/20 rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2">Logo</th>
              <th className="px-4 py-2">Organization</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Message</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <TableRowsSkeleton rows={3} cols={7} />}
            {loaded && applications.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sage">
                  No applicants here yet.
                </td>
              </tr>
            )}
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-emerald/20 last:border-0">
                <td className="px-4 py-2">
                  {application.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={application.logoUrl}
                      alt={application.organizationName}
                      className="w-10 h-10 rounded-lg object-contain bg-emerald/5"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-emerald/5" />
                  )}
                </td>
                <td className="px-4 py-2">{application.organizationName}</td>
                <td className="px-4 py-2 text-sage">
                  <div>{application.contactName}</div>
                  <div className="text-xs">{application.email}</div>
                  {application.phone && <div className="text-xs">{application.phone}</div>}
                </td>
                <td className="px-4 py-2 text-sage capitalize">{application.type}</td>
                <td className="px-4 py-2 text-sage max-w-[16rem] truncate" title={application.message ?? undefined}>
                  {application.message ?? "—"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full ${STATUS_STYLE[application.status]}`}
                  >
                    {STATUS_LABEL[application.status]}
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {application.status === "pending" ? (
                    <>
                      <button
                        disabled={busyId === application.id}
                        onClick={() => void handleApprove(application)}
                        className="text-sm text-emerald underline mr-3 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === application.id}
                        onClick={() => void handleReject(application)}
                        className="text-sm text-coral-deep underline disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-sage">
                      {application.reviewedAt
                        ? new Date(application.reviewedAt).toLocaleDateString()
                        : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
