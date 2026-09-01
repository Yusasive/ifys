const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald/10 text-emerald border-emerald/30",
  pending_payment: "bg-gold/10 text-gold border-gold/30",
  pending_review: "bg-gold/10 text-gold border-gold/30",
  draft: "bg-sage/15 text-sage border-emerald/20",
  failed: "bg-coral/10 text-coral-deep border-coral/30",
  refunded: "bg-coral/10 text-coral-deep border-coral/30",
  cancelled: "bg-sage/15 text-sage border-emerald/20",
  unused: "bg-emerald/10 text-emerald border-emerald/30",
  used: "bg-sage/15 text-sage border-emerald/20",
  void: "bg-coral/10 text-coral-deep border-coral/30",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-sage/15 text-sage border-emerald/20";
  return (
    <span
      className={`inline-block text-xs font-mono px-2.5 py-0.5 rounded-full border ${style}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
