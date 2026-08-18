"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  approveVolunteerApplication,
  bulkApproveVolunteerApplications,
  bulkRejectVolunteerApplications,
  listVolunteerApplications,
  rejectVolunteerApplication,
  VolunteerApplication,
  VolunteerApplicationStatus,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError, VOLUNTEER_TEAMS } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { DetailsGrid, DetailsModal } from "../details-modal";
import { PaginationFooter } from "../pagination-footer";
import { PauseToggle } from "../pause-toggle";
import { ReasonModal } from "../reason-modal";
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";
const PAGE_SIZE = 20;

const TEAM_LABELS: Record<string, string> = Object.fromEntries(
  VOLUNTEER_TEAMS.map((t) => [t.value, t.label]),
);

const STATUS_LABEL: Record<VolunteerApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_STYLE: Record<VolunteerApplicationStatus, string> = {
  pending: "bg-gold/10 text-gold-deep",
  approved: "bg-emerald/10 text-emerald",
  rejected: "bg-coral/10 text-coral-deep",
};

export default function AdminVolunteersPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [applications, setApplications] = useState<VolunteerApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<VolunteerApplicationStatus | "all">(
    "pending",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [detailsApplication, setDetailsApplication] = useState<VolunteerApplication | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [modalTarget, setModalTarget] = useState<
    | { scope: "single"; mode: "approve" | "reject"; application: VolunteerApplication }
    | { scope: "bulk"; mode: "approve" | "reject" }
    | null
  >(null);
  const [modalBusy, setModalBusy] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { applications: list, total: listTotal } = await listVolunteerApplications(
          EVENT_SLUG,
          {
            status: statusFilter === "all" ? undefined : statusFilter,
            page,
            pageSize: PAGE_SIZE,
          },
        );
        if (!cancelled) {
          setApplications(list);
          setTotal(listTotal);
          setLoaded(true);
          setSelectedIds(new Set());
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
  }, [session, statusFilter, page, reloadKey]);

  function toggleAllVisiblePending() {
    const pendingIds = applications
      .filter((a) => a.status === "pending")
      .map((a) => a.id);
    setSelectedIds((prev) => {
      const allSelected = pendingIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(pendingIds);
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleModalConfirm(reason: string) {
    if (!modalTarget || !session) return;
    setModalBusy(true);
    try {
      if (modalTarget.scope === "single") {
        const { application, mode } = modalTarget;
        setBusyId(application.id);
        if (mode === "approve") {
          await approveVolunteerApplication(application.id, reason || undefined);
          toast.success(`${application.fullName} approved.`);
        } else {
          await rejectVolunteerApplication(application.id, reason);
          toast.success(`${application.fullName} rejected.`);
        }
        setReloadKey((k) => k + 1);
      } else {
        const { mode } = modalTarget;
        setBulkBusy(true);
        const ids = Array.from(selectedIds);
        const nameById = new Map(applications.map((a) => [a.id, a.fullName]));
        const result =
          mode === "approve"
            ? await bulkApproveVolunteerApplications(ids, reason || undefined)
            : await bulkRejectVolunteerApplications(ids, reason);
        if (result.succeeded.length > 0) {
          toast.success(
            `${result.succeeded.length} applicant${result.succeeded.length === 1 ? "" : "s"} ${mode === "approve" ? "approved" : "rejected"}.`,
          );
        }
        if (result.failed.length > 0) {
          const names = result.failed
            .map((f) => nameById.get(f.id) ?? f.id)
            .join(", ");
          toast.error(`Failed for: ${names}`);
        }
        setSelectedIds(new Set());
        setReloadKey((k) => k + 1);
      }
      setModalTarget(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.body.message
          : `Failed to ${modalTarget.mode} applicant${modalTarget.scope === "bulk" ? "s" : ""}.`,
      );
    } finally {
      setModalBusy(false);
      setBusyId(null);
      setBulkBusy(false);
    }
  }

  if (authLoading || !session) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">Volunteer applicants</h1>

      <PauseToggle
        eventSlug={EVENT_SLUG}
        field="volunteerApplicationsPaused"
        label="Volunteer applications"
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-sage">Status</span>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as VolunteerApplicationStatus | "all");
          }}
          className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-gold/10 border border-gold/30 rounded-2xl px-4 py-2 flex items-center gap-3 mb-3 text-sm">
          <span>{selectedIds.size} selected</span>
          <button
            disabled={bulkBusy}
            onClick={() => setModalTarget({ scope: "bulk", mode: "approve" })}
            className="bg-emerald text-white px-4 py-1.5 rounded-full hover:bg-forest transition-colors disabled:opacity-50"
          >
            Approve selected
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => setModalTarget({ scope: "bulk", mode: "reject" })}
            className="bg-coral-deep text-white px-4 py-1.5 rounded-full hover:bg-gold-deep transition-colors disabled:opacity-50"
          >
            Reject selected
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-sage underline">
            Clear
          </button>
        </div>
      )}

      <div className="border border-emerald/20 rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  className="accent-emerald"
                  checked={
                    applications.some((a) => a.status === "pending") &&
                    applications
                      .filter((a) => a.status === "pending")
                      .every((a) => selectedIds.has(a.id))
                  }
                  onChange={toggleAllVisiblePending}
                  aria-label="Select all visible pending applicants"
                />
              </th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <TableRowsSkeleton rows={3} cols={6} />}
            {loaded && applications.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sage">
                  No applicants here yet.
                </td>
              </tr>
            )}
            {applications.map((application) => {
              const data = application.formDataJson;
              return (
                <tr key={application.id} className="border-b border-emerald/20 last:border-0">
                  <td className="px-4 py-2">
                    {application.status === "pending" && (
                      <input
                        type="checkbox"
                        className="accent-emerald"
                        checked={selectedIds.has(application.id)}
                        onChange={() => toggleRow(application.id)}
                        aria-label={`Select ${application.fullName}`}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setDetailsApplication(application)}
                      className="text-ink underline"
                    >
                      {application.fullName}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-sage">
                    <div>{application.email}</div>
                    <div className="text-xs">{application.phone}</div>
                  </td>
                  <td className="px-4 py-2 text-sage">
                    {TEAM_LABELS[data.team] ?? data.team}
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
                          onClick={() =>
                            setModalTarget({ scope: "single", mode: "approve", application })
                          }
                          className="text-sm text-emerald underline mr-3 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === application.id}
                          onClick={() =>
                            setModalTarget({ scope: "single", mode: "reject", application })
                          }
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
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationFooter page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <ReasonModal
        open={modalTarget !== null}
        title={
          modalTarget?.mode === "approve"
            ? modalTarget.scope === "bulk"
              ? "Approve selected applications"
              : "Approve application"
            : modalTarget?.scope === "bulk"
              ? "Reject selected applications"
              : "Reject application"
        }
        description={
          modalTarget?.mode === "approve"
            ? "Optionally include next steps for the applicant. If left blank, a default congratulatory message is used."
            : "Let the applicant know why their application was not accepted."
        }
        reasonLabel={modalTarget?.mode === "approve" ? "Next steps (optional)" : "Reason"}
        reasonRequired={modalTarget?.mode === "reject"}
        confirmTone={modalTarget?.mode === "reject" ? "danger" : "default"}
        confirmLabel={modalTarget?.mode === "approve" ? "Approve" : "Reject"}
        busy={modalBusy}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalTarget(null)}
      />

      <DetailsModal
        open={detailsApplication !== null}
        title={detailsApplication?.fullName ?? "Applicant"}
        description={detailsApplication ? `${detailsApplication.email} · ${detailsApplication.phone}` : undefined}
        onClose={() => setDetailsApplication(null)}
      >
        {detailsApplication && (
          <DetailsGrid
            items={[
              {
                label: "Team",
                value: TEAM_LABELS[detailsApplication.formDataJson.team] ?? detailsApplication.formDataJson.team,
              },
              { label: "Location", value: detailsApplication.formDataJson.location },
              {
                label: "Willing to travel",
                value: <span className="capitalize">{detailsApplication.formDataJson.willingToTravel}</span>,
              },
              {
                label: "Occupational status",
                value: (
                  <span className="capitalize">
                    {detailsApplication.formDataJson.occupationalStatus.replace("_", " ")}
                    {detailsApplication.formDataJson.occupationalStatusOther
                      ? ` — ${detailsApplication.formDataJson.occupationalStatusOther}`
                      : ""}
                  </span>
                ),
              },
              {
                label: "Volunteered before",
                value: (
                  <>
                    {detailsApplication.formDataJson.volunteeredBefore ? "Yes" : "No"}
                    {detailsApplication.formDataJson.volunteeredAreas?.length
                      ? ` — ${detailsApplication.formDataJson.volunteeredAreas.join(", ")}`
                      : ""}
                  </>
                ),
              },
              {
                label: "Availability commitment",
                value: <span className="capitalize">{detailsApplication.formDataJson.availabilityCommitment}</span>,
              },
              { label: "Time commitment", value: detailsApplication.formDataJson.timeCommitment },
              { label: "About", value: detailsApplication.formDataJson.aboutYourself, fullWidth: true },
              {
                label: "Skills",
                value: [
                  ...detailsApplication.formDataJson.skills,
                  ...(detailsApplication.formDataJson.skillsOther
                    ? [detailsApplication.formDataJson.skillsOther]
                    : []),
                ].join(", "),
                fullWidth: true,
              },
              { label: "Why volunteer", value: detailsApplication.formDataJson.whyVolunteer, fullWidth: true },
              ...(detailsApplication.formDataJson.additionalComments
                ? [
                    {
                      label: "Additional comments",
                      value: detailsApplication.formDataJson.additionalComments,
                      fullWidth: true,
                    },
                  ]
                : []),
            ]}
          />
        )}
      </DetailsModal>
    </main>
  );
}
