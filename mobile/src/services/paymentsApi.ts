// Backend client for club payments — a member's invoices (dues, green fees,
// competition entries, levies) and starting a payment (PayFast hosted checkout
// or EFT banking details). Scoped to the app's club flavour via CLUB.

import { API_BASE } from "./api";
import { CLUB } from "../config/appVariant";

export type Invoice = {
  id: string;
  number: string;
  type: "dues" | "green_fee" | "comp_entry" | "levy";
  description: string;
  amountCents: number;
  status: "unpaid" | "paid" | "cancelled" | "refunded";
  dueAt: string | null;
  paidAt: string | null;
  payerName: string;
  createdAt: string;
};

export type MyInvoices = { invoices: Invoice[]; outstandingCents: number };

export type PayConfig = { mode: "payfast" | "manual"; currency: string; banking: string | null };

export type CheckoutResult =
  | { mode: "payfast"; url: string }
  | { mode: "manual"; banking: string | null; reference: string; amountCents: number; currency: string };

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Request failed (${res.status})`);
  return body as T;
}

const CK = () => CLUB || "kempton";

export const paymentsApi = {
  config: () => j<PayConfig>(`/payments/${CK()}/config`),
  mine: (memberId: string) => j<MyInvoices>(`/payments/${CK()}/mine?memberId=${encodeURIComponent(memberId)}`),
  checkout: (invoiceId: string) =>
    j<CheckoutResult>(`/payments/${CK()}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    }),
};

// Format cents in the club currency for display (e.g. 15000 → "R150.00").
export function money(cents: number, currency = "ZAR"): string {
  const symbol = currency === "ZAR" ? "R" : `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export const INVOICE_LABEL: Record<Invoice["type"], string> = {
  dues: "Membership",
  green_fee: "Green fee",
  comp_entry: "Competition",
  levy: "Levy",
};
