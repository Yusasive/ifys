"use client";

import { useState } from "react";

export interface ChangeEmailModalProps {
  open: boolean;
  currentEmail: string;
  busy?: boolean;
  onConfirm: (email: string, reason: string) => void | Promise<void>;
  onCancel: () => void;
}

// Same look as ReasonModal, plus the new-address field. Resets on every
// closed -> open transition so a previous attempt never leaks in.
export function ChangeEmailModal({
  open,
  currentEmail,
  busy = false,
  onConfirm,
  onCancel,
}: ChangeEmailModalProps) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setEmail("");
      setReason("");
    }
  }

  if (!open) return null;

  const trimmed = email.trim();
  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const disabled = busy || !looksValid || !reason.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-email-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg border border-emerald/20">
        <h2 id="change-email-modal-title" className="font-bricolage font-bold text-lg text-forest mb-1">
          Change email
        </h2>
        <p className="text-sm text-sage mb-4">
          Currently <span className="font-mono">{currentEmail}</span>. This only changes this registration — nothing is
          emailed until you click Resend ticket.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-sage mb-1">New email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              autoFocus
              className="w-full border border-emerald/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-sage mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-emerald/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none"
              placeholder="e.g. original address doesn't receive mail — confirmed with buyer"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm text-sage px-4 py-2 rounded-full hover:bg-emerald/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onConfirm(trimmed, reason.trim())}
            className="px-4 py-2 rounded-full text-sm transition-colors disabled:opacity-50 bg-emerald text-white hover:bg-forest"
          >
            Save email
          </button>
        </div>
      </div>
    </div>
  );
}
