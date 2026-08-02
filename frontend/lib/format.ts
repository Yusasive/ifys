export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatKobo(priceKobo: number, currency: string): string {
  const amount = priceKobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const CATEGORY_LABELS: Record<string, string> = {
  student: "Student",
  founder: "Founder / Entrepreneur",
  professional: "Working Professional",
};

export const TIER_LABELS: Record<string, string> = {
  standard: "Standard",
  premium: "Premium",
};
