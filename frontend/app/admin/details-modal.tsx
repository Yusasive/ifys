"use client";

import { useEffect } from "react";

export interface DetailsModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function DetailsModal({ open, title, description, onClose, children }: DetailsModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-lg border border-emerald/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-emerald/20">
          <div>
            <h2 id="details-modal-title" className="font-bricolage font-bold text-lg text-forest">
              {title}
            </h2>
            {description && <p className="text-sm text-sage mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-sage hover:text-ink text-xl leading-none px-1"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">{children}</div>

        <div className="flex justify-end px-6 py-4 border-t border-emerald/20">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-sage px-4 py-2 rounded-full hover:bg-emerald/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function DetailsGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; fullWidth?: boolean }[];
}) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
      {items.map((item, i) => (
        <div key={i} className={item.fullWidth ? "sm:col-span-2" : undefined}>
          <dt className="text-sage text-xs uppercase tracking-wide mb-1">{item.label}</dt>
          <dd className="break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
