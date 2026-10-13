// Lazily load expo-notifications.
//
// Importing expo-notifications eagerly evaluates its module scope, which
// constructs NATIVE event emitters (build/NotificationsEmitter.js and
// build/NotificationsHandler.js each do `new LegacyEventEmitter(...)` at module
// scope) — i.e. the mere import touches the native notifications module.
//
// On iOS 26/27 under the New Architecture, if ANY native (void) method throws an
// NSException during the fragile app-launch window, the whole process aborts
// immediately — ObjCTurboModule::performVoidMethodInvocation → objc_exception_
// rethrow → SIGABRT, ~150 ms after launch, before any UI (React Native issue
// #54859; seen in the iPad/iPadOS 27 crash logs for ForeAi 1.7 build 29).
//
// Keeping this require() out of the STATIC startup import graph means the native
// touch happens lazily — on first actual use, inside an effect, after mount, and
// well past the launch window. Returns null if the module can't be loaded so
// callers degrade gracefully (the foreground local alarm path still works).
export type NotificationsModule = typeof import("expo-notifications");

export function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}
