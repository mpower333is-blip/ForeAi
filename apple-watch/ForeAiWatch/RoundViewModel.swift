import Foundation
import WatchKit

// Drives the watch experience — mirrors the Wear OS RoundViewModel.kt for the
// standalone build: pick the bundled course, read GPS distances to the green, pick
// a club, navigate holes, and poll the club's public snapshot for the lightning
// alarm + next tee times. (Live scoring is omitted here because Kempton has no
// event backend — presetEventCode is empty; add it later mirroring Backend.kt.)
@MainActor
final class RoundViewModel: ObservableObject {
    @Published var viewingHole = 1
    @Published var selectedClub: String?

    // On-wrist extras from the club's public Firestore snapshot doc.
    @Published var lightning: WLightning?
    @Published var teeTimes: [WTee] = []
    @Published var lightningDismissed = false
    private var lastLightningLevel: String?

    let hasStatus = Config.hasStatus

    // Show the full-screen alarm when a fresh alert is active and not yet dismissed.
    var showLightning: Bool { lightning != nil && !lightningDismissed }

    private let course = Courses.forId(Config.defaultCourseId.isEmpty ? nil : Config.defaultCourseId)

    func holeInfo() -> WHole {
        let holes = course.holes
        if viewingHole - 1 >= 0 && viewingHole - 1 < holes.count { return holes[viewingHole - 1] }
        return holes.first ?? WHole(1, 4, 360)
    }

    struct Dist { let front: Int?; let mid: Int?; let back: Int?; let hasGps: Bool }

    // Front / middle / back distances (metres) from the current fix to the green,
    // or hasGps=false when the course has no green GPS or there's no fix yet.
    func distances(from here: LatLng?) -> Dist {
        let h = holeInfo()
        let pin = h.green ?? h.greenFront ?? h.greenBack
        guard let here = here, let pin = pin else {
            return Dist(front: nil, mid: nil, back: nil, hasGps: pin != nil)
        }
        return Dist(
            front: h.greenFront.map { distanceMeters(here, $0) },
            mid: distanceMeters(here, h.green ?? pin),
            back: h.greenBack.map { distanceMeters(here, $0) },
            hasGps: true
        )
    }

    func prevHole() { if viewingHole > 1 { viewingHole -= 1 } }
    func nextHole() { if viewingHole < 18 { viewingHole += 1 } }
    func selectClub(_ name: String) { selectedClub = name }
    func dismissLightning() { lightningDismissed = true }

    // Poll the public status doc every 2 min for the lightning level + tee times.
    // Best-effort: any failure leaves the last values and retries.
    func startPolling() {
        guard hasStatus else { return }
        Task { [weak self] in
            while !Task.isCancelled {
                if let s = await Backend.status() {
                    await MainActor.run { self?.apply(s) }
                }
                try? await Task.sleep(nanoseconds: 120_000_000_000) // 2 minutes
            }
        }
    }

    private func apply(_ s: WStatus) {
        teeTimes = s.teeTimes
        let lv = s.lightning
        if let lv = lv, lv.level != lastLightningLevel {
            // New alert or escalation (approaching -> overhead): re-surface + buzz.
            lightningDismissed = false
            WKInterfaceDevice.current().play(lv.level == "overhead" ? .failure : .notification)
        }
        if lv == nil { lightningDismissed = false }
        lightning = lv
        lastLightningLevel = lv?.level
    }
}
