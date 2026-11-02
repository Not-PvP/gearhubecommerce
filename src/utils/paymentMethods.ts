export type CheckoutPaymentMethod = "cod" | "xendit";

const LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  xendit: "Online (Xendit)",
  card: "Card",
  gcash: "GCash",
};

export function getPaymentLabel(method: string): string {
  return LABELS[method] ?? method.toUpperCase();
}
