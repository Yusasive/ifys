"use client";

import { Fragment, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  createSpeaker,
  deleteSpeaker,
  listAdminSpeakers,
  requestSpeakerPhotoUploadUrl,
  updateSpeaker,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError, Speaker } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";
import { PaginationFooter } from "../pagination-footer";
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";
const PAGE_SIZE = 50;

const EMPTY_FORM = {
  name: "",
  role: "",
  tag: "Speaker",
  bio: "",
  displayOrder: 0,
  isActive: true,
};

export default function AdminSpeakersPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [speakersLoaded, setSpeakersLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoKey, setPhotoKey] = useState<string | undefined>(undefined);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { speakers: list, total: listTotal } = await listAdminSpeakers(
          EVENT_SLUG,
          { page, pageSize: PAGE_SIZE },
        );
        if (!cancelled) {
          setSpeakers(list);
          setTotal(listTotal);
          setSpeakersLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof ApiError ? err.body.message : "Failed to load speakers.",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, page, reloadKey]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPhotoKey(undefined);
    setFormOpen(true);
  }

  function startEdit(speaker: Speaker) {
    setEditingId(speaker.id);
    setForm({
      name: speaker.name,
      role: speaker.role,
      tag: speaker.tag,
      bio: speaker.bio ?? "",
      displayOrder: speaker.displayOrder,
      isActive: speaker.isActive,
    });
    setPhotoKey(undefined);
    setFormOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPhotoKey(undefined);
    setFormOpen(false);
  }

  async function handlePhotoChange(file: File) {
    if (!session) return;
    setPhotoUploading(true);
    try {
      const { key, uploadUrl } = await requestSpeakerPhotoUploadUrl(
        file.name,
        file.type,
      );
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      setPhotoKey(key);
    } catch {
      toast.error("Photo upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      const input = {
        name: form.name,
        role: form.role,
        tag: form.tag,
        bio: form.bio || undefined,
        displayOrder: form.displayOrder,
        isActive: form.isActive,
        ...(photoKey ? { photoKey } : {}),
      };
      if (editingId) {
        await updateSpeaker(editingId, input);
        toast.success(`${form.name} updated.`);
      } else {
        await createSpeaker({ ...input, eventSlug: EVENT_SLUG });
        toast.success(`${form.name} added.`);
      }
      resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.body.message
          : `Failed to ${editingId ? "update" : "create"} speaker.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(speaker: Speaker) {
    if (!session) return;
    setDeleting(true);
    try {
      await deleteSpeaker(speaker.id);
      toast.success(`${speaker.name} removed.`);
      setDeleteConfirmId(null);
      if (editingId === speaker.id) resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.body.message : "Failed to delete speaker.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || !session) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest">Speakers</h1>
        <button
          onClick={startCreate}
          className="bg-coral text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-coral-deep transition-colors"
        >
          + Add speaker
        </button>
      </div>

      <FormModal open={formOpen} title={editingId ? "Edit speaker" : "New speaker"} onClose={resetForm}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Role</span>
            <input
              required
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Tag</span>
            <input
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              placeholder="e.g. Keynote Speaker"
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Display order</span>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) =>
                setForm({ ...form, displayOrder: Number(e.target.value) })
              }
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-sage">
            Bio{" "}
            <span className="text-xs text-sage/70">
              (shown on the speaker&apos;s dedicated page exactly as typed)
            </span>
          </span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={6}
            className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
          />
        </label>

        {form.bio && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-sage">Preview</span>
            <div className="border border-emerald/20 rounded-xl px-3 py-2 bg-emerald/5">
              <p className="whitespace-pre-wrap text-sm text-ink">{form.bio}</p>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm text-sage">Photo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handlePhotoChange(file);
            }}
            className="text-sm text-emerald file:mr-3 file:rounded-full file:border file:border-emerald/20 file:bg-emerald/5 file:px-3 file:py-1.5 file:text-emerald"
          />
          {photoUploading && (
            <span className="text-sm text-sage">Uploading…</span>
          )}
          {photoKey && !photoUploading && (
            <span className="text-sm text-gold-deep">Photo uploaded.</span>
          )}
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-emerald"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span className="text-sm text-sage">Visible on public site</span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || photoUploading}
            className="self-start bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            {submitting
              ? editingId
                ? "Saving…"
                : "Adding…"
              : editingId
                ? "Save changes"
                : "Add speaker"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="text-sm text-sage"
          >
            Cancel
          </button>
        </div>
      </form>
      </FormModal>

      <div className="border border-emerald/20 rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2">Photo</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Tag</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!speakersLoaded && <TableRowsSkeleton rows={3} cols={7} />}
            {speakers.map((speaker) => (
              <Fragment key={speaker.id}>
                <tr className="border-b border-emerald/20 last:border-0">
                  <td className="px-4 py-2">
                    {speaker.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={speaker.photoUrl}
                        alt={speaker.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald/5" />
                    )}
                  </td>
                  <td className="px-4 py-2">{speaker.name}</td>
                  <td className="px-4 py-2 text-sage">{speaker.role}</td>
                  <td className="px-4 py-2 text-sage">{speaker.tag}</td>
                  <td className="px-4 py-2">{speaker.displayOrder}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full ${
                        speaker.isActive
                          ? "bg-emerald/10 text-emerald"
                          : "bg-emerald/5 text-sage"
                      }`}
                    >
                      {speaker.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(speaker)}
                      className="text-sm text-ink underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(speaker.id)}
                      className="text-sm text-coral-deep underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {deleteConfirmId === speaker.id && (
                  <tr className="border-b border-emerald/20 last:border-0">
                    <td colSpan={7} className="px-4 py-3 bg-coral/10">
                      <div className="flex items-center gap-3">
                        <p className="text-sm">
                          Delete {speaker.name}? This cannot be undone.
                        </p>
                        <button
                          disabled={deleting}
                          onClick={() => void handleDelete(speaker)}
                          className="bg-coral-deep text-white px-3 py-1 rounded-full text-sm hover:bg-gold-deep transition-colors disabled:opacity-50"
                        >
                          Confirm delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-sm text-sage"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationFooter page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </main>
  );
}
