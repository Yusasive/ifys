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
  regular: "Regular",
  // Retired — kept only so historical registrations display correctly.
  founder: "Founder / Entrepreneur",
  professional: "Professional / Founders / Entrepreneurs",
};

export const TIER_LABELS: Record<string, string> = {
  standard: "Standard",
  premium: "Premium",
};
