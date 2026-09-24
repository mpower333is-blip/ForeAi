import Foundation

// Course data bundled on the watch so the rangefinder works fully offline: per-hole
// par and length (metres) plus green GPS (front/middle/back). Ported verbatim from
// the Wear OS Course.kt so the two watches read identical coordinates.

struct WHole {
    let number: Int
    let par: Int
    let meters: Int
    let green: LatLng?
    let greenFront: LatLng?
    let greenBack: LatLng?
    init(_ number: Int, _ par: Int, _ meters: Int,
         green: LatLng? = nil, greenFront: LatLng? = nil, greenBack: LatLng? = nil) {
        self.number = number; self.par = par; self.meters = meters
        self.green = green; self.greenFront = greenFront; self.greenBack = greenBack
    }
}

struct WCourse { let id: String; let name: String; let holes: [WHole] }

struct WClub { let name: String; let meters: Int }

// Club bag with metre carries — matches the phone + Wear OS default bag.
let defaultBag: [WClub] = [
    WClub(name: "Driver", meters: 229),
    WClub(name: "3 Wood", meters: 210),
    WClub(name: "5 Wood", meters: 197),
    WClub(name: "Hybrid", meters: 183),
    WClub(name: "4 Iron", meters: 174),
    WClub(name: "5 Iron", meters: 165),
    WClub(name: "6 Iron", meters: 155),
    WClub(name: "7 Iron", meters: 144),
    WClub(name: "8 Iron", meters: 133),
    WClub(name: "9 Iron", meters: 121),
    WClub(name: "PW", meters: 108),
    WClub(name: "GW", meters: 91),
    WClub(name: "SW", meters: 75),
    WClub(name: "LW", meters: 57),
]

private let kemptonPark = WCourse(
    id: "kempton-park",
    name: "Kempton Park Golf Club",
    holes: [
        WHole(1, 5, 527, green: LatLng(lat: -26.110071, lng: 28.216514), greenFront: LatLng(lat: -26.110011, lng: 28.216410), greenBack: LatLng(lat: -26.110126, lng: 28.216595)),
        WHole(2, 4, 312, green: LatLng(lat: -26.107831, lng: 28.219363)),
        WHole(3, 4, 353, green: LatLng(lat: -26.110642, lng: 28.219272)),
        WHole(4, 4, 353, green: LatLng(lat: -26.107499, lng: 28.220178)),
        WHole(5, 3, 180, green: LatLng(lat: -26.107282, lng: 28.218124)),
        WHole(6, 4, 384, green: LatLng(lat: -26.104632, lng: 28.215785)),
        WHole(7, 4, 349, green: LatLng(lat: -26.107703, lng: 28.217346)),
        WHole(8, 5, 393, green: LatLng(lat: -26.105514, lng: 28.215114)),
        WHole(9, 3, 156, green: LatLng(lat: -26.106920, lng: 28.214374)),
        WHole(10, 4, 344, green: LatLng(lat: -26.1002884, lng: 28.2154995), greenFront: LatLng(lat: -26.1004079, lng: 28.215527), greenBack: LatLng(lat: -26.1001979, lng: 28.2155278)),
        WHole(11, 3, 114, green: LatLng(lat: -26.100992, lng: 28.2140412), greenFront: LatLng(lat: -26.1009339, lng: 28.2140891), greenBack: LatLng(lat: -26.1011183, lng: 28.2138881)),
        WHole(12, 5, 427, green: LatLng(lat: -26.1040487, lng: 28.2152608), greenFront: LatLng(lat: -26.1038945, lng: 28.2153297), greenBack: LatLng(lat: -26.1041257, lng: 28.215233)),
        WHole(13, 5, 411, green: LatLng(lat: -26.104635, lng: 28.220320)),
        WHole(14, 4, 320, green: LatLng(lat: -26.102195, lng: 28.218880)),
        WHole(15, 4, 384, green: LatLng(lat: -26.100574, lng: 28.216361)),
        WHole(16, 4, 327, green: LatLng(lat: -26.102888, lng: 28.218834)),
        WHole(17, 3, 161, green: LatLng(lat: -26.103300, lng: 28.216391)),
        WHole(18, 4, 360, green: LatLng(lat: -26.106629, lng: 28.213204)),
    ]
)

// Generic 18-hole par-72 fallback for a course without a bundled card.
private func genericCourse(_ id: String) -> WCourse {
    let pars = [4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5]
    let holes = pars.enumerated().map { (i, p) in
        WHole(i + 1, p, p == 3 ? 155 : (p == 5 ? 480 : 360))
    }
    return WCourse(id: id, name: "Course", holes: holes)
}

enum Courses {
    static func forId(_ id: String?) -> WCourse {
        switch id {
        case "kempton-park": return kemptonPark
        default: return genericCourse(id ?? "course")
        }
    }
}
