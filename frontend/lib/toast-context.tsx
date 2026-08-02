"use client";

import { createContext, useCallback, useContext, useState } from "react";

const TOAST_DISPLAY_MS = 4000;

type ToastKind = "success" | "error";

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), TOAST_DISPLAY_MS);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              t.kind === "success"
                ? "bg-white border border-line border-l-4 border-l-emerald rounded-sm px-4 py-3 shadow-sm text-sm flex items-start justify-between gap-3"
                : "bg-white border border-line border-l-4 border-l-red-700 rounded-sm px-4 py-3 shadow-sm text-sm flex items-start justify-between gap-3"
            }
          >
            <span className="text-ink">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-muted leading-none shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
