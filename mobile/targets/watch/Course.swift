import Foundation

// Course data bundled on the watch so the rangefinder works fully offline:
// per-hole par + length (metres) and surveyed green coordinates. Ported from the
// Wear OS app's Course.kt / Geo.kt so both watches behave identically.

struct LatLng: Equatable {
    let lat: Double
    let lng: Double
}

struct Hole {
    let number: Int
    let par: Int
    let meters: Int
    let green: LatLng?
    let greenFront: LatLng?
    let greenBack: LatLng?

    init(_ number: Int, _ par: Int, _ meters: Int,
         green: LatLng? = nil, greenFront: LatLng? = nil, greenBack: LatLng? = nil) {
        self.number = number
        self.par = par
        self.meters = meters
        self.green = green
        self.greenFront = greenFront
        self.greenBack = greenBack
    }
}

struct Course {
    let id: String
    let name: String
    let holes: [Hole]
}

struct Club {
    let name: String
    let meters: Int
}

// Club bag with metre carries — matches the phone app's default bag.
let DEFAULT_BAG: [Club] = [
    Club(name: "Driver", meters: 229),
    Club(name: "3 Wood", meters: 210),
    Club(name: "5 Wood", meters: 197),
    Club(name: "Hybrid", meters: 183),
    Club(name: "4 Iron", meters: 174),
    Club(name: "5 Iron", meters: 165),
    Club(name: "6 Iron", meters: 155),
    Club(name: "7 Iron", meters: 144),
    Club(name: "8 Iron", meters: 133),
    Club(name: "9 Iron", meters: 121),
    Club(name: "PW", meters: 108),
    Club(name: "GW", meters: 91),
    Club(name: "SW", meters: 75),
    Club(name: "LW", meters: 57),
]

private let KEMPTON_PARK = Course(
    id: "kempton-park",
    name: "Kempton Park Golf Club",
    holes: [
        Hole(1, 5, 527, green: LatLng(lat: -26.110071, lng: 28.216514), greenFront: LatLng(lat: -26.110011, lng: 28.216410), greenBack: LatLng(lat: -26.110126, lng: 28.216595)),
        Hole(2, 4, 312, green: LatLng(lat: -26.107831, lng: 28.219363)),
        Hole(3, 4, 353, green: LatLng(lat: -26.110642, lng: 28.219272)),
        Hole(4, 4, 353, green: LatLng(lat: -26.107499, lng: 28.220178)),
        Hole(5, 3, 180, green: LatLng(lat: -26.107282, lng: 28.218124)),
        Hole(6, 4, 384, green: LatLng(lat: -26.104632, lng: 28.215785)),
        Hole(7, 4, 349, green: LatLng(lat: -26.107703, lng: 28.217346)),
        Hole(8, 5, 393, green: LatLng(lat: -26.105514, lng: 28.215114)),
        Hole(9, 3, 156, green: LatLng(lat: -26.106920, lng: 28.214374)),
        Hole(10, 4, 344, green: LatLng(lat: -26.1002884, lng: 28.2154995), greenFront: LatLng(lat: -26.1004079, lng: 28.215527), greenBack: LatLng(lat: -26.1001979, lng: 28.2155278)),
        Hole(11, 3, 114, green: LatLng(lat: -26.100992, lng: 28.2140412), greenFront: LatLng(lat: -26.1009339, lng: 28.2140891), greenBack: LatLng(lat: -26.1011183, lng: 28.2138881)),
        Hole(12, 5, 427, green: LatLng(lat: -26.1040487, lng: 28.2152608), greenFront: LatLng(lat: -26.1038945, lng: 28.2153297), greenBack: LatLng(lat: -26.1041257, lng: 28.215233)),
        Hole(13, 5, 411, green: LatLng(lat: -26.104635, lng: 28.220320)),
        Hole(14, 4, 320, green: LatLng(lat: -26.102195, lng: 28.218880)),
        Hole(15, 4, 384, green: LatLng(lat: -26.100574, lng: 28.216361)),
        Hole(16, 4, 327, green: LatLng(lat: -26.102888, lng: 28.218834)),
        Hole(17, 3, 161, green: LatLng(lat: -26.103300, lng: 28.216391)),
        Hole(18, 4, 360, green: LatLng(lat: -26.106629, lng: 28.213204)),
    ]
)

private func genericCourse(_ id: String) -> Course {
    let pars = [4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5]
    let holes = pars.enumerated().map { (i, p) -> Hole in
        Hole(i + 1, p, p == 3 ? 155 : (p == 5 ? 480 : 360))
    }
    return Course(id: id, name: "Course", holes: holes)
}

enum Courses {
    static func forId(_ id: String?) -> Course {
        switch id {
        case "kempton-park": return KEMPTON_PARK
        default: return genericCourse(id ?? "course")
        }
    }
}

// --- Geo (metres, to match the phone app) ----------------------------------
private let EARTH_RADIUS_M = 6_371_000.0

func haversineMeters(_ a: LatLng, _ b: LatLng) -> Double {
    let dLat = (b.lat - a.lat) * .pi / 180
    let dLng = (b.lng - a.lng) * .pi / 180
    let lat1 = a.lat * .pi / 180
    let lat2 = b.lat * .pi / 180
    let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
    return 2 * EARTH_RADIUS_M * asin(min(1.0, sqrt(h)))
}

func distanceMeters(_ a: LatLng, _ b: LatLng) -> Int {
    Int(haversineMeters(a, b).rounded())
}

// Front / Middle / Back distances to the green for a hole from the player's
// position. Middle always comes from the green centre; front/back fall back to
// the centre when a hole wasn't surveyed with front/back points.
struct FMB {
    let front: Int?
    let middle: Int?
    let back: Int?
}

func rangefinder(from me: LatLng, hole: Hole) -> FMB {
    guard let mid = hole.green else { return FMB(front: nil, middle: nil, back: nil) }
    let middle = distanceMeters(me, mid)
    let front = hole.greenFront.map { distanceMeters(me, $0) }
    let back = hole.greenBack.map { distanceMeters(me, $0) }
    return FMB(front: front, middle: middle, back: back)
}
