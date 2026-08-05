"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  approveVolunteerApplication,
  listVolunteerApplications,
  rejectVolunteerApplication,
  VolunteerApplication,
  VolunteerApplicationStatus,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError, VOLUNTEER_TEAMS } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

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
  rejected: "bg-red-100 text-red-700",
};

export default function AdminVolunteersPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [applications, setApplications] = useState<VolunteerApplication[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<VolunteerApplicationStatus | "all">(
    "pending",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { applications: list } = await listVolunteerApplications(
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
  }, [session, statusFilter, reloadKey]);

  async function handleApprove(application: VolunteerApplication) {
    if (!session) return;
    setBusyId(application.id);
    try {
      await approveVolunteerApplication(application.id);
      toast.success(`${application.fullName} approved.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.body.message : "Failed to approve applicant.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(application: VolunteerApplication) {
    if (!session) return;
    setBusyId(application.id);
    try {
      await rejectVolunteerApplication(application.id);
      toast.success(`${application.fullName} rejected.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.body.message : "Failed to reject applicant.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || !session) return null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-line rounded-sm px-3 py-1.5 text-sm text-ink hover:bg-paper-2 mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-display text-2xl mb-6">Volunteer applicants</h1>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted">Status</span>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as VolunteerApplicationStatus | "all")
          }
          className="border border-line rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="border border-line rounded-sm bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <TableRowsSkeleton rows={3} cols={5} />}
            {loaded && applications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No applicants here yet.
                </td>
              </tr>
            )}
            {applications.map((application) => {
              const data = application.formDataJson;
              const expanded = expandedId === application.id;
              return (
                <Fragment key={application.id}>
                  <tr className="border-b border-line last:border-0">
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setExpandedId(expanded ? null : application.id)}
                        className="text-ink underline"
                      >
                        {application.fullName}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-muted">
                      <div>{application.email}</div>
                      <div className="text-xs">{application.phone}</div>
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {TEAM_LABELS[data.team] ?? data.team}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-sm ${STATUS_STYLE[application.status]}`}
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
                            className="text-sm text-red-700 underline disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-muted">
                          {application.reviewedAt
                            ? new Date(application.reviewedAt).toLocaleDateString()
                            : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-line last:border-0">
                      <td colSpan={5} className="px-4 py-4 bg-paper-2">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          <div>
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Location
                            </dt>
                            <dd>{data.location}</dd>
                          </div>
                          <div>
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Willing to travel
                            </dt>
                            <dd className="capitalize">{data.willingToTravel}</dd>
                          </div>
                          <div>
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Occupational status
                            </dt>
                            <dd className="capitalize">
                              {data.occupationalStatus.replace("_", " ")}
                              {data.occupationalStatusOther
                                ? ` — ${data.occupationalStatusOther}`
                                : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Volunteered before
                            </dt>
                            <dd>
                              {data.volunteeredBefore ? "Yes" : "No"}
                              {data.volunteeredAreas?.length
                                ? ` — ${data.volunteeredAreas.join(", ")}`
                                : ""}
                            </dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              About
                            </dt>
                            <dd>{data.aboutYourself}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Skills
                            </dt>
                            <dd>
                              {data.skills.join(", ")}
                              {data.skillsOther ? `, ${data.skillsOther}` : ""}
                            </dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Why volunteer
                            </dt>
                            <dd>{data.whyVolunteer}</dd>
                          </div>
                          <div>
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Availability commitment
                            </dt>
                            <dd className="capitalize">{data.availabilityCommitment}</dd>
                          </div>
                          <div>
                            <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                              Time commitment
                            </dt>
                            <dd>{data.timeCommitment}</dd>
                          </div>
                          {data.additionalComments && (
                            <div className="sm:col-span-2">
                              <dt className="text-muted text-xs uppercase tracking-wide mb-1">
                                Additional comments
                              </dt>
                              <dd>{data.additionalComments}</dd>
                            </div>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
