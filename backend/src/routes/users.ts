import { Router } from "express";
import prisma from "../config/db";

const router = Router();

// Create a user (or return the existing one for this email).
router.post("/", async (req, res) => {
  try {
    const { email, handicap } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });

    const user = await prisma.user.upsert({
      where: { email },
      update: { handicap },
      create: { email, handicap },
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Fetch a user with their clubs and rounds.
router.get("/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { clubs: true, rounds: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
