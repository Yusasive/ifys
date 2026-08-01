const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald/10 text-emerald border-emerald/30",
  pending_payment: "bg-gold/10 text-gold border-gold/30",
  draft: "bg-line/30 text-muted border-line",
  failed: "bg-red-100 text-red-700 border-red-300",
  refunded: "bg-red-100 text-red-700 border-red-300",
  cancelled: "bg-line/30 text-muted border-line",
  unused: "bg-emerald/10 text-emerald border-emerald/30",
  used: "bg-line/30 text-muted border-line",
  void: "bg-red-100 text-red-700 border-red-300",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-line/30 text-muted border-line";
  return (
    <span
      className={`inline-block text-xs font-mono px-2 py-0.5 rounded-sm border ${style}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
