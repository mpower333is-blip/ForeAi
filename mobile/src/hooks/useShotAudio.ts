import { useEffect, useRef, useState } from "react";
import {
  useAudioRecorder,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
} from "expo-audio";

// Acoustic ball-strike detector — the app literally listens for the CRACK of
// club-on-ball.
//
// A practice swing is a soft "whoosh"; a real strike is a very short, very loud
// transient that jumps far above the ambient noise floor. We keep a rolling
// baseline of the microphone level (dBFS) and fire when the level spikes both
// well above that baseline AND above an absolute floor — the signature of a
// struck ball, not a swish, footstep or chatter.
//
// This is what lets auto-tracking ignore practice swings: no crack, no shot.
//
// (Ported from expo-av to expo-audio in the SDK 57 upgrade — expo-av was removed
// after SDK 54. The metering level is read by polling recorder.getStatus().)

export type Crack = { level: number; jump: number; strong: boolean };

const UPDATE_MS = 60; // how often we sample the mic level
const RECYCLE_MS = 30000; // restart the recording periodically so its file can't grow unbounded
const REFRACTORY_MS = 1500; // ignore further cracks for this long after one
const ABS_FLOOR_DB = -22; // a strike is loud — must clear this absolute level
const JUMP_DB = 16; // …and must jump this far above the rolling ambient baseline
const STRONG_DB = -10; // a very loud, clean strike (accepted even without a corroborating swing)
const BASELINE_ALPHA = 0.15; // ambient baseline smoothing (higher = tracks faster)

export type ShotAudioStatus = {
  micOk: boolean | null;
  listening: boolean;
};

export function useShotAudio(
  enabled: boolean,
  onCrack: (c: Crack) => void
): ShotAudioStatus {
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);

  const baselineRef = useRef<number>(-45); // rolling ambient level (dBFS)
  const lastCrackRef = useRef(0);
  const onCrackRef = useRef(onCrack);
  onCrackRef.current = onCrack;

  // One metering-enabled recorder, managed imperatively in the effect below.
  const recorder = useAudioRecorder({
    ...RecordingPresets.LOW_QUALITY,
    isMeteringEnabled: true,
  });

  useEffect(() => {
    if (!enabled) {
      setListening(false);
      return;
    }
    let cancelled = false;
    let sampleTimer: ReturnType<typeof setInterval> | null = null;
    let recycleTimer: ReturnType<typeof setInterval> | null = null;

    const handleLevel = (level: number) => {
      const base = baselineRef.current;
      const jump = level - base;
      const now = Date.now();
      const isCrack =
        (level > ABS_FLOOR_DB && jump > JUMP_DB) || level > STRONG_DB;
      if (isCrack && now - lastCrackRef.current > REFRACTORY_MS) {
        lastCrackRef.current = now;
        onCrackRef.current({ level, jump, strong: level > STRONG_DB });
      }
      // Track ambient more slowly than transients: only let the baseline drift
      // toward quieter levels quickly; loud spikes barely move it.
      const a = level < base ? BASELINE_ALPHA : BASELINE_ALPHA * 0.15;
      baselineRef.current = base + a * (level - base);
    };

    (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) {
          setMicOk(false);
          return;
        }
        setMicOk(true);
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        recorder.record();
        setListening(true);

        // Sample the live metering level on a fixed cadence (expo-audio exposes
        // the current level via getStatus().metering while recording).
        sampleTimer = setInterval(() => {
          try {
            const s = recorder.getStatus();
            if (s?.isRecording && typeof s.metering === "number") handleLevel(s.metering);
          } catch {
            // recorder not ready / mid-recycle — skip this tick
          }
        }, UPDATE_MS);

        // Recycle the recording so its backing file stays tiny over a full round.
        recycleTimer = setInterval(async () => {
          try {
            await recorder.stop();
            await recorder.prepareToRecordAsync();
            recorder.record();
          } catch {
            // if a recycle fails, the next tick retries
          }
        }, RECYCLE_MS);
      } catch {
        if (!cancelled) setMicOk(false);
      }
    })();

    return () => {
      cancelled = true;
      setListening(false);
      if (sampleTimer) clearInterval(sampleTimer);
      if (recycleTimer) clearInterval(recycleTimer);
      recorder.stop().catch(() => {});
    };
  }, [enabled, recorder]);

  return { micOk, listening };
}
