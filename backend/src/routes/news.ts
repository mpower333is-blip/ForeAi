import { Router } from "express";
import prisma from "../config/db";
import { requireAdmin } from "./club";

// Club news / noticeboard. Members read published notices (pinned first, then
// newest). Admin (PIN) creates, edits and publishes them.

const router = Router();

async function settings(clubKey: string) {
  return (
    (await prisma.clubSettings.findUnique({ where: { clubKey } })) ?? { adminPin: null as string | null }
  );
}

function noticeData(b: any) {
  const d: any = {};
  if (b.title != null) d.title = String(b.title);
  if (b.body != null) d.body = String(b.body);
  if (b.category != null) d.category = String(b.category);
  if (b.pinned != null) d.pinned = !!b.pinned;
  if ("image" in b) d.image = b.image ? String(b.image) : null;
  if ("authorName" in b) d.authorName = b.authorName ? String(b.authorName) : null;
  if (b.status != null) d.status = String(b.status);
  if (b.publishAt) d.publishAt = new Date(b.publishAt);
  return d;
}

// ---- Member-facing ---------------------------------------------------------

// Published notices, pinned first then newest. Optional ?category= filter.
router.get("/:clubKey", async (req, res) => {
  const category = req.query.category ? String(req.query.category) : "";
  const notices = await prisma.notice.findMany({
    where: {
      clubKey: req.params.clubKey,
      status: "published",
      publishAt: { lte: new Date() },
      ...(category ? { category } : {}),
    },
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
    take: 100,
  });
  res.json(notices);
});

// A single notice.
router.get("/:clubKey/item/:id", async (req, res) => {
  const notice = await prisma.notice.findFirst({ where: { id: req.params.id, clubKey: req.params.clubKey } });
  if (!notice) return res.status(404).json({ error: "Notice not found" });
  res.json(notice);
});

// ---- Admin -----------------------------------------------------------------

// Full list incl. drafts (admin).
router.get("/:clubKey/all", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const notices = await prisma.notice.findMany({
    where: { clubKey: req.params.clubKey },
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
  });
  res.json(notices);
});

router.post("/:clubKey", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const d = noticeData(req.body ?? {});
  if (!d.title || !d.body) return res.status(400).json({ error: "title and body required" });
  const notice = await prisma.notice.create({ data: { clubKey, ...d } });
  res.json(notice);
});

router.put("/:clubKey/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    const notice = await prisma.notice.update({ where: { id: req.params.id }, data: noticeData(req.body ?? {}) });
    res.json(notice);
  } catch {
    res.status(404).json({ error: "Notice not found" });
  }
});

router.delete("/:clubKey/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    await prisma.notice.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Notice not found" });
  }
});

export default router;
