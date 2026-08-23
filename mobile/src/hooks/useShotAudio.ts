import { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";

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

  useEffect(() => {
    if (!enabled) {
      setListening(false);
      return;
    }
    let cancelled = false;
    let recording: Audio.Recording | null = null;
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

    const startOne = async () => {
      const rec = new Audio.Recording();
      const opts: any = {
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      };
      await rec.prepareToRecordAsync(opts);
      rec.setProgressUpdateInterval(UPDATE_MS);
      rec.setOnRecordingStatusUpdate((s) => {
        if (s.isRecording && typeof s.metering === "number") handleLevel(s.metering);
      });
      await rec.startAsync();
      return rec;
    };

    (async () => {
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) {
          setMicOk(false);
          return;
        }
        setMicOk(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        recording = await startOne();
        if (cancelled) return;
        setListening(true);

        // Recycle the recording so its backing file stays tiny over a full round.
        recycleTimer = setInterval(async () => {
          try {
            const old = recording;
            recording = await startOne();
            await old?.stopAndUnloadAsync();
          } catch {
            // if a recycle fails, keep the old recording running
          }
        }, RECYCLE_MS);
      } catch {
        if (!cancelled) setMicOk(false);
      }
    })();

    return () => {
      cancelled = true;
      setListening(false);
      if (recycleTimer) clearInterval(recycleTimer);
      recording?.stopAndUnloadAsync().catch(() => {});
    };
  }, [enabled]);

  return { micOk, listening };
}
