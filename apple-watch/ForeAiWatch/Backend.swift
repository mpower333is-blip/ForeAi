import Foundation

// Reads the club's public on-wrist snapshot (lightning level + next tee times)
// straight from Firestore over its REST API — the same clubs/<club>/public/watch
// doc the Wear OS app reads. The doc stores the payload as a single JSON string in
// a `json` field, so we unwrap fields.json.stringValue and parse the inner JSON —
// no need to decode Firestore's per-field value wrappers. Any failure returns nil
// and the watch stays a plain rangefinder. No Cloud Function, so no extra IAM.
enum Backend {
    static func status() async -> WStatus? {
        guard Config.hasStatus, let url = URL(string: Config.statusURL) else { return nil }
        do {
            var req = URLRequest(url: url)
            req.timeoutInterval = 20
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
            guard
                let doc = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let fields = doc["fields"] as? [String: Any],
                let jsonField = fields["json"] as? [String: Any],
                let inner = jsonField["stringValue"] as? String,
                let innerData = inner.data(using: .utf8),
                let payload = try JSONSerialization.jsonObject(with: innerData) as? [String: Any]
            else { return nil }
            return parse(payload)
        } catch {
            return nil
        }
    }

    private static func parse(_ o: [String: Any]) -> WStatus {
        var lightning: WLightning?
        if let lo = o["lightning"] as? [String: Any],
           let level = lo["level"] as? String, !level.isEmpty, level != "null" {
            lightning = WLightning(level: level, body: lo["body"] as? String)
        }

        var tees: [WTee] = []
        if let arr = o["teeTimes"] as? [[String: Any]] {
            for t in arr {
                let ms = int64(t["teeMs"])
                guard ms > 0 else { continue }
                let names = (t["names"] as? [Any])?.compactMap { $0 as? String } ?? []
                let party = Int(int64(t["party"]))
                tees.append(WTee(
                    teeMs: ms,
                    timeLabel: teeLabel(ms),
                    names: names,
                    party: party > 0 ? party : max(names.count, 1)
                ))
            }
        }
        return WStatus(lightning: lightning, teeTimes: tees)
    }

    // JSON numbers from Firestore/JSONSerialization arrive as NSNumber; be lenient.
    private static func int64(_ v: Any?) -> Int64 {
        if let n = v as? NSNumber { return n.int64Value }
        if let s = v as? String, let n = Int64(s) { return n }
        return 0
    }

    // Club runs on SAST; format tee times in that zone whatever the watch's own tz.
    private static let sast = TimeZone(identifier: "Africa/Johannesburg")!
    private static func teeLabel(_ ms: Int64) -> String {
        let date = Date(timeIntervalSince1970: Double(ms) / 1000.0)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = sast

        let hhmm = DateFormatter()
        hhmm.timeZone = sast
        hhmm.locale = Locale(identifier: "en_GB")
        hhmm.dateFormat = "HH:mm"

        let dow = DateFormatter()
        dow.timeZone = sast
        dow.locale = Locale(identifier: "en_GB")
        dow.dateFormat = "EEE"

        let today = cal.startOfDay(for: Date())
        let day = cal.startOfDay(for: date)
        let dayDiff = cal.dateComponents([.day], from: today, to: day).day ?? 99
        let whenLabel: String
        switch dayDiff {
        case 0: whenLabel = "Today"
        case 1: whenLabel = "Tomorrow"
        default: whenLabel = dow.string(from: date)
        }
        return "\(whenLabel) \(hhmm.string(from: date))"
    }
}
