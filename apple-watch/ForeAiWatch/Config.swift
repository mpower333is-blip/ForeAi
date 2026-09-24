import Foundation

// Build-time configuration for the Kempton Park Golf Apple Watch app.
//
// This mirrors the Wear OS build's env vars (WEAR_COURSE_ID / WEAR_EVENT_CODE /
// WEAR_STATUS_URL). For a single club (Kempton) they're hardcoded here; to reuse
// this target for another club, change these three values (ideally read them from
// Info.plist / an .xcconfig per scheme, the way the Android build reads env vars).
enum Config {
    // The bundled course shown standalone (no backend). Empty -> generic card.
    static let defaultCourseId = "kempton-park"

    // Optional live scoring event. Empty -> pure standalone rangefinder, the watch
    // never posts scores. (Kempton has no live scoring backend, so it's empty.)
    static let presetEventCode = ""
    static var hasEvent: Bool { !presetEventCode.isEmpty }

    // Public on-wrist snapshot (lightning level + next tee times), read straight
    // from the Firestore REST API. Written every 15 min by the clubLightningWatch
    // Cloud Function. The key is the project's public Web API key (safe to embed);
    // Firestore rules expose only clubs/*/public/* for read. Empty -> extras hidden.
    static let statusURL = "https://firestore.googleapis.com/v1/projects/foreai-f9cfa/databases/(default)/documents/clubs/kempton/public/watch?key=AIzaSyC38thYKR_HIL439l5_wF-I82OIgtTA_p0"
    static var hasStatus: Bool { !statusURL.isEmpty }

    static let clubName = "Kempton Park"
}
