"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CommitteeMember,
  CommitteePosition,
  createCommitteeMember,
  createCommitteePosition,
  deleteCommitteeMember,
  deleteCommitteePosition,
  fetchCommittee,
  updateCommitteeMember,
  updateCommitteePosition,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";

const INPUT_CLASS =
  "border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors";

type PositionForm = { id: string | null; name: string; displayOrder: number };
type MemberForm = { id: string | null; fullName: string; positionId: string };

// The organising committee isn't in the database as registrants, so its
// members (and the positions printed on their tags) are entered here.
export function CommitteePanel({
  eventSlug,
  onChange,
}: {
  eventSlug: string;
  onChange: () => void;
}) {
  const toast = useToast();
  const [positions, setPositions] = useState<CommitteePosition[]>([]);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [positionForm, setPositionForm] = useState<PositionForm | null>(null);
  const [memberForm, setMemberForm] = useState<MemberForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCommittee(eventSlug)
      .then((data) => {
        if (cancelled) return;
        setPositions(data.positions);
        setMembers(data.members);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load the committee.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug, reloadKey]);

  function changed() {
    setReloadKey((k) => k + 1);
    onChange();
  }

  async function handlePositionSubmit(e: FormEvent) {
    e.preventDefault();
    if (!positionForm) return;
    setSubmitting(true);
    try {
      const input = { name: positionForm.name, displayOrder: positionForm.displayOrder };
      if (positionForm.id) {
        await updateCommitteePosition(positionForm.id, input);
        toast.success(`${positionForm.name} updated.`);
      } else {
        await createCommitteePosition({ ...input, eventSlug });
        toast.success(`${positionForm.name} added.`);
      }
      setPositionForm(null);
      changed();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to save position.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMemberSubmit(e: FormEvent) {
    e.preventDefault();
    if (!memberForm) return;
    setSubmitting(true);
    try {
      const input = { fullName: memberForm.fullName, positionId: memberForm.positionId };
      if (memberForm.id) {
        await updateCommitteeMember(memberForm.id, input);
        toast.success(`${memberForm.fullName} updated.`);
      } else {
        await createCommitteeMember({ ...input, eventSlug });
        toast.success(`${memberForm.fullName} added.`);
      }
      setMemberForm(null);
      changed();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to save member.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(kind: "position" | "member", id: string, name: string) {
    setDeleting(true);
    try {
      if (kind === "position") await deleteCommitteePosition(id);
      else await deleteCommitteeMember(id);
      toast.success(`${name} removed.`);
      setDeleteConfirm(null);
      changed();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : `Failed to delete ${kind}.`);
    } finally {
      setDeleting(false);
    }
  }

  function renderConfirmDelete(kind: "position" | "member", id: string, name: string) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          disabled={deleting}
          onClick={() => void handleDelete(kind, id, name)}
          className="bg-coral-deep text-white px-3 py-1 rounded-full text-xs hover:bg-gold-deep transition-colors disabled:opacity-50"
        >
          Confirm delete
        </button>
        <button onClick={() => setDeleteConfirm(null)} className="text-xs text-sage">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 mb-8">
      <div className="border border-emerald/20 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bricolage font-bold text-lg text-forest">Positions</h2>
          <button
            onClick={() => setPositionForm({ id: null, name: "", displayOrder: positions.length })}
            className="text-sm font-semibold text-coral-deep hover:underline"
          >
            + Add position
          </button>
        </div>
        {loaded && positions.length === 0 && (
          <p className="text-sm text-sage">Add a position such as &ldquo;Media Team&rdquo; before adding members.</p>
        )}
        <ul className="divide-y divide-emerald/10">
          {positions.map((position) => (
            <li key={position.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">
                {position.name}{" "}
                <span className="text-xs text-sage">
                  · {position.memberCount} member{position.memberCount === 1 ? "" : "s"}
                </span>
              </span>
              {deleteConfirm === position.id ? (
                renderConfirmDelete("position", position.id, position.name)
              ) : (
                <span className="whitespace-nowrap">
                  <button
                    onClick={() =>
                      setPositionForm({ id: position.id, name: position.name, displayOrder: position.displayOrder })
                    }
                    className="text-ink underline mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(position.id)}
                    disabled={position.memberCount > 0}
                    title={position.memberCount > 0 ? "Move or remove its members first" : undefined}
                    className="text-coral-deep underline disabled:opacity-40 disabled:no-underline"
                  >
                    Delete
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-emerald/20 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bricolage font-bold text-lg text-forest">Members</h2>
          <button
            disabled={positions.length === 0}
            onClick={() => setMemberForm({ id: null, fullName: "", positionId: positions[0]?.id ?? "" })}
            className="text-sm font-semibold text-coral-deep hover:underline disabled:opacity-40 disabled:no-underline"
          >
            + Add member
          </button>
        </div>
        {loaded && members.length === 0 && <p className="text-sm text-sage">No committee members yet.</p>}
        <ul className="divide-y divide-emerald/10 max-h-72 overflow-y-auto">
          {members.map((member) => (
            <li key={member.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">
                {member.fullName} <span className="text-xs text-sage">· {member.position.name}</span>
              </span>
              {deleteConfirm === member.id ? (
                renderConfirmDelete("member", member.id, member.fullName)
              ) : (
                <span className="whitespace-nowrap">
                  <button
                    onClick={() =>
                      setMemberForm({ id: member.id, fullName: member.fullName, positionId: member.positionId })
                    }
                    className="text-ink underline mr-3"
                  >
                    Edit
                  </button>
                  <button onClick={() => setDeleteConfirm(member.id)} className="text-coral-deep underline">
                    Delete
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <FormModal
        open={positionForm !== null}
        title={positionForm?.id ? "Edit position" : "New position"}
        description="Printed as the role on the member's name tag."
        onClose={() => setPositionForm(null)}
      >
        {positionForm && (
          <form onSubmit={(e) => void handlePositionSubmit(e)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Position</span>
              <input
                required
                value={positionForm.name}
                onChange={(e) => setPositionForm({ ...positionForm, name: e.target.value })}
                placeholder="e.g. Media Team"
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Display order</span>
              <input
                type="number"
                value={positionForm.displayOrder}
                onChange={(e) => setPositionForm({ ...positionForm, displayOrder: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : positionForm.id ? "Save changes" : "Add position"}
              </button>
              <button type="button" onClick={() => setPositionForm(null)} className="text-sm text-sage">
                Cancel
              </button>
            </div>
          </form>
        )}
      </FormModal>

      <FormModal
        open={memberForm !== null}
        title={memberForm?.id ? "Edit committee member" : "New committee member"}
        onClose={() => setMemberForm(null)}
      >
        {memberForm && (
          <form onSubmit={(e) => void handleMemberSubmit(e)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Full name (as it should appear on the tag)</span>
              <input
                required
                value={memberForm.fullName}
                onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Position</span>
              <select
                required
                value={memberForm.positionId}
                onChange={(e) => setMemberForm({ ...memberForm, positionId: e.target.value })}
                className={`${INPUT_CLASS} bg-white`}
              >
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : memberForm.id ? "Save changes" : "Add member"}
              </button>
              <button type="button" onClick={() => setMemberForm(null)} className="text-sm text-sage">
                Cancel
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </section>
  );
}
