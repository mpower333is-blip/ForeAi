import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Coord } from "../lib/geo";

export type LocationState = {
  coord: Coord | null;
  accuracy: number | null; // metres
  status: "idle" | "requesting" | "granted" | "denied" | "unavailable";
  request: () => void;
};

// Watches the device's foreground position and exposes the latest fix.
export function useLocation(): LocationState {
  const [coord, setCoord] = useState<Coord | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationState["status"]>("idle");
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const [tick, setTick] = useState(0); // bump to (re)request

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("requesting");
      try {
        const services = await Location.hasServicesEnabledAsync().catch(() => true);
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm !== "granted") {
          setStatus("denied");
          return;
        }
        if (!services) setStatus("unavailable");
        else setStatus("granted");

        subRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 },
          (pos) => {
            if (cancelled) return;
            setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setAccuracy(pos.coords.accuracy ?? null);
          }
        );
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [tick]);

  return { coord, accuracy, status, request: () => setTick((t) => t + 1) };
}
