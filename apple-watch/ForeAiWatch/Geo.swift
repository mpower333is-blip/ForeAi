import Foundation

// Minimal geo helpers for the watch rangefinder. Distances are in METRES to match
// the phone + Wear OS apps (South African golfers play in metres). Ported from
// the Wear OS Geo.kt (same haversine, same rounding).

struct LatLng: Equatable {
    let lat: Double
    let lng: Double
}

private let earthRadiusM = 6_371_000.0

func haversineMeters(_ a: LatLng, _ b: LatLng) -> Double {
    let dLat = (b.lat - a.lat) * .pi / 180
    let dLng = (b.lng - a.lng) * .pi / 180
    let lat1 = a.lat * .pi / 180
    let lat2 = b.lat * .pi / 180
    let h = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
    return 2 * earthRadiusM * asin(min(1.0, sqrt(h)))
}

func distanceMeters(_ a: LatLng, _ b: LatLng) -> Int {
    Int(haversineMeters(a, b).rounded())
}
