import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Accelerometer } from "expo-sensors";

import { Screen, ScreenHeader, Card, Button } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { detectSwing, Sample } from "../lib/swingDetector";
import { buildReport, SwingReport, Grade } from "../lib/swingCoach";

type Phase = "idle" | "armed" | "done";

const IMPACT_THRESHOLD = 0.9; // g of dynamic acceleration that flags impact
const FINISH_TAIL_MS = 800; // keep recording after impact to score the finish
const MAX_BUFFER_MS = 5000;

export default function SwingScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<SwingReport | null>(null);
  const [live, setLive] = useState(0);
  const [noSwing, setNoSwing] = useState(false);
  const [sensorOk, setSensorOk] = useState<boolean | null>(null);

  const startRef = useRef(0);
  const bufferRef = useRef<Sample[]>([]);
  const impactAtRef = useRef<number | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const lastLiveRef = useRef(0);

  useEffect(() => {
    Accelerometer.isAvailableAsync()
      .then(setSensorOk)
      .catch(() => setSensorOk(false));
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopListening = () => {
    subRef.current?.remove();
    subRef.current = null;
  };

  const finalize = () => {
    stopListening();
    const metrics = detectSwing(bufferRef.current);
    if (metrics) {
      setReport(buildReport(metrics));
      setNoSwing(false);
    } else {
      setReport(null);
      setNoSwing(true);
    }
    setPhase("done");
  };

  const onSample = ({ x, y, z }: { x: number; y: number; z: number }) => {
    const now = Date.now();
    const t = now - startRef.current;
    const mag = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1); // drop gravity
    const buf = bufferRef.current;
    buf.push({ t, mag });
    while (buf.length && t - buf[0].t > MAX_BUFFER_MS) buf.shift();

    // Throttle the live meter so we don't re-render at 60Hz.
    if (now - lastLiveRef.current > 90) {
      lastLiveRef.current = now;
      setLive(mag);
    }

    // First hard spike after a beat of settling = impact.
    if (impactAtRef.current === null && t > 400 && mag > IMPACT_THRESHOLD) {
      impactAtRef.current = t;
    }
    if (impactAtRef.current !== null && t > impactAtRef.current + FINISH_TAIL_MS) {
      finalize();
    }
  };

  const arm = () => {
    bufferRef.current = [];
    impactAtRef.current = null;
    startRef.current = Date.now();
    setReport(null);
    setNoSwing(false);
    setPhase("armed");
    Accelerometer.setUpdateInterval(16);
    subRef.current = Accelerometer.addListener(onSample);
  };

  const analyzeNow = () => finalize();

  const reset = () => {
    stopListening();
    setReport(null);
    setNoSwing(false);
    setPhase("idle");
  };

  return (
    <Screen>
      <ScreenHeader title="Swing Coach" subtitle="Frame yourself, take a swing — get tempo and posture feedback." />

      <Card style={styles.camCard}>
        <View style={styles.camWrap}>
          {permission?.granted ? (
            <CameraView style={styles.cam} facing="back" />
          ) : (
            <View style={[styles.cam, styles.camPlaceholder]}>
              <Text style={styles.camPlaceholderText}>
                {Platform.OS === "web"
                  ? "Camera preview may be limited on web"
                  : "Camera off"}
              </Text>
            </View>
          )}

          {/* Posture framing guide */}
          <View pointerEvents="none" style={styles.guide}>
            <View style={styles.guideVert} />
            <View style={styles.guideBox} />
            <Text style={styles.guideHint}>Line up your spine • fit your body in the box</Text>
          </View>

          {phase === "armed" && (
            <View style={styles.liveMeter}>
              <View style={styles.liveTrack}>
                <View
                  style={{
                    width: `${Math.min(100, (live / 2) * 100)}%`,
                    height: "100%",
                    backgroundColor: live > IMPACT_THRESHOLD ? colors.negative : colors.accent,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={styles.liveText}>Watching for your swing…</Text>
            </View>
          )}
        </View>

        {!permission?.granted && (
          <Button label="Enable camera" onPress={requestPermission} variant="ghost" />
        )}
      </Card>

      {sensorOk === false && (
        <Card>
          <Text style={styles.warn}>
            Motion sensors aren't available on this device, so swing detection is disabled here.
            Try it on a phone.
          </Text>
        </Card>
      )}

      {phase !== "armed" ? (
        <Button
          label={phase === "done" ? "Record another swing" : "Arm swing capture"}
          onPress={phase === "done" ? () => { reset(); arm(); } : arm}
        />
      ) : (
        <View style={styles.armedRow}>
          <Button label="Analyze now" onPress={analyzeNow} style={{ flex: 1 }} />
          <Button label="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} />
        </View>
      )}

      {phase === "armed" && (
        <Card>
          <Text style={styles.instructions}>
            1. Prop your phone facing you (down-the-line or face-on).{"\n"}
            2. Step into your stance inside the box.{"\n"}
            3. Make your swing — capture stops automatically after impact.
          </Text>
        </Card>
      )}

      {noSwing && (
        <Card>
          <Text style={styles.warn}>
            No clear swing detected. Make sure the phone can feel the motion (a tripod or the
            ground works best) and take a full swing.
          </Text>
        </Card>
      )}

      {report && <ReportView report={report} />}
    </Screen>
  );
}

function ReportView({ report }: { report: SwingReport }) {
  const ring = gradeColor(
    report.score >= 85 ? "good" : report.score >= 65 ? "ok" : "work"
  );
  return (
    <>
      <Card accent>
        <View style={styles.scoreRow}>
          <View style={[styles.scoreCircle, { borderColor: ring }]}>
            <Text style={[styles.scoreNum, { color: ring }]}>{report.score}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headline}>{report.headline}</Text>
            <Text style={styles.subline}>{report.tempoClass}</Text>
            {report.estSpeedMph !== null && (
              <Text style={styles.speed}>~{report.estSpeedMph} mph swing (est.)</Text>
            )}
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>The numbers</Text>
        {report.metrics.map((m) => (
          <View key={m.label} style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricDetail}>{m.detail}</Text>
            </View>
            <View style={[styles.gradeDot, { backgroundColor: gradeColor(m.grade) }]} />
            <Text style={[styles.metricValue, { color: gradeColor(m.grade) }]}>{m.value}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Coaching</Text>
        {report.tips.map((t, i) => (
          <View key={i} style={styles.tip}>
            <Text style={styles.tipTitle}>{t.title}</Text>
            <Text style={styles.tipBody}>{t.body}</Text>
            {t.drill && <Text style={styles.tipDrill}>🎯 Drill: {t.drill}</Text>}
          </View>
        ))}
      </Card>
    </>
  );
}

function gradeColor(g: Grade): string {
  return g === "good" ? colors.positive : g === "ok" ? colors.warning : colors.negative;
}

const styles = StyleSheet.create({
  camCard: { padding: spacing.sm },
  camWrap: {
    height: 300,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  cam: { flex: 1 },
  camPlaceholder: { alignItems: "center", justifyContent: "center" },
  camPlaceholderText: { color: colors.textFaint, fontSize: 14 },

  guide: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  guideVert: {
    position: "absolute",
    width: 2,
    height: "100%",
    backgroundColor: "rgba(124,255,87,0.35)",
  },
  guideBox: {
    width: "42%",
    height: "78%",
    borderWidth: 2,
    borderColor: "rgba(124,255,87,0.45)",
    borderRadius: 10,
  },
  guideHint: {
    position: "absolute",
    bottom: 10,
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  liveMeter: { position: "absolute", top: 12, left: 12, right: 12 },
  liveTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  liveText: { color: "#fff", fontSize: 12, marginTop: 6, textShadowColor: "#000", textShadowRadius: 3 },

  armedRow: { flexDirection: "row", gap: spacing.sm },
  instructions: { color: colors.textMuted, fontSize: 15, lineHeight: 24 },
  warn: { color: colors.warning, fontSize: 15, lineHeight: 22 },

  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  scoreCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: { fontSize: 30, fontWeight: "800" },
  headline: { color: colors.text, fontSize: 20, fontWeight: "800" },
  subline: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  speed: { color: colors.accent, fontSize: 14, fontWeight: "600", marginTop: 2 },

  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },
  metricDetail: { color: colors.textFaint, fontSize: 13, marginTop: 1 },
  gradeDot: { width: 10, height: 10, borderRadius: 5 },
  metricValue: { fontSize: 16, fontWeight: "700", minWidth: 66, textAlign: "right" },

  tip: { marginBottom: spacing.md },
  tipTitle: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  tipBody: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 4 },
  tipDrill: { color: colors.text, fontSize: 14, marginTop: 6, fontStyle: "italic" },
});
