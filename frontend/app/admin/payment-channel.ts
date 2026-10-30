const LABELS: Record<string, string> = {
  card: "Card",
  bank_transfer: "Bank transfer",
  bank: "Bank",
  ussd: "USSD",
  qr: "QR",
  mobile_money: "Mobile money",
  eft: "EFT",
  apple_pay: "Apple Pay",
  free: "Free (coupon)",
  manual: "Manual (admin)",
};

export function paymentChannelLabel(channel: string | null | undefined): string {
  if (!channel) return "—";
  return LABELS[channel] ?? channel;
}
