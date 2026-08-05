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
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

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
  const [speakersLoaded, setSpeakersLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
        const { speakers: list } = await listAdminSpeakers(EVENT_SLUG);
        if (!cancelled) {
          setSpeakers(list);
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
  }, [session, reloadKey]);

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
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPhotoKey(undefined);
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

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-line rounded-sm px-3 py-1.5 text-sm text-ink hover:bg-paper-2 mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-display text-2xl mb-6">Speakers</h1>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border border-line rounded-sm bg-white p-6 mb-8 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Role</span>
            <input
              required
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Tag</span>
            <input
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              placeholder="e.g. Keynote Speaker"
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Display order</span>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) =>
                setForm({ ...form, displayOrder: Number(e.target.value) })
              }
              className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Bio</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Photo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handlePhotoChange(file);
            }}
            className="text-sm text-emerald file:mr-3 file:rounded-sm file:border file:border-line file:bg-cloud file:px-3 file:py-1.5 file:text-emerald"
          />
          {photoUploading && (
            <span className="text-sm text-muted">Uploading…</span>
          )}
          {photoKey && !photoUploading && (
            <span className="text-sm text-gold-deep">Photo uploaded.</span>
          )}
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span className="text-sm text-muted">Visible on public site</span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || photoUploading}
            className="self-start bg-ink text-paper font-medium px-6 py-2 rounded-sm disabled:opacity-50"
          >
            {submitting
              ? editingId
                ? "Saving…"
                : "Adding…"
              : editingId
                ? "Save changes"
                : "Add speaker"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-muted"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="border border-line rounded-sm bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
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
                <tr className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    {speaker.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={speaker.photoUrl}
                        alt={speaker.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-paper-2" />
                    )}
                  </td>
                  <td className="px-4 py-2">{speaker.name}</td>
                  <td className="px-4 py-2 text-muted">{speaker.role}</td>
                  <td className="px-4 py-2 text-muted">{speaker.tag}</td>
                  <td className="px-4 py-2">{speaker.displayOrder}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-sm ${
                        speaker.isActive
                          ? "bg-emerald/10 text-emerald"
                          : "bg-paper-2 text-muted"
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
                      className="text-sm text-red-700 underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {deleteConfirmId === speaker.id && (
                  <tr className="border-b border-line last:border-0">
                    <td colSpan={7} className="px-4 py-3 bg-red-50">
                      <div className="flex items-center gap-3">
                        <p className="text-sm">
                          Delete {speaker.name}? This cannot be undone.
                        </p>
                        <button
                          disabled={deleting}
                          onClick={() => void handleDelete(speaker)}
                          className="bg-red-700 text-white px-3 py-1 rounded-sm text-sm disabled:opacity-50"
                        >
                          Confirm delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-sm text-muted"
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
    </main>
  );
}
