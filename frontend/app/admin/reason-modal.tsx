"use client";

import { useState } from "react";

export interface ReasonModalProps {
  open: boolean;
  title: string;
  description?: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  requirePassword?: boolean;
  confirmLabel?: string;
  confirmTone?: "danger" | "default";
  busy?: boolean;
  onConfirm: (reason: string, password?: string) => void | Promise<void>;
  onCancel: () => void;
}

export function ReasonModal({
  open,
  title,
  description,
  reasonLabel = "Reason",
  reasonRequired = true,
  requirePassword = false,
  confirmLabel = "Confirm",
  confirmTone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setPassword("");
    }
  }

  if (!open) return null;

  const disabled =
    busy ||
    (reasonRequired && !reason.trim()) ||
    (requirePassword && !password);

  const confirmClasses =
    confirmTone === "danger"
      ? "bg-coral-deep text-white hover:bg-gold-deep"
      : "bg-emerald text-white hover:bg-forest";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reason-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg border border-emerald/20">
        <h2 id="reason-modal-title" className="font-bricolage font-bold text-lg text-forest mb-1">
          {title}
        </h2>
        {description && <p className="text-sm text-sage mb-4">{description}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-sage mb-1">
              {reasonLabel}
              {!reasonRequired && " (optional)"}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-emerald/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none"
              placeholder="Explain why…"
            />
          </div>

          {requirePassword && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-sage mb-1">
                Your password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-emerald/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
                placeholder="Re-enter your password"
              />
            </div>
          )}
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
            onClick={() => void onConfirm(reason.trim(), requirePassword ? password : undefined)}
            className={`px-4 py-2 rounded-full text-sm transition-colors disabled:opacity-50 ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
