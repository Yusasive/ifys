import Link from "next/link";

const TICKETS = [
  { label: "Students", price: "₦5,000" },
  { label: "Professionals", price: "₦10,000" },
];

export function TicketsSection() {
  return (
    <section id="tickets" className="bg-islamic-pattern">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-mono text-sm font-semibold tracking-widest text-coral-deep uppercase mb-3 text-center">
          Tickets
        </p>
        <h2 className="font-display text-3xl sm:text-4xl text-emerald text-center mb-12">
          Register for the Islamic Finance Youth Summit
        </h2>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {TICKETS.map((ticket) => (
            <div
              key={ticket.label}
              className="border border-line rounded-md p-8 text-center hover:border-coral transition-colors"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald/60 mb-3">
                {ticket.label}
              </p>
              <p className="font-display text-4xl text-coral-deep mb-3">{ticket.price}</p>
              <p className="text-xs text-emerald/50">*30% discount for early birds</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-emerald/60 text-center max-w-xl mx-auto mb-8">
          10% of all ticket proceeds will be channeled towards supporting charity projects in
          Nigeria and humanitarian relief efforts in Palestine.
        </p>

        <div className="text-center">
          <Link
            href="/register"
            className="inline-block bg-coral text-white font-semibold text-base px-10 py-3.5 rounded-sm hover:bg-coral-deep transition-colors"
          >
            Get Tickets
          </Link>
        </div>
      </div>
    </section>
  );
}
