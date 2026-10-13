import type { PanelWeather } from "../services/weather";

// Fail-soft, lazily-loaded access to the lightning safety plumbing.
//
// lib/lightningBackground and lib/lightningAlarm pull in expo-task-manager and
// expo-notifications, and BOTH construct a NATIVE event emitter at module scope
// (expo-task-manager/build/TaskManager.js and expo-notifications' emitters do
// `new LegacyEventEmitter(...)` + addListener on import). On iOS 26/27 under the
// New Architecture a native (void) method that throws an NSException during the
// fragile app-launch window aborts the whole process — ObjCTurboModule::
// performVoidMethodInvocation → objc_exception_rethrow → SIGABRT (React Native
// issue #54859; the iPad/iPadOS 27 crash seen on ForeAi 1.7 build 29).
//
// Routing every consumer through these wrappers keeps those native modules OUT
// of the STATIC startup import graph (App.tsx statically imports HomeScreen →
// WeatherPanel → useLightning, PlayScreen and ProfileScreen, all of which used
// to pull these in). They now load lazily on first actual use — inside an
// effect, after mount, past the launch window — and a load/registration failure
// can never take the app down (the foreground weather + alarm path keeps
// working). The background task is still registered for headless launches by the
// deferred require in App.tsx.

type BgModule = typeof import("./lightningBackground");
type AlarmModule = typeof import("./lightningAlarm");

function bg(): BgModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./lightningBackground") as BgModule;
  } catch {
    return null;
  }
}

function alarm(): AlarmModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./lightningAlarm") as AlarmModule;
  } catch {
    return null;
  }
}

// Every wrapper swallows both a failed module load (`?.`) and a rejected promise
// (`?.catch`), so no call site can crash the app or leak an unhandled rejection.

export function startRoundLightningWatch(): void {
  try {
    bg()?.startRoundLightningWatch()?.catch?.(() => {});
  } catch {}
}

export function stopRoundLightningWatch(): void {
  try {
    bg()?.stopRoundLightningWatch()?.catch?.(() => {});
  } catch {}
}

export function registerLightningBackground(): void {
  try {
    bg()?.registerLightningBackground()?.catch?.(() => {});
  } catch {}
}

export function unregisterLightningBackground(): void {
  try {
    bg()?.unregisterLightningBackground()?.catch?.(() => {});
  } catch {}
}

export function saveLastCoord(coord: { lat: number; lng: number }): void {
  try {
    bg()?.saveLastCoord(coord)?.catch?.(() => {});
  } catch {}
}

export function initLightningAlarm(): void {
  try {
    alarm()?.initLightningAlarm()?.catch?.(() => {});
  } catch {}
}

export function maybeLightningAlarm(wx: PanelWeather): void {
  try {
    alarm()?.maybeLightningAlarm(wx)?.catch?.(() => {});
  } catch {}
}
