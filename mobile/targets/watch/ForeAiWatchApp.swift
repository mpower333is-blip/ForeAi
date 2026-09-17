import SwiftUI

// Entry point for the ForeAi Apple Watch app — a standalone watchOS companion
// (GPS rangefinder + on-wrist scoring that syncs to the same live leaderboard as
// the phones, via Firestore). See targets/watch/README.md.
@main
struct ForeAiWatchApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
