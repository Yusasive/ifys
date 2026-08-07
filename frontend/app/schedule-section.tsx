"use client";

import { useState } from "react";

export function ScheduleSection() {
  const [open, setOpen] = useState(false);

  return (
    <section id="schedule" className="bg-white">
      <div className="max-w-3xl mx-auto py-10 lg:py-2 px-4 sm:px-6  text-center">
        <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-rust uppercase mb-8">
          Program Schedule
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-block bg-coral text-white font-semibold text-base sm:text-lg px-10 py-3.5 rounded-full hover:bg-coral-deep transition-colors"
        >
          View Agenda
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-[20px] max-w-sm w-full p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="agenda-dialog-title"
              className="font-display text-2xl text-emerald mb-3"
            >
              Agenda coming soon
            </h2>
            <p className="text-base text-emerald/70 mb-6">
              Information about the agenda will be updated soon. Check back
              closer to the event.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-coral text-white font-semibold text-base px-8 py-3.5 rounded-full hover:bg-coral-deep transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
