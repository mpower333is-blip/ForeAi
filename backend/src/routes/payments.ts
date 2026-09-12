import { Router } from "express";
import express from "express";
import prisma from "../config/db";
import { requireAdmin } from "./club";
import { genInvoiceNumber } from "../lib/invoices";
import {
  payfastEnabled,
  buildCheckoutUrl,
  verifyItnSignature,
  validateItnPostback,
} from "../lib/payfast";

// Payments — dues, green fees, competition entries and levies.
//
//  • App-facing (no PIN): a member sees their own invoices, and starts a
//    payment (PayFast checkout URL, or EFT banking details + reference).
//  • Webhook (no PIN): PayFast ITN marks an invoice paid, verified by signature.
//  • Admin-facing (PIN): the price list (fees), raising invoices, marking paid,
//    and the annual dues run.
//
// Mode is automatic: "payfast" when PayFast env keys are set, else "manual"
// (EFT). Amounts are integer cents in ClubSettings.currency (default ZAR).

const router = Router();

async function settings(clubKey: string) {
  return (
    (await prisma.clubSettings.findUnique({ where: { clubKey } })) ?? {
      clubKey,
      adminPin: null as string | null,
      currency: "ZAR",
      bankingDetails: null as string | null,
      chargeGreenFeeOnBooking: false,
    }
  );
}

function publicBase(req: any): string {
  const env = process.env.PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  return `${req.protocol === "http" && req.get("host")?.includes("onrender") ? "https" : req.protocol}://${req.get("host")}`;
}

function invoiceView(inv: any) {
  return {
    id: inv.id,
    number: inv.number,
    type: inv.type,
    description: inv.description,
    amountCents: inv.amountCents,
    status: inv.status,
    dueAt: inv.dueAt,
    paidAt: inv.paidAt,
    payerName: inv.payerName,
    createdAt: inv.createdAt,
  };
}

// ---- App: mode / config ----------------------------------------------------

// What the payments screen needs to render: mode, currency, and (manual mode)
// the EFT banking block. PIN-safe.
router.get("/:clubKey/config", async (req, res) => {
  const s = await settings(req.params.clubKey);
  res.json({
    mode: payfastEnabled() ? "payfast" : "manual",
    currency: (s as any).currency ?? "ZAR",
    banking: (s as any).bankingDetails ?? null,
  });
});

// ---- App: a member's invoices ----------------------------------------------

router.get("/:clubKey/mine", async (req, res) => {
  const memberId = req.query.memberId ? String(req.query.memberId) : "";
  if (!memberId) return res.status(400).json({ error: "memberId required" });
  const invoices = await prisma.invoice.findMany({
    where: { clubKey: req.params.clubKey, memberId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const outstandingCents = invoices
    .filter((i) => i.status === "unpaid")
    .reduce((n, i) => n + i.amountCents, 0);
  res.json({ invoices: invoices.map(invoiceView), outstandingCents });
});

// ---- App: start a payment --------------------------------------------------

// POST /payments/:clubKey/checkout { invoiceId }
//   payfast mode → { mode:"payfast", url }   (open in the browser)
//   manual  mode → { mode:"manual", banking, reference, amountCents, currency }
router.post("/:clubKey/checkout", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  const invoiceId = req.body?.invoiceId ? String(req.body.invoiceId) : "";
  if (!invoiceId) return res.status(400).json({ error: "invoiceId required" });

  const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, clubKey } });
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  if (inv.status === "paid") return res.status(409).json({ error: "Already paid" });
  if (inv.status === "cancelled") return res.status(409).json({ error: "Invoice cancelled" });

  if (payfastEnabled()) {
    const base = publicBase(req);
    const [nameFirst, ...rest] = (inv.payerName || "").split(" ");
    const url = buildCheckoutUrl({
      amountCents: inv.amountCents,
      itemName: `${inv.description} (${inv.number})`,
      mPaymentId: inv.number,
      nameFirst,
      nameLast: rest.join(" ") || undefined,
      email: inv.payerEmail ?? undefined,
      returnUrl: `${base}/payments/${clubKey}/return`,
      cancelUrl: `${base}/payments/${clubKey}/cancel`,
      notifyUrl: `${base}/payments/${clubKey}/payfast/notify`,
    });
    if (!url) return res.status(500).json({ error: "Checkout unavailable" });
    return res.json({ mode: "payfast", url });
  }

  res.json({
    mode: "manual",
    banking: (s as any).bankingDetails ?? null,
    reference: inv.number,
    amountCents: inv.amountCents,
    currency: (s as any).currency ?? "ZAR",
  });
});

// ---- PayFast ITN webhook ---------------------------------------------------

