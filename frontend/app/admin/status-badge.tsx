const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald/10 text-emerald border-emerald/30",
  pending_payment: "bg-gold/10 text-gold border-gold/30",
  draft: "bg-line/30 text-muted border-line",
  failed: "bg-rust/10 text-rust border-rust/30",
  refunded: "bg-rust/10 text-rust border-rust/30",
  cancelled: "bg-line/30 text-muted border-line",
  unused: "bg-emerald/10 text-emerald border-emerald/30",
  used: "bg-line/30 text-muted border-line",
  void: "bg-rust/10 text-rust border-rust/30",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-line/30 text-muted border-line";
  return (
    <span
      className={`inline-block text-xs font-mono px-2.5 py-0.5 rounded-full border ${style}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
