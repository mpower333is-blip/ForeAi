import Foundation
import CoreLocation

// Watch GPS via CoreLocation (when-in-use) for the rangefinder — mirrors the Wear
// OS LocationProvider.kt. Publishes the latest fix + horizontal accuracy (metres).
final class LocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    @Published var current: LatLng?
    @Published var accuracyM: Double?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 1 // metres
    }

    func start() {
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    func stop() { manager.stopUpdatingLocation() }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        current = LatLng(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
        accuracyM = loc.horizontalAccuracy >= 0 ? loc.horizontalAccuracy : nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Best-effort — a transient error just means no fresh fix; keep the last one.
    }
}
