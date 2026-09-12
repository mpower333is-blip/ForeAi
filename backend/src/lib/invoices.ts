// Shared invoice helpers — used by the payments router and by the bookings /
// competitions routes so a green fee or a competition entry can raise an invoice
// automatically. Amounts are integer cents in the club currency.

import prisma from "../config/db";

// A short, human-friendly, club-unique reference: INV-YYMM-XXXXXX. Also used as
// the PayFast m_payment_id and the EFT payment reference, so members quote it.
export async function genInvoiceNumber(clubKey: string): Promise<string> {
  const now = new Date();
  const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 6; i++) {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const number = `INV-${ym}-${rand}`;
    const clash = await prisma.invoice.findUnique({ where: { clubKey_number: { clubKey, number } } });
    if (!clash) return number;
  }
  // Extremely unlikely fallback.
  return `INV-${ym}-${Date.now().toString(36).toUpperCase()}`;
}

// Raise a competition-entry invoice when the competition has an entry fee and
// the entry doesn't already have one. Safe to call on every entry.
export async function raiseCompEntryInvoice(entry: {
  id: string;
  clubKey?: string;
  competitionId: string;
  memberId: string | null;
  playerName: string;
}): Promise<void> {
  const comp = await prisma.competition.findUnique({ where: { id: entry.competitionId } });
  if (!comp || !comp.entryFeeCents || comp.entryFeeCents <= 0) return;
  const clubKey = entry.clubKey ?? comp.clubKey;

  const existing = await prisma.invoice.findUnique({ where: { entryId: entry.id } });
  if (existing) return;

  const member = entry.memberId
    ? await prisma.member.findUnique({ where: { id: entry.memberId } })
    : null;

  await prisma.invoice.create({
    data: {
      clubKey,
      number: await genInvoiceNumber(clubKey),
      memberId: entry.memberId,
      payerName: entry.playerName,
      payerEmail: member?.email ?? null,
      type: "comp_entry",
      description: `Entry — ${comp.name}`,
      amountCents: comp.entryFeeCents,
      competitionId: comp.id,
      entryId: entry.id,
    },
  });
}

// Raise a green-fee invoice for a booking, when the club charges green fees on
// booking and an active green_fee fee is configured. Charges partySize × fee.
export async function raiseBookingGreenFee(booking: {
  id: string;
  clubKey: string;
  memberId: string | null;
  partySize: number;
  players?: unknown;
}): Promise<void> {
  const settings = await prisma.clubSettings.findUnique({ where: { clubKey: booking.clubKey } });
  if (!settings?.chargeGreenFeeOnBooking) return;

  const fee = await prisma.feeSchedule.findFirst({
    where: { clubKey: booking.clubKey, type: "green_fee", active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!fee || fee.amountCents <= 0) return;

  const existing = await prisma.invoice.findUnique({ where: { bookingId: booking.id } });
  if (existing) return;

  const member = booking.memberId
    ? await prisma.member.findUnique({ where: { id: booking.memberId } })
    : null;
  const payerName = member
    ? `${member.firstName} ${member.lastName}`
    : Array.isArray(booking.players) && booking.players.length
    ? String((booking.players as any[])[0])
    : "Guest";
  const qty = Math.max(1, booking.partySize);

  await prisma.invoice.create({
    data: {
      clubKey: booking.clubKey,
      number: await genInvoiceNumber(booking.clubKey),
      memberId: booking.memberId,
      payerName,
      payerEmail: member?.email ?? null,
      type: "green_fee",
      description: qty > 1 ? `${fee.name} × ${qty}` : fee.name,
      amountCents: fee.amountCents * qty,
      bookingId: booking.id,
      feeId: fee.id,
    },
  });
}
