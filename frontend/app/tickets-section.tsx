import Link from "next/link";
import type { TicketProduct } from "@/lib/api";
import { formatKobo } from "@/lib/format";

const LABELS: Record<string, string> = {
  student: "Students",
  regular: "Regular",
  professional: "Professionals / Founders",
};
const TONES: Record<string, "forest" | "salmon" | "rust"> = {
  student: "forest",
  regular: "salmon",
  professional: "rust",
};
const ORDER: Record<string, number> = { student: 0, regular: 1, professional: 2 };

const TONE_STYLES = {
  forest: { header: "bg-forest", border: "border-forest", text: "text-forest" },
  salmon: { header: "bg-salmon", border: "border-salmon", text: "text-salmon" },
  rust: { header: "bg-rust", border: "border-rust", text: "text-rust" },
};

function isEarlyBirdActive(product: TicketProduct): boolean {
  return (
    !!product.discountPercent &&
    !!product.discountExpiresAt &&
    new Date(product.discountExpiresAt).getTime() > Date.now()
  );
}

function cardNote(product: TicketProduct): string | null {
  if (product.cardNote) return product.cardNote;
  if (isEarlyBirdActive(product)) {
    return `*${product.discountPercent}% discount for early birds`;
  }
  return null;
}

export function TicketsSection({ ticketProducts }: { ticketProducts: TicketProduct[] }) {
  const tickets = ticketProducts
    .filter((p) => p.category in LABELS && p.tier === "standard" && p.isActive)
    .sort((a, b) => ORDER[a.category] - ORDER[b.category]);

  if (tickets.length === 0) return null;

  return (
    <section id="tickets" className="bg-islamic-pattern">
      <div className="mx-auto px-4 sm:px-6 py-10 lg:py-16">
        <p className="font-plex font-normal text-sm sm:text-base tracking-[0.15em] text-rust uppercase mb-4 text-center">
          Tickets
        </p>
        <h2 className="font-bricolage font-medium text-xl lg:text-[40px] leading-[1.2] sm:leading-[60px] tracking-normal text-black text-center mb-10 sm:mb-12">
          Register for the Islamic Finance Youth Summit
        </h2>

        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          {tickets.map((product) => {
            const tone = TONE_STYLES[TONES[product.category]];
            const note = cardNote(product);
            return (
              <div key={product.id} className={`rounded-2xl border ${tone.border} bg-white overflow-hidden`}>
                <div className={`${tone.header} py-4 text-center`}>
                  <p className="font-bricolage font-bold text-lg sm:text-xl uppercase tracking-wide text-white">
                    {LABELS[product.category]}
                  </p>
                </div>
                <div className="px-8 py-8 sm:py-10 text-center">
                  <p className={`font-bricolage font-bold text-4xl sm:text-5xl ${tone.text} mb-6`}>
                    {product.cardPriceLabel ?? formatKobo(product.priceKobo, product.currency)}
                  </p>
                  {note && <p className={`text-sm ${tone.text} opacity-80`}>{note}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <p className="font-bricolage font-medium text-base sm:text-lg text-forest text-center max-w-xl mx-auto mb-10">
          10% of all ticket proceeds will be channelled towards supporting charity projects in
          Nigeria and humanitarian relief efforts in Palestine.
        </p>

        <div className="text-center">
          <Link
            href="/register"
            className="inline-block bg-coral text-white font-semibold text-base px-16 py-3 rounded-full hover:bg-coral-deep transition-colors"
          >
            Get Tickets
          </Link>
        </div>
      </div>
    </section>
  );
}
