import Foundation
import CoreLocation
import Combine

// Location provider — a thin CLLocationManager wrapper publishing the latest fix
// as a LatLng, so the rangefinder can compute F/M/B to the green.
final class LocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    @Published var current: LatLng?
    @Published var accuracy: Double?
    @Published var authorized = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func start() {
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    func stop() { manager.stopUpdatingLocation() }

    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        let s = m.authorizationStatus
        authorized = (s == .authorizedWhenInUse || s == .authorizedAlways)
        if authorized { m.startUpdatingLocation() }
    }

    func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        current = LatLng(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
        accuracy = loc.horizontalAccuracy
    }
}

// Drives the watch round: connect to the event, remember which player this watch
// is, read live GPS distances, and enter per-hole scores that sync to the phones'
// leaderboard. Standalone — same behaviour as the Wear OS RoundViewModel.
@MainActor
final class RoundModel: ObservableObject {
    @Published var loading = true
    @Published var error: String?
    @Published var event: WEvent?
    @Published var myPlayerId: String? = UserDefaults.standard.string(forKey: "playerId")
    @Published var viewingHole = 1
    @Published var busy = false

    let location = LocationProvider()
    private var cancellables = Set<AnyCancellable>()

    init() {
        location.$current.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &cancellables)
        location.start()
        connect(Config.presetEventCode)
    }

    func connect(_ code: String) {
        loading = true
        error = nil
        Task {
            if let ev = await Api.eventByCode(code) {
                self.event = ev
                if let pid = self.myPlayerId {
                    self.viewingHole = ev.currentHole(pid)
                }
                self.error = nil
            } else {
                self.error = "Couldn't load the event. Check signal and try again."
            }
            self.loading = false
        }
    }

    func retry() { connect(Config.presetEventCode) }

    func choosePlayer(_ id: String) {
        myPlayerId = id
        UserDefaults.standard.set(id, forKey: "playerId")
        if let ev = event { viewingHole = ev.currentHole(id) }
    }

    var course: Course { Courses.forId(event?.courseId) }

    var hole: Hole {
        let holes = course.holes
        guard viewingHole >= 1, viewingHole <= holes.count else { return holes.first ?? Hole(1, 4, 360) }
        return holes[viewingHole - 1]
    }

    var distances: FMB {
        guard let me = location.current else { return FMB(front: nil, middle: nil, back: nil) }
        return rangefinder(from: me, hole: hole)
    }

    func prevHole() { if viewingHole > 1 { viewingHole -= 1 } }
    func nextHole() { if viewingHole < course.holes.count { viewingHole += 1 } }

    // The score this watch's player/team has for the hole being viewed.
    var myScore: Int? {
        guard let ev = event, let pid = myPlayerId else { return nil }
        return ev.score(ev.scoringId(for: pid), viewingHole)
    }

    var thru: Int {
        guard let ev = event, let pid = myPlayerId else { return 0 }
        return ev.thru(ev.scoringId(for: pid))
    }

    func setScore(_ strokes: Int) {
        guard let ev = event, let pid = myPlayerId, !busy else { return }
        busy = true
        Task {
            let updated = await Api.setScore(ev.id, playerId: ev.scoringId(for: pid), hole: viewingHole, strokes: strokes)
            if let updated = updated { self.event = updated }
            self.busy = false
        }
    }
}
