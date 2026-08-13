import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen, ScreenHeader, Card, Button, Stepper } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import {
  GAMES,
  GameId,
  proximityPoints,
  proximityLabel,
  targetSequence,
  estimateDriveYards,
  tempoPoints,
  grade,
} from "../lib/games";
import { useGames } from "../state/GamesContext";
import { useSwingCapture } from "../hooks/useSwingCapture";

export default function GamesScreen() {
  const [active, setActive] = useState<GameId | null>(null);
  const { best } = useGames();

  if (active) {
    const back = () => setActive(null);
    if (active === "closest") return <ClosestGame onBack={back} />;
    if (active === "target") return <TargetGame onBack={back} />;
    if (active === "longdrive") return <LongDriveGame onBack={back} />;
    return <TempoGame onBack={back} />;
  }

  return (
    <Screen>
      <ScreenHeader title="Range Games" subtitle="Gamified practice — sharpen your game and chase a high score." />
      {GAMES.map((g) => (
        <TouchableOpacity key={g.id} activeOpacity={0.85} onPress={() => setActive(g.id)}>
          <Card>
            <View style={styles.hubRow}>
              <Text style={styles.hubEmoji}>{g.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.hubName}>{g.name}</Text>
                <Text style={styles.hubBlurb}>{g.blurb}</Text>
              </View>
            </View>
            <View style={styles.hubFoot}>
              <Text style={styles.hubTag}>{g.sensor ? "📱 motion" : "✏️ manual"}</Text>
              <Text style={styles.hubBest}>
                {best[g.id] != null ? `Best ${best[g.id]}` : "No score yet"}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}

function GameHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Games</Text>
      </TouchableOpacity>
      <Text style={styles.gameTitle}>{title}</Text>
    </>
  );
}

// ---- Closest to the Pin ---------------------------------------------------

function ClosestGame({ onBack }: { onBack: () => void }) {
  const { best, recordScore } = useGames();
  const [target, setTarget] = useState(150);
  const [result, setResult] = useState(150);
  const [shots, setShots] = useState<number[]>([]);
  const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");
  const [newBest, setNewBest] = useState(false);

  const TOTAL_SHOTS = 5;
  const total = shots.reduce((a, b) => a + b, 0);

  const start = () => {
    setShots([]);
    setResult(target);
    setPhase("playing");
    setNewBest(false);
  };

  const logShot = () => {
    const pts = proximityPoints(target, result);
    const next = [...shots, pts];
    setShots(next);
    setResult(target);
    if (next.length >= TOTAL_SHOTS) {
      const sum = next.reduce((a, b) => a + b, 0);
      setNewBest(recordScore("closest", sum));
      setPhase("done");
    }
  };

  return (
    <Screen>
      <GameHeader title="🎯 Closest to the Pin" onBack={onBack} />

      {phase === "setup" && (
        <Card>
          <Text style={styles.instr}>Pick a target distance, then hit 5 shots. Points for how close you finish.</Text>
          <Stepper label="Target distance" value={target} onChange={setTarget} step={5} min={40} max={230} unit="yds" />
          <Button label="Start" onPress={start} />
          {best.closest != null && <Text style={styles.bestLine}>Best: {best.closest} / 500</Text>}
        </Card>
      )}

      {phase === "playing" && (
        <>
          <Card accent>
            <Text style={styles.bigTarget}>{target} yds</Text>
            <Text style={styles.subTarget}>
              Shot {shots.length + 1} of {TOTAL_SHOTS} · {total} pts so far
            </Text>
          </Card>
          <Card>
            <Stepper label="Where did it finish?" value={result} onChange={setResult} step={2} min={5} max={320} unit="yds" />
            <Text style={styles.preview}>
              {proximityPoints(target, result)} pts · {proximityLabel(target, result)}
            </Text>
            <Button label="Log shot" onPress={logShot} />
          </Card>
        </>
      )}

      {phase === "done" && (
        <Card accent>
          <Text style={styles.doneScore}>{total} / 500</Text>
          {newBest && <Text style={styles.newBest}>🏆 New best!</Text>}
          <View style={styles.shotList}>
            {shots.map((s, i) => (
              <Text key={i} style={styles.shotItem}>
                Shot {i + 1}: {s} pts
              </Text>
            ))}
          </View>
          <Button label="Play again" onPress={() => setPhase("setup")} />
        </Card>
      )}
    </Screen>
  );
}

// ---- Target Challenge -----------------------------------------------------

function TargetGame({ onBack }: { onBack: () => void }) {
  const { recordScore } = useGames();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 10));
  const seq = targetSequence(seed);
  const [i, setI] = useState(0);
  const [result, setResult] = useState(seq[0]);
  const [scores, setScores] = useState<number[]>([]);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [newBest, setNewBest] = useState(false);

  const total = scores.reduce((a, b) => a + b, 0);

  const hit = () => {
    const pts = proximityPoints(seq[i], result);
    const next = [...scores, pts];
    setScores(next);
    if (i + 1 >= seq.length) {
      setNewBest(recordScore("target", next.reduce((a, b) => a + b, 0)));
      setPhase("done");
    } else {
      setI(i + 1);
      setResult(seq[i + 1]);
    }
  };

  const restart = () => {
    const s = Math.floor(Math.random() * 10);
    setSeed(s);
    setI(0);
    setResult(targetSequence(s)[0]);
    setScores([]);
    setPhase("playing");
    setNewBest(false);
  };

  return (
    <Screen>
      <GameHeader title="🏁 Target Challenge" onBack={onBack} />

      {phase === "playing" && (
        <>
          <Card accent>
            <Text style={styles.bigTarget}>{seq[i]} yds</Text>
            <Text style={styles.subTarget}>
              Target {i + 1} of {seq.length} · {total} pts
            </Text>
          </Card>
          <Card>
            <Stepper label="Where did it finish?" value={result} onChange={setResult} step={2} min={5} max={320} unit="yds" />
            <Text style={styles.preview}>
              {proximityPoints(seq[i], result)} pts · {proximityLabel(seq[i], result)}
            </Text>
            <Button label={i + 1 >= seq.length ? "Finish" : "Next target"} onPress={hit} />
          </Card>
        </>
      )}

      {phase === "done" && (
        <Card accent>
          <Text style={styles.doneScore}>
            {total} <Text style={styles.gradeTag}>({grade(total / seq.length)})</Text>
          </Text>
          {newBest && <Text style={styles.newBest}>🏆 New best!</Text>}
          <Button label="Play again" onPress={restart} />
        </Card>
      )}
    </Screen>
  );
}

