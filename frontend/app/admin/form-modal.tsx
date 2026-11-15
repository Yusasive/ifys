"use client";

import { useEffect } from "react";

const WIDTH_CLASSES = {
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export interface FormModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  // "lg" for forms with a lot of horizontal content (e.g. a multi-column
  // permission grid) — defaults to "md" for a typical single-column form.
  size?: keyof typeof WIDTH_CLASSES;
}

export function FormModal({
  open,
  title,
  description,
  onClose,
  children,
  size = "md",
}: FormModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-modal-title"
      onClick={onClose}
    >
      <div
        className={`w-full ${WIDTH_CLASSES[size]} max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-lg border border-emerald/20`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-emerald/20">
          <div>
            <h2 id="form-modal-title" className="font-bricolage font-bold text-lg text-forest">
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
      </div>
    </div>
  );
}
