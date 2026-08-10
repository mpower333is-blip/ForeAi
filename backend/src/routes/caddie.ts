import { Router } from "express";
import { recommendClub, playingDistance } from "../lib/clubRecommendation";

const router = Router();

router.post("/recommend", (req, res) => {
  const input = {
    yardage: req.body.yardage,
    wind: req.body.wind ?? req.body.windSpeed,
    elevation: req.body.elevation,
    lie: req.body.lie,
  };

  if (typeof input.yardage !== "number") {
    return res.status(400).json({ error: "yardage (number) is required" });
  }

  const club = recommendClub(input);

  res.json({
    recommendation: club,
    playingYards: playingDistance(input),
    strategy: "Aim center green.",
  });
});

export default router;
