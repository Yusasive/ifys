"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  createVipGuest,
  deleteVipGuest,
  fetchVipGuests,
  updateVipGuest,
  VipGuest,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";

const INPUT_CLASS =
  "border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors";

type GuestForm = {
  id: string | null;
  fullName: string;
  title: string;
  organization: string;
  displayOrder: number;
};

// VIP guests aren't registrants, so like the organising team they're
// entered here by hand.
export function VipPanel({
  eventSlug,
  onChange,
}: {
  eventSlug: string;
  onChange: () => void;
}) {
  const toast = useToast();
  const [guests, setGuests] = useState<VipGuest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState<GuestForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVipGuests(eventSlug)
      .then((data) => {
        if (cancelled) return;
        setGuests(data);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load VIP guests.");
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    try {
      const input = {
        fullName: form.fullName,
        title: form.title,
        organization: form.organization,
        displayOrder: form.displayOrder,
      };
      if (form.id) {
        await updateVipGuest(form.id, input);
        toast.success(`${form.fullName} updated.`);
      } else {
        await createVipGuest({ ...input, eventSlug });
        toast.success(`${form.fullName} added.`);
      }
      setForm(null);
      changed();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to save VIP guest.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(guest: VipGuest) {
    setDeleting(true);
    try {
      await deleteVipGuest(guest.id);
      toast.success(`${guest.fullName} removed.`);
      setDeleteConfirm(null);
      changed();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to delete VIP guest.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="border border-emerald/20 rounded-2xl bg-white p-4 shadow-sm mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bricolage font-bold text-lg text-forest">VIP guests</h2>
        <button
          onClick={() =>
            setForm({ id: null, fullName: "", title: "", organization: "", displayOrder: guests.length })
          }
          className="text-sm font-semibold text-coral-deep hover:underline"
        >
          + Add VIP
        </button>
      </div>
      {loaded && guests.length === 0 && <p className="text-sm text-sage">No VIP guests yet.</p>}
      <ul className="divide-y divide-emerald/10 max-h-72 overflow-y-auto">
        {guests.map((guest) => {
          const details = [guest.title, guest.organization].filter(Boolean).join(", ");
          return (
            <li key={guest.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">
                {guest.fullName} {details && <span className="text-xs text-sage">· {details}</span>}
              </span>
              {deleteConfirm === guest.id ? (
                <span className="inline-flex items-center gap-2">
                  <button
                    disabled={deleting}
                    onClick={() => void handleDelete(guest)}
                    className="bg-coral-deep text-white px-3 py-1 rounded-full text-xs hover:bg-gold-deep transition-colors disabled:opacity-50"
                  >
                    Confirm delete
                  </button>
                  <button onClick={() => setDeleteConfirm(null)} className="text-xs text-sage">
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="whitespace-nowrap">
                  <button
                    onClick={() =>
                      setForm({
                        id: guest.id,
                        fullName: guest.fullName,
                        title: guest.title ?? "",
                        organization: guest.organization ?? "",
                        displayOrder: guest.displayOrder,
                      })
                    }
                    className="text-ink underline mr-3"
                  >
                    Edit
                  </button>
                  <button onClick={() => setDeleteConfirm(guest.id)} className="text-coral-deep underline">
                    Delete
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <FormModal
        open={form !== null}
        title={form?.id ? "Edit VIP guest" : "New VIP guest"}
        description={'Printed under the name as "Title, Organisation", above the VIP line. Leave either blank to omit it.'}
        onClose={() => setForm(null)}
      >
        {form && (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Full name (as it should appear on the tag)</span>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Dr. Aisha Bello"
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Title (optional)</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Director General"
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Organisation (optional)</span>
              <input
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                placeholder="e.g. SEC Nigeria"
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Display order</span>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : form.id ? "Save changes" : "Add VIP"}
              </button>
              <button type="button" onClick={() => setForm(null)} className="text-sm text-sage">
                Cancel
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </section>
  );
}
