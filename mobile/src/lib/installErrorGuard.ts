// Startup crash guard — capture an otherwise-fatal JS error during app launch
// and expose it, INSTEAD of letting React Native report it as fatal (which calls
// ExceptionsManager.reportFatalException → aborts the process on both iOS and
// Android, i.e. the "ForeAi keeps stopping" / instant-launch-crash we're chasing).
//
// This is imported FIRST in App.tsx so the handler is installed before other
// modules evaluate and before the provider tree mounts. It only intercepts the
// first fatal within a short STARTUP WINDOW; after that it restores React
// Native's normal behaviour, so ordinary runtime crash reporting later in the
// session is unchanged. A captured error is shown on-screen by CrashScreen so we
// can read the real message instead of a silent abort.

let captured: Error | null = null;
let notify: ((e: Error) => void) | null = null;

// How long after launch we treat a fatal as a "startup" crash worth showing.
const STARTUP_WINDOW_MS = 15000;
const startedAt = Date.now();

export function getStartupError(): Error | null {
  return captured;
}

export function onStartupError(fn: (e: Error) => void): void {
  notify = fn;
  if (captured) fn(captured);
}

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  try {
    return new Error(typeof e === "string" ? e : JSON.stringify(e));
  } catch {
    return new Error(String(e));
  }
}

try {
  const g = global as unknown as {
    ErrorUtils?: {
      setGlobalHandler?: (fn: (error: unknown, isFatal?: boolean) => void) => void;
      getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
    };
  };
  const EU = g.ErrorUtils;
  if (EU?.setGlobalHandler) {
    const prev = EU.getGlobalHandler?.();
    EU.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      const withinStartup = Date.now() - startedAt < STARTUP_WINDOW_MS;
      if (isFatal && withinStartup) {
        // Swallow the abort: capture the error and surface it on-screen instead.
        if (!captured) {
          captured = toError(error);
          try {
            notify?.(captured);
          } catch {}
        }
        return;
      }
      // Outside the startup window (or non-fatal): hand back to RN's default
      // handler so normal crash reporting is preserved.
      if (typeof prev === "function") {
        try {
          prev(error, isFatal);
        } catch {}
      }
    });
  }
} catch {}
