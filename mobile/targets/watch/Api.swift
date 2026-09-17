import Foundation

// Standalone networking for the watch — talks straight to the SAME Firestore
// store the phones and website use (project foreai-f9cfa), via the Firestore
// REST API over URLSession. No native Firebase SDK on the watch: reads are
// public (per the security rules) and writes carry an anonymous ID token from
// the Identity Toolkit REST endpoint. Mirrors the Wear OS Backend.kt design.
//
//   eventCodes/{CODE}          -> { eventId }
//   events/{id}                -> { name, courseId, format, shotgun }
//   events/{id}/players/{pid}  -> { name, groupId }
//   events/{id}/groups/{gid}   -> { order, createdAt }
//   events/{id}/scores/{pid_h} -> { playerId, hole, strokes }

enum Config {
    // Public client config (same values as the phone/website — safe to ship).
    static let projectId = "foreai-f9cfa"
    static let apiKey = "AIzaSyC38thYKR_HIL439l5_wF-I82OIgtTA_p0"
    static let presetEventCode = "3YG6JS" // ECS Golf Day
}

struct WPlayer: Identifiable { let id: String; let name: String; let groupId: String? }
struct WGroup: Identifiable { let id: String; let playerIds: [String] }

struct WEvent {
    let id: String
    let name: String
    let courseId: String
    let format: String      // "stroke" | "stableford" | "scramble"
    let shotgun: Bool
    let players: [WPlayer]
    let groups: [WGroup]
    let scores: [String: [Int: Int]] // scores[playerId][hole] = strokes

    func group(of playerId: String) -> WGroup? {
        groups.first { $0.playerIds.contains(playerId) }
    }

    // A scramble team's single card lives under its captain (first player added).
    func scoringId(for playerId: String) -> String {
        if format != "scramble" { return playerId }
        return group(of: playerId)?.playerIds.first ?? playerId
    }

    func thru(_ scoringId: String) -> Int { scores[scoringId]?.count ?? 0 }
    func score(_ scoringId: String, _ hole: Int) -> Int? { scores[scoringId]?[hole] }

    // Hole this player/team is currently on (shotgun- and format-aware). 18 = done.
    func currentHole(_ playerId: String) -> Int {
        let sid = scoringId(for: playerId)
        let done = thru(sid)
        if done >= 18 { return 18 }
        if shotgun {
            let idx = max(0, groups.firstIndex { $0.id == group(of: playerId)?.id } ?? 0)
            let start = (idx % 18) + 1
            return ((start - 1 + done) % 18) + 1
        }
        return done + 1
    }
}

enum Api {
    private static let fsBase =
        "https://firestore.googleapis.com/v1/projects/\(Config.projectId)/databases/(default)/documents"

    // Cached anonymous ID token for writes (reads are public).
    private static var idToken: String?

    // MARK: Firestore value helpers ------------------------------------------
    private static func str(_ field: Any?) -> String? {
        (field as? [String: Any])?["stringValue"] as? String
    }
    private static func int(_ field: Any?) -> Int? {
        guard let f = field as? [String: Any] else { return nil }
        if let s = f["integerValue"] as? String { return Int(s) }
        if let n = f["integerValue"] as? NSNumber { return n.intValue }
        if let d = f["doubleValue"] as? NSNumber { return d.intValue }
        return nil
    }
    private static func bool(_ field: Any?) -> Bool {
        ((field as? [String: Any])?["booleanValue"] as? Bool) ?? false
    }
    private static func docId(_ name: String) -> String {
        String(name.split(separator: "/").last ?? "")
    }

    // MARK: HTTP -------------------------------------------------------------
    private static func getJSON(_ url: String) async -> [String: Any]? {
        guard let u = URL(string: url) else { return nil }
        do {
            let (data, resp) = try await URLSession.shared.data(from: u)
            guard (resp as? HTTPURLResponse)?.statusCode ?? 500 < 300 else { return nil }
            return try JSONSerialization.jsonObject(with: data) as? [String: Any]
        } catch { return nil }
    }