// PayFast POSTs form-encoded data here after a payment. We verify the signature,
// (best-effort) confirm via server postback, check the amount, then mark paid.
// Must always reply 200 quickly so PayFast doesn't retry a handled notice.
router.post(
  "/:clubKey/payfast/notify",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    // Acknowledge immediately; process below. PayFast only needs a 200.
    res.status(200).send("OK");

    try {
      const clubKey = req.params.clubKey;
      const body = req.body ?? {};
      if (!payfastEnabled()) return;
      if (!verifyItnSignature(body)) {
        console.warn("[payfast] ITN signature mismatch", { clubKey, ref: body.m_payment_id });
        return;
      }

      // Best-effort server postback validation. If PayFast is unreachable we
      // fall back to signature + amount (postback returns null on error).
      const raw = Object.keys(body)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(body[k]))}`)
        .join("&");
      const postback = await validateItnPostback(raw);
      if (postback === false) {
        console.warn("[payfast] ITN postback returned INVALID", { ref: body.m_payment_id });
        return;
      }

      const number = String(body.m_payment_id ?? "");
      const inv = await prisma.invoice.findUnique({ where: { clubKey_number: { clubKey, number } } });
      if (!inv) {
        console.warn("[payfast] ITN for unknown invoice", { clubKey, number });
        return;
      }

      const grossCents = Math.round(parseFloat(String(body.amount_gross ?? "0")) * 100);
      if (Number.isFinite(grossCents) && Math.abs(grossCents - inv.amountCents) > 1) {
        console.warn("[payfast] ITN amount mismatch", { number, expected: inv.amountCents, got: grossCents });
        return;
      }

      const status = String(body.payment_status ?? "").toUpperCase();
      const pfRef = body.pf_payment_id ? String(body.pf_payment_id) : null;

      // Idempotent: skip if we've already recorded this PayFast payment.
      if (pfRef) {
        const seen = await prisma.payment.findFirst({ where: { providerRef: pfRef, provider: "payfast" } });
        if (seen) return;
      }

      if (status === "COMPLETE") {
        await prisma.$transaction([
          prisma.payment.create({
            data: {
              clubKey,
              invoiceId: inv.id,
              provider: "payfast",
              providerRef: pfRef,
              amountCents: grossCents || inv.amountCents,
              status: "completed",
              raw: body,
            },
          }),
          prisma.invoice.update({
            where: { id: inv.id },
            data: { status: "paid", paidAt: new Date() },
          }),
        ]);
      } else {
        await prisma.payment.create({
          data: {
            clubKey,
            invoiceId: inv.id,
            provider: "payfast",
            providerRef: pfRef,
            amountCents: grossCents || inv.amountCents,
            status: status === "CANCELLED" ? "failed" : "pending",
            note: status,
            raw: body,
          },
        });
      }
    } catch (e) {
      console.error("[payfast] ITN handler error", e);
    }
  },
);

// Browser landing pages PayFast redirects the payer to after checkout.
router.get("/:clubKey/return", (_req, res) => {
  res.set("Content-Type", "text/html").send(
    landing("Payment received", "Thank you — your payment is being confirmed. You can close this page and return to the app."),
  );
});
router.get("/:clubKey/cancel", (_req, res) => {
  res.set("Content-Type", "text/html").send(
    landing("Payment cancelled", "No payment was taken. You can close this page and try again from the app."),
  );
});
function landing(title: string, msg: string): string {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="margin:0;background:#081226;color:#F2F6FF;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px">
<div style="max-width:420px"><div style="font-size:22px;font-weight:700;color:#F3C33B;margin-bottom:12px">${title}</div>
<p style="line-height:1.5;color:#C2CFE8">${msg}</p></div></body>`;
}

// ---- Admin: fee schedule (price list) --------------------------------------

router.get("/:clubKey/fees", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const fees = await prisma.feeSchedule.findMany({
    where: { clubKey: req.params.clubKey },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  res.json(fees);
});

const FEE_TYPES = ["dues", "green_fee", "comp_entry", "levy"];
function feeData(b: any) {
  const d: any = {};
  if (b.type != null && FEE_TYPES.includes(String(b.type))) d.type = String(b.type);
  if (b.name != null) d.name = String(b.name);
  if ("category" in b) d.category = b.category ? String(b.category) : null;
  if ("period" in b) d.period = b.period ? String(b.period) : null;
  if (b.amountCents != null && Number.isFinite(Number(b.amountCents))) d.amountCents = Math.max(0, Math.round(Number(b.amountCents)));
  if ("active" in b) d.active = !!b.active;
  return d;
}

router.post("/:clubKey/fees", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const d = feeData(req.body ?? {});
  if (!d.type || !d.name || d.amountCents == null) {
    return res.status(400).json({ error: "type, name and amountCents required" });
  }
  const fee = await prisma.feeSchedule.create({ data: { clubKey, ...d } });
  res.json(fee);
});

router.put("/:clubKey/fees/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    const fee = await prisma.feeSchedule.update({ where: { id: req.params.id }, data: feeData(req.body ?? {}) });
    res.json(fee);
  } catch {
    res.status(404).json({ error: "Fee not found" });
  }
});