// ---- Sensor games ---------------------------------------------------------

function SensorPrompt({
  capture,
  onSwing,
  label,
}: {
  capture: ReturnType<typeof useSwingCapture>;
  onSwing: () => void;
  label: string;
}) {
  if (capture.sensorOk === false) {
    return <Text style={styles.warn}>Motion sensors aren't available here — try it on a phone.</Text>;
  }
  if (capture.phase === "armed") {
    return (
      <>
        <View style={styles.liveTrack}>
          <View
            style={{
              width: `${Math.min(100, (capture.live / 2) * 100)}%`,
              height: "100%",
              backgroundColor: capture.live > 0.9 ? colors.negative : colors.accent,
              borderRadius: 4,
            }}
          />
        </View>
        <Text style={styles.watching}>Watching for your swing…</Text>
        <Button label="Cancel" variant="ghost" onPress={capture.cancel} />
      </>
    );
  }
  return <Button label={label} onPress={onSwing} />;
}

function LongDriveGame({ onBack }: { onBack: () => void }) {
  const { best, recordScore } = useGames();
  const capture = useSwingCapture();
  const [attempts, setAttempts] = useState<number[]>([]);
  const [msg, setMsg] = useState("");

  const swing = () =>
    capture.arm((m) => {
      if (!m) {
        setMsg("No clear swing — take a full pass.");
        return;
      }
      const yards = estimateDriveYards(m.peakG);
      setMsg("");
      setAttempts((a) => [yards, ...a].slice(0, 8));
      recordScore("longdrive", yards);
    });

  const sessionBest = attempts.length ? Math.max(...attempts) : 0;

  return (
    <Screen>
      <GameHeader title="💥 Long Drive" onBack={onBack} />
      <Card accent>
        <Text style={styles.bigTarget}>{sessionBest || "–"}</Text>
        <Text style={styles.subTarget}>
          session best (yds){best.longdrive ? ` · all-time ${best.longdrive}` : ""}
        </Text>
      </Card>
      <Card>
        <Text style={styles.instr}>
          Hold your phone like a club and swing through impact. We estimate carry from the impact
          you generate (a fun proxy, not a launch monitor).
        </Text>
        <SensorPrompt capture={capture} onSwing={swing} label="Swing!" />
        {msg !== "" && <Text style={styles.warn}>{msg}</Text>}
      </Card>
      {attempts.length > 0 && (
        <Card>
          <Text style={styles.listTitle}>This session</Text>
          {attempts.map((y, i) => (
            <Text key={i} style={styles.shotItem}>
              {y} yds {y === sessionBest ? "  ⭐" : ""}
            </Text>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function TempoGame({ onBack }: { onBack: () => void }) {
  const { best, recordScore } = useGames();
  const capture = useSwingCapture();
  const [scores, setScores] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [newBest, setNewBest] = useState(false);

  const SWINGS = 5;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const swing = () =>
    capture.arm((m) => {
      if (!m) {
        setMsg("No clear swing — take a full pass.");
        return;
      }
      const pts = tempoPoints(m);
      setMsg("");
      setScores((prev) => {
        const next = [...prev, pts];
        if (next.length >= SWINGS) {
          const a = Math.round(next.reduce((x, y) => x + y, 0) / next.length);
          setNewBest(recordScore("tempo", a));
          setDone(true);
        }
        return next;
      });
    });

  const restart = () => {
    setScores([]);
    setDone(false);
    setNewBest(false);
    setMsg("");
  };

  return (
    <Screen>
      <GameHeader title="🎼 Tempo Trainer" onBack={onBack} />
      <Card accent>
        <Text style={styles.bigTarget}>
          {avg || "–"} <Text style={styles.gradeTag}>{scores.length ? `(${grade(avg)})` : ""}</Text>
        </Text>
        <Text style={styles.subTarget}>
          {done ? "final tempo score" : `swing ${scores.length + 1} of ${SWINGS}`}
          {best.tempo ? ` · best ${best.tempo}` : ""}
        </Text>
      </Card>
      <Card>
        {!done ? (
          <>
            <Text style={styles.instr}>
              Make a smooth swing aiming for a 3:1 backswing-to-downswing rhythm. Each swing is
              scored on tempo and balance.
            </Text>
            <SensorPrompt capture={capture} onSwing={swing} label={scores.length ? "Next swing" : "Start"} />
            {msg !== "" && <Text style={styles.warn}>{msg}</Text>}
          </>
        ) : (
          <>
            {newBest && <Text style={styles.newBest}>🏆 New best!</Text>}
            <View style={styles.shotList}>
              {scores.map((s, i) => (
                <Text key={i} style={styles.shotItem}>
                  Swing {i + 1}: {s} pts
                </Text>
              ))}
            </View>
            <Button label="Play again" onPress={restart} />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hubRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  hubEmoji: { fontSize: 34 },
  hubName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  hubBlurb: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  hubFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  hubTag: { color: colors.textFaint, fontSize: 12, fontWeight: "600" },
  hubBest: { color: colors.accent, fontSize: 13, fontWeight: "700" },

  back: { color: colors.accent, fontSize: 16, marginBottom: spacing.sm },
  gameTitle: { color: colors.text, fontSize: 26, fontWeight: "800", marginBottom: spacing.md },

  instr: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: spacing.sm },
  bestLine: { color: colors.textFaint, fontSize: 13, marginTop: spacing.sm, textAlign: "center" },

  bigTarget: { color: colors.accent, fontSize: 52, fontWeight: "800" },
  subTarget: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  preview: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm },

  doneScore: { color: colors.accent, fontSize: 44, fontWeight: "800" },
  gradeTag: { color: colors.text, fontSize: 22, fontWeight: "700" },
  newBest: { color: colors.warning, fontSize: 18, fontWeight: "800", marginTop: 4 },
  shotList: { marginVertical: spacing.sm },
  shotItem: { color: colors.textMuted, fontSize: 15, paddingVertical: 3 },
  listTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 6 },

  liveTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden", marginBottom: 8 },
  watching: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.sm },
  warn: { color: colors.warning, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
});
