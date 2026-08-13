import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";
import { detectSwing, Sample, SwingMetrics } from "../lib/swingDetector";

// Reusable motion-sensor swing capture. Arm it with a callback; it watches the
// accelerometer, auto-detects the impact spike, and returns SwingMetrics (or
// null if no clean swing was found). Shared by the Swing Coach and Range Games.

const IMPACT_THRESHOLD = 0.9;
const FINISH_TAIL_MS = 800;
const MAX_BUFFER_MS = 5000;

export type SwingCapture = {
  phase: "idle" | "armed";
  live: number;
  sensorOk: boolean | null;
  arm: (onResult: (m: SwingMetrics | null) => void) => void;
  analyzeNow: () => void;
  cancel: () => void;
};

export function useSwingCapture(): SwingCapture {
  const [phase, setPhase] = useState<"idle" | "armed">("idle");
  const [live, setLive] = useState(0);
  const [sensorOk, setSensorOk] = useState<boolean | null>(null);

  const startRef = useRef(0);
  const bufferRef = useRef<Sample[]>([]);
  const impactAtRef = useRef<number | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const lastLiveRef = useRef(0);
  const onResultRef = useRef<(m: SwingMetrics | null) => void>(() => {});

  useEffect(() => {
    Accelerometer.isAvailableAsync()
      .then(setSensorOk)
      .catch(() => setSensorOk(false));
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    subRef.current?.remove();
    subRef.current = null;
  };

  const finalize = () => {
    stop();
    setPhase("idle");
    const metrics = detectSwing(bufferRef.current);
    onResultRef.current(metrics);
  };

  const onSample = ({ x, y, z }: { x: number; y: number; z: number }) => {
    const now = Date.now();
    const t = now - startRef.current;
    const mag = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
    const buf = bufferRef.current;
    buf.push({ t, mag });
    while (buf.length && t - buf[0].t > MAX_BUFFER_MS) buf.shift();

    if (now - lastLiveRef.current > 90) {
      lastLiveRef.current = now;
      setLive(mag);
    }
    if (impactAtRef.current === null && t > 400 && mag > IMPACT_THRESHOLD) {
      impactAtRef.current = t;
    }
    if (impactAtRef.current !== null && t > impactAtRef.current + FINISH_TAIL_MS) {
      finalize();
    }
  };

  const arm: SwingCapture["arm"] = (onResult) => {
    onResultRef.current = onResult;
    bufferRef.current = [];
    impactAtRef.current = null;
    startRef.current = Date.now();
    setLive(0);
    setPhase("armed");
    Accelerometer.setUpdateInterval(16);
    subRef.current = Accelerometer.addListener(onSample);
  };

  const cancel = () => {
    stop();
    setPhase("idle");
  };

  return { phase, live, sensorOk, arm, analyzeNow: finalize, cancel };
}