router.delete("/:clubKey/fees/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    await prisma.feeSchedule.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Fee not found" });
  }
});

// ---- Admin: invoices -------------------------------------------------------

// List invoices (admin). Optional ?status= and ?type= and ?q= (name/number).
router.get("/:clubKey/invoices", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const status = req.query.status ? String(req.query.status) : "";
  const type = req.query.type ? String(req.query.type) : "";
  const q = req.query.q ? String(req.query.q).trim() : "";
  const invoices = await prisma.invoice.findMany({
    where: {
      clubKey,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(q
        ? { OR: [{ payerName: { contains: q, mode: "insensitive" } }, { number: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    include: { member: { select: { memberNumber: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const totals = await prisma.invoice.groupBy({
    by: ["status"],
    where: { clubKey },
    _sum: { amountCents: true },
    _count: true,
  });
  res.json({ invoices, totals });
});

// Raise an invoice (admin). Body: { memberId?, payerName?, type, description,
// amountCents, dueAt?, feeId? }. If memberId is given, payerName/email default
// to the member.
router.post("/:clubKey/invoices", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const b = req.body ?? {};
  const type = FEE_TYPES.includes(String(b.type)) ? String(b.type) : "levy";
  const amountCents = Math.round(Number(b.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) return res.status(400).json({ error: "amountCents required" });

  let memberId: string | null = b.memberId ? String(b.memberId) : null;
  let payerName = b.payerName ? String(b.payerName) : "";
  let payerEmail = b.payerEmail ? String(b.payerEmail) : null;
  if (memberId) {
    const m = await prisma.member.findFirst({ where: { id: memberId, clubKey } });
    if (!m) return res.status(404).json({ error: "Member not found" });
    if (!payerName) payerName = `${m.firstName} ${m.lastName}`;
    if (!payerEmail) payerEmail = m.email ?? null;
  }
  if (!payerName) return res.status(400).json({ error: "payerName or memberId required" });

  const inv = await prisma.invoice.create({
    data: {
      clubKey,
      number: await genInvoiceNumber(clubKey),
      memberId,
      payerName,
      payerEmail,
      type,
      description: b.description ? String(b.description) : "Charge",
      amountCents,
      dueAt: b.dueAt ? new Date(b.dueAt) : null,
      feeId: b.feeId ? String(b.feeId) : null,
    },
  });
  res.json(inv);
});

// Mark an invoice paid manually (admin) — EFT / cash / card machine. Records a
// manual Payment for the audit trail.
router.post("/:clubKey/invoices/:id/mark-paid", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const inv = await prisma.invoice.findFirst({ where: { id: req.params.id, clubKey } });
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  if (inv.status === "paid") return res.json(inv);

  const [, updated] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        clubKey,
        invoiceId: inv.id,
        provider: "manual",
        providerRef: req.body?.ref ? String(req.body.ref) : null,
        amountCents: inv.amountCents,
        status: "completed",
        note: req.body?.method ? String(req.body.method) : "EFT",
      },
    }),
    prisma.invoice.update({ where: { id: inv.id }, data: { status: "paid", paidAt: new Date() } }),
  ]);
  res.json(updated);
});

// Cancel an invoice (admin).
router.post("/:clubKey/invoices/:id/cancel", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    const inv = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: "cancelled" },
    });
    res.json(inv);
  } catch {
    res.status(404).json({ error: "Invoice not found" });
  }
});

// The dues run (admin): raise a dues invoice for every active member, using a
// dues fee. If the fee has a category, only members of that category are billed.
// Skips members who already have an unpaid/paid invoice for this fee.
router.post("/:clubKey/issue-dues", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const feeId = req.body?.feeId ? String(req.body.feeId) : "";
  const fee = feeId ? await prisma.feeSchedule.findFirst({ where: { id: feeId, clubKey } }) : null;
  if (!fee || fee.type !== "dues") return res.status(400).json({ error: "A dues fee is required" });

  const members = await prisma.member.findMany({
    where: { clubKey, status: "active", ...(fee.category ? { category: fee.category } : {}) },
  });
  const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : null;

  let created = 0,
    skipped = 0;
  for (const m of members) {
    const already = await prisma.invoice.findFirst({
      where: { clubKey, memberId: m.id, feeId: fee.id, status: { in: ["unpaid", "paid"] } },
    });
    if (already) {
      skipped++;
      continue;
    }
    await prisma.invoice.create({
      data: {
        clubKey,
        number: await genInvoiceNumber(clubKey),
        memberId: m.id,
        payerName: `${m.firstName} ${m.lastName}`,
        payerEmail: m.email ?? null,
        type: "dues",
        description: fee.name,
        amountCents: fee.amountCents,
        dueAt,
        feeId: fee.id,
      },
    });
    created++;
  }
  res.json({ ok: true, created, skipped, candidates: members.length });
});

export default router;
