"use client";

import { Fragment, FormEvent, useEffect, useState } from "react";
import {
  createSponsor,
  deleteSponsor,
  listAdminSponsors,
  requestSponsorLogoUploadUrl,
  updateSponsor,
} from "@/lib/admin-api";
import { ApiError, Sponsor, SponsorType } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";
import { PaginationFooter } from "../pagination-footer";
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";
const PAGE_SIZE = 50;

const EMPTY_FORM = {
  type: "sponsor" as SponsorType,
  name: "",
  websiteUrl: "",
  displayOrder: 0,
  isActive: true,
};

export function DirectoryTab() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoKey, setLogoKey] = useState<string | undefined>(undefined);
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { sponsors: list, total: listTotal } = await listAdminSponsors(
          EVENT_SLUG,
          { page, pageSize: PAGE_SIZE },
        );
        if (!cancelled) {
          setSponsors(list);
          setTotal(listTotal);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof ApiError ? err.body.message : "Failed to load directory.",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reloadKey]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setLogoKey(undefined);
    setFormOpen(true);
  }

  function startEdit(sponsor: Sponsor) {
    setEditingId(sponsor.id);
    setForm({
      type: sponsor.type,
      name: sponsor.name,
      websiteUrl: sponsor.websiteUrl ?? "",
      displayOrder: sponsor.displayOrder,
      isActive: sponsor.isActive,
    });
    setLogoKey(undefined);
    setFormOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setLogoKey(undefined);
    setFormOpen(false);
  }

  async function handleLogoChange(file: File) {
    setLogoUploading(true);
    try {
      const { key, uploadUrl } = await requestSponsorLogoUploadUrl(
        file.name,
        file.type,
      );
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      setLogoKey(key);
    } catch {
      toast.error("Logo upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const input = {
        type: form.type,
        name: form.name,
        websiteUrl: form.websiteUrl || undefined,
        displayOrder: form.displayOrder,
        isActive: form.isActive,
        ...(logoKey ? { logoKey } : {}),
      };
      if (editingId) {
        await updateSponsor(editingId, input);
        toast.success(`${form.name} updated.`);
      } else {
        await createSponsor({ ...input, eventSlug: EVENT_SLUG });
        toast.success(`${form.name} added.`);
      }
      resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.body.message
          : `Failed to ${editingId ? "update" : "create"} entry.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(sponsor: Sponsor) {
    setDeleting(true);
    try {
      await deleteSponsor(sponsor.id);
      toast.success(`${sponsor.name} removed.`);
      setDeleteConfirmId(null);
      if (editingId === sponsor.id) resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.body.message : "Failed to delete entry.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={startCreate}
          className="bg-coral text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-coral-deep transition-colors"
        >
          + Add entry
        </button>
      </div>

      <FormModal open={formOpen} title={editingId ? "Edit entry" : "New entry"} onClose={resetForm}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Type</span>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as SponsorType })
              }
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            >
              <option value="sponsor">Sponsor</option>
              <option value="partner">Partner</option>
              <option value="exhibitor">Exhibitor</option>
            </select>
          </label>
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
            <span className="text-sm text-sage">Website URL</span>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              placeholder="https://"
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
          <span className="text-sm text-sage">Logo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleLogoChange(file);
            }}
            className="text-sm text-emerald file:mr-3 file:rounded-full file:border file:border-emerald/20 file:bg-emerald/5 file:px-3 file:py-1.5 file:text-emerald"
          />
          {logoUploading && <span className="text-sm text-sage">Uploading…</span>}
          {logoKey && !logoUploading && (
            <span className="text-sm text-gold-deep">Logo uploaded.</span>
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
            disabled={submitting || logoUploading}
            className="self-start bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            {submitting
              ? editingId
                ? "Saving…"
                : "Adding…"
              : editingId
                ? "Save changes"
                : "Add entry"}
          </button>
          <button type="button" onClick={resetForm} className="text-sm text-sage">
            Cancel
          </button>
        </div>
      </form>
      </FormModal>

      <div className="border border-emerald/20 rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2">Logo</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <TableRowsSkeleton rows={3} cols={6} />}
            {sponsors.map((sponsor) => (
              <Fragment key={sponsor.id}>
                <tr className="border-b border-emerald/20 last:border-0">
                  <td className="px-4 py-2">
                    {sponsor.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        className="w-10 h-10 rounded-lg object-contain bg-emerald/5"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald/5" />
                    )}
                  </td>
                  <td className="px-4 py-2">{sponsor.name}</td>
                  <td className="px-4 py-2 text-sage capitalize">{sponsor.type}</td>
                  <td className="px-4 py-2">{sponsor.displayOrder}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full ${
                        sponsor.isActive
                          ? "bg-emerald/10 text-emerald"
                          : "bg-emerald/5 text-sage"
                      }`}
                    >
                      {sponsor.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(sponsor)}
                      className="text-sm text-ink underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(sponsor.id)}
                      className="text-sm text-coral-deep underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {deleteConfirmId === sponsor.id && (
                  <tr className="border-b border-emerald/20 last:border-0">
                    <td colSpan={6} className="px-4 py-3 bg-coral/10">
                      <div className="flex items-center gap-3">
                        <p className="text-sm">
                          Delete {sponsor.name}? This cannot be undone.
                        </p>
                        <button
                          disabled={deleting}
                          onClick={() => void handleDelete(sponsor)}
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
    </>
  );
}
