// PayFast — South Africa's hosted payment gateway (card + Instant EFT).
//
// The whole payments module is provider-agnostic: if PayFast credentials are
// present in the environment we run in "payfast" mode (hosted checkout + ITN
// webhook); if not, the module runs in "manual" mode (EFT — the office marks
// invoices paid). So a club can pilot on EFT today and turn on card payments
// later just by setting these env vars — no code change:
//
//   PAYFAST_MERCHANT_ID   (required)
//   PAYFAST_MERCHANT_KEY  (required)
//   PAYFAST_PASSPHRASE    (optional but strongly recommended)
//   PAYFAST_SANDBOX=true  (use the sandbox host while testing)
//
// Docs: https://developers.payfast.co.za/docs (signature + ITN).

import crypto from "crypto";

export type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  sandbox: boolean;
};

export function payfastConfig(): PayfastConfig | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) return null;
  return {
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE || undefined,
    sandbox:
      String(process.env.PAYFAST_SANDBOX ?? "").toLowerCase() === "true" ||
      String(process.env.PAYFAST_MODE ?? "").toLowerCase() === "sandbox",
  };
}

export function payfastEnabled(): boolean {
  return payfastConfig() !== null;
}

function host(sandbox: boolean): string {
  return sandbox ? "sandbox.payfast.co.za" : "www.payfast.co.za";
}

// PHP urlencode() — spaces become "+", unreserved set is A-Za-z0-9-_. and
// everything else is upper-case percent-encoded. PayFast signs with this exact
// encoding, so we must match it byte for byte.
function pfEncode(v: string): string {
  return encodeURIComponent(v)
    .replace(/%20/g, "+")
    .replace(/[!*'()~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// MD5 signature over the fields in their given order (insertion order of the
// object), with the passphrase appended last when set.
function signature(params: Record<string, string>, passphrase?: string): string {
  const parts: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${k}=${pfEncode(String(v).trim())}`);
  }
  let str = parts.join("&");
  if (passphrase) str += `&passphrase=${pfEncode(passphrase.trim())}`;
  return crypto.createHash("md5").update(str).digest("hex");
}

// Build a signed redirect URL to PayFast's hosted checkout. The app opens this
// in the phone browser; on completion PayFast redirects to returnUrl and, out
// of band, POSTs the ITN to notifyUrl (see verifyItn).
export function buildCheckoutUrl(opts: {
  amountCents: number;
  itemName: string;
  mPaymentId: string; // our invoice number — echoed back in the ITN
  nameFirst?: string;
  nameLast?: string;
  email?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): string | null {
  const cfg = payfastConfig();
  if (!cfg) return null;

  // Order matters: the query string and the signature must use the same order.
  const params: Record<string, string> = {
    merchant_id: cfg.merchantId,
    merchant_key: cfg.merchantKey,
    return_url: opts.returnUrl,
    cancel_url: opts.cancelUrl,
    notify_url: opts.notifyUrl,
  };
  if (opts.nameFirst) params.name_first = opts.nameFirst.slice(0, 100);
  if (opts.nameLast) params.name_last = opts.nameLast.slice(0, 100);
  if (opts.email) params.email_address = opts.email.slice(0, 100);
  params.m_payment_id = opts.mPaymentId.slice(0, 100);
  params.amount = (opts.amountCents / 100).toFixed(2);
  params.item_name = opts.itemName.slice(0, 100);

  const sig = signature(params, cfg.passphrase);
  const query = Object.keys(params)
    .map((k) => `${k}=${pfEncode(params[k])}`)
    .join("&");
  return `https://${host(cfg.sandbox)}/eng/process?${query}&signature=${sig}`;
}

// Verify the signature on an inbound ITN body (form-encoded fields). This is the
// primary integrity check; combine with an amount check at the call site.
export function verifyItnSignature(body: Record<string, any>): boolean {
  const cfg = payfastConfig();
  if (!cfg) return false;
  const received = body.signature ? String(body.signature) : "";
  if (!received) return false;
  const params: Record<string, string> = {};
  for (const k of Object.keys(body)) {
    if (k === "signature") continue;
    params[k] = String(body[k]);
  }
  return signature(params, cfg.passphrase) === received;
}

// Server-to-server postback: ask PayFast to confirm the ITN is genuine. Best
// practice on top of the signature check. Returns true only on an explicit
// "VALID" reply; on any network/other error returns null so the caller can
// decide (we accept on signature + amount when the postback can't be reached).
export async function validateItnPostback(rawBody: string): Promise<boolean | null> {
  const cfg = payfastConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`https://${host(cfg.sandbox)}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    return text === "VALID";
  } catch {
    return null; // unreachable — let the caller fall back to signature + amount
  }
}
