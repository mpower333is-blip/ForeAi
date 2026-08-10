// Swing coach — turns raw SwingMetrics into human coaching feedback.
//
// Pure logic: given the numbers the detector produced, decide what to praise,
// what to fix, and which drills help. Kept separate from detection so the
// coaching rules are easy to tune and test.

import { SwingMetrics } from "./swingDetector";

export type Grade = "good" | "ok" | "work";

export type MetricCard = {
  label: string;
  value: string;
  grade: Grade;
  detail: string;
};

export type CoachTip = {
  title: string;
  body: string;
  drill?: string;
};

export type SwingReport = {
  score: number; // 0-100 overall
  headline: string;
  tempoClass: string;
  estSpeedMph: number | null;
  metrics: MetricCard[];
  tips: CoachTip[];
};

const IDEAL_TEMPO = 3.0; // tour backswing:downswing ratio

// A rough, relative club-head speed estimate from the impact spike. Phone
// accelerometers can't measure true club speed, so this is a calibrated
// ballpark for feedback, not a launch-monitor number.
export function estimateSpeedMph(peakG: number): number {
  const mph = 55 + (peakG - 1) * 22;
  return Math.max(40, Math.min(130, Math.round(mph)));
}

function gradeTempo(ratio: number): Grade {
  const off = Math.abs(ratio - IDEAL_TEMPO);
  if (off <= 0.4) return "good";
  if (off <= 0.9) return "ok";
  return "work";
}

function tempoClass(ratio: number): string {
  if (ratio >= 3.4) return "Smooth / slow transition";
  if (ratio >= 2.6) return "Tour tempo";
  if (ratio >= 2.0) return "Quick transition";
  return "Rushed from the top";
}

function gradeScore(grade: Grade): number {
  return grade === "good" ? 100 : grade === "ok" ? 70 : 40;
}

export function buildReport(m: SwingMetrics): SwingReport {
  const tempoGrade = gradeTempo(m.tempoRatio);
  const setupGrade: Grade =
    m.setupStability >= 75 ? "good" : m.setupStability >= 50 ? "ok" : "work";
  const balanceGrade: Grade =
    m.finishBalance >= 75 ? "good" : m.finishBalance >= 50 ? "ok" : "work";

  const metrics: MetricCard[] = [
    {
      label: "Tempo",
      value: `${m.tempoRatio.toFixed(1)} : 1`,
      grade: tempoGrade,
      detail: tempoClass(m.tempoRatio),
    },
    {
      label: "Backswing",
      value: `${m.backswingMs} ms`,
      grade: m.backswingMs >= 600 && m.backswingMs <= 900 ? "good" : "ok",
      detail: "Time from takeaway to the top",
    },
    {
      label: "Downswing",
      value: `${m.downswingMs} ms`,
      grade: m.downswingMs >= 200 && m.downswingMs <= 300 ? "good" : "ok",
      detail: "Transition to impact",
    },
    {
      label: "Setup stability",
      value: `${m.setupStability}`,
      grade: setupGrade,
      detail: "How still you were at address",
    },
    {
      label: "Finish balance",
      value: `${m.finishBalance}`,
      grade: balanceGrade,
      detail: "Did you hold the finish?",
    },
  ];

  const tips: CoachTip[] = [];

  if (tempoGrade !== "good") {
    if (m.tempoRatio < IDEAL_TEMPO - 0.4) {
      tips.push({
        title: "You're rushing the transition",
        body:
          "Your downswing is fast relative to your backswing. Feel like you start down at the same speed you took it back — let the club drop, then accelerate.",
        drill: "Count '1-2-3' back, '1' down. Make 10 swings matching that rhythm.",
      });
    } else {
      tips.push({
        title: "Add some snap through impact",
        body:
          "Your transition is a touch slow, bleeding speed. Keep the smooth takeaway but commit to accelerating hard through the ball.",
        drill: "Swish drill: swing a club upside-down, make the swish happen past the ball.",
      });
    }
  }

  if (setupGrade === "work") {
    tips.push({
      title: "Quiet your setup",
      body:
        "There was a lot of movement at address. A stable, athletic base lets you rotate around a steady center. Set your feet, settle your weight, then go.",
      drill: "Freeze at address for 2 seconds before every swing this session.",
    });
  }

  if (balanceGrade === "work") {
    tips.push({
      title: "Hold your finish",
      body:
        "You came off balance after impact — usually a sign of swinging too hard or sliding instead of rotating. Swing at 80% and pose the finish for 3 seconds.",
      drill: "Feet-together drill: hit half shots with feet together to train balance.",
    });
  }

  if (tips.length === 0) {
    tips.push({
      title: "Dialed in",
      body:
        "Great tempo, stable setup, balanced finish. Groove it — repeat this feeling and bank a few reps.",
    });
  }

  const score = Math.round(
    gradeScore(tempoGrade) * 0.5 +
      gradeScore(setupGrade) * 0.25 +
      gradeScore(balanceGrade) * 0.25
  );

  const headline =
    score >= 85
      ? "Locked in"
      : score >= 65
      ? "Solid — one thing to sharpen"
      : "Let's fix the fundamentals";

  return {
    score,
    headline,
    tempoClass: tempoClass(m.tempoRatio),
    estSpeedMph: estimateSpeedMph(m.peakG),
    metrics,
    tips,
  };
}
