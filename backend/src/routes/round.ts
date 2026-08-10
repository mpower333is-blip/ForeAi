import { Router } from "express";
import prisma from "../config/db";

const router = Router();

// Start a new round.
router.post("/", async (req, res) => {
  try {
    const { userId, courseName, totalScore } = req.body;
    if (!userId || !courseName) {
      return res.status(400).json({ error: "userId and courseName are required" });
    }

    const round = await prisma.round.create({
      data: {
        userId,
        courseName,
        totalScore: totalScore ?? 0,
      },
    });

    res.json(round);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create round" });
  }
});

// Update a round's total score (e.g. when the round is finished).
router.patch("/:id", async (req, res) => {
  try {
    const round = await prisma.round.update({
      where: { id: req.params.id },
      data: { totalScore: req.body.totalScore },
    });
    res.json(round);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update round" });
  }
});

// Get a round with all of its shots.
router.get("/:id", async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: { shots: { orderBy: { createdAt: "asc" } } },
    });
    if (!round) return res.status(404).json({ error: "Round not found" });
    res.json(round);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch round" });
  }
});

// List all rounds for a user.
router.get("/user/:userId", async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(rounds);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch rounds" });
  }
});

export default router;
