"use client";

export function PendingConfirmation({ registrationId }: { registrationId: string }) {
  return (
    <div className="border border-gold-light rounded-sm px-6 py-10 bg-ink-2 text-center">
      <p className="font-mono text-xs tracking-widest text-gold-light uppercase mb-4">
        Registration received
      </p>
      <h2 className="font-display text-2xl italic text-paper mb-4">
        You&apos;re almost in.
      </h2>
      <p className="text-sm text-muted max-w-sm mx-auto mb-6">
        Your registration is saved and awaiting payment. Payment isn&apos;t live yet —
        we&apos;ll follow up with next steps by email.
      </p>
      <p className="font-mono text-xs text-muted">
        Reference: {registrationId}
      </p>
    </div>
  );
}