    private static func ensureToken() async -> String? {
        if let t = idToken { return t }
        let url = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=\(Config.apiKey)"
        guard let u = URL(string: url) else { return nil }
        var req = URLRequest(url: u)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["returnSecureToken": true])
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            idToken = obj?["idToken"] as? String
            return idToken
        } catch { return nil }
    }

    // MARK: Public API -------------------------------------------------------
    static func eventByCode(_ code: String) async -> WEvent? {
        let key = code.trimmingCharacters(in: .whitespaces).uppercased()
        guard let doc = await getJSON("\(fsBase)/eventCodes/\(key)"),
              let eid = str((doc["fields"] as? [String: Any])?["eventId"]) else { return nil }
        return await assemble(eid)
    }

    static func refresh(_ eventId: String) async -> WEvent? {
        await assemble(eventId)
    }

    private static func list(_ eventId: String, _ sub: String) async -> [[String: Any]] {
        let obj = await getJSON("\(fsBase)/events/\(eventId)/\(sub)?pageSize=300")
        return (obj?["documents"] as? [[String: Any]]) ?? []
    }

    private static func assemble(_ eventId: String) async -> WEvent? {
        guard let meta = await getJSON("\(fsBase)/events/\(eventId)") else { return nil }
        let mf = (meta["fields"] as? [String: Any]) ?? [:]

        let playerDocs = await list(eventId, "players")
        let groupDocs = await list(eventId, "groups")
        let scoreDocs = await list(eventId, "scores")

        let players: [WPlayer] = playerDocs.map { d in
            let f = (d["fields"] as? [String: Any]) ?? [:]
            let gid = str(f["groupId"])
            return WPlayer(id: docId(d["name"] as? String ?? ""),
                           name: str(f["name"]) ?? "",
                           groupId: (gid?.isEmpty ?? true) ? nil : gid)
        }

        let sortedGroups = groupDocs.sorted { a, b in
            let fa = (a["fields"] as? [String: Any]) ?? [:]
            let fb = (b["fields"] as? [String: Any]) ?? [:]
            let oa = int(fa["order"]) ?? 0, ob = int(fb["order"]) ?? 0
            if oa != ob { return oa < ob }
            return (a["name"] as? String ?? "") < (b["name"] as? String ?? "")
        }
        let groups: [WGroup] = sortedGroups.map { d in
            let gid = docId(d["name"] as? String ?? "")
            return WGroup(id: gid, playerIds: players.filter { $0.groupId == gid }.map { $0.id })
        }

        var scores: [String: [Int: Int]] = [:]
        for d in scoreDocs {
            let f = (d["fields"] as? [String: Any]) ?? [:]
            guard let pid = str(f["playerId"]), let h = int(f["hole"]), let s = int(f["strokes"]) else { continue }
            scores[pid, default: [:]][h] = s
        }

        return WEvent(
            id: eventId,
            name: str(mf["name"]) ?? "Golf Day",
            courseId: str(mf["courseId"]) ?? "",
            format: str(mf["format"]) ?? "stroke",
            shotgun: bool(mf["shotgun"]),
            players: players,
            groups: groups,
            scores: scores
        )
    }

    // Write a hole score to the shared leaderboard. Returns the refreshed event.
    @discardableResult
    static func setScore(_ eventId: String, playerId: String, hole: Int, strokes: Int) async -> WEvent? {
        guard let token = await ensureToken() else { return nil }
        let docPath = "\(fsBase)/events/\(eventId)/scores/\(playerId)_\(hole)"
        guard let u = URL(string: docPath) else { return nil }
        var req = URLRequest(url: u)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if strokes <= 0 {
            req.httpMethod = "DELETE"
        } else {
            req.httpMethod = "PATCH"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let ms = Int(Date().timeIntervalSince1970 * 1000)
            let body: [String: Any] = ["fields": [
                "playerId": ["stringValue": playerId],
                "hole": ["integerValue": String(hole)],
                "strokes": ["integerValue": String(strokes)],
                "updatedAt": ["integerValue": String(ms)],
            ]]
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        _ = try? await URLSession.shared.data(for: req)
        return await assemble(eventId)
    }
}
