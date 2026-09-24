import Foundation

// On-wrist extras from the club's public Firestore snapshot doc (mirrors the Wear
// OS WLightning / WTee / WStatus).
struct WLightning {
    let level: String   // "approaching" | "overhead"
    let body: String?
}

struct WTee: Identifiable {
    let id = UUID()
    let teeMs: Int64
    let timeLabel: String
    let names: [String]
    let party: Int
}

struct WStatus {
    let lightning: WLightning?
    let teeTimes: [WTee]
}
