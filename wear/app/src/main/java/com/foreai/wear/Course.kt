package com.foreai.wear

// Course data bundled on the watch so it works fully offline: per-hole par and
// length (metres), plus green GPS once the course is surveyed. Distances to the
// green use the watch's own GPS against these green coordinates; until a course
// is surveyed the green coords are null and the watch shows the hole length.
//
// The Kempton Park card mirrors the phone app's scorecard (men's/white tee),
// converted to metres. Green coords are filled in from the on-site GPS survey.

data class WHole(
    val number: Int,
    val par: Int,
    val meters: Int,
    val green: LatLng? = null, // green centre (pin), when surveyed
    val greenFront: LatLng? = null,
    val greenBack: LatLng? = null,
)

data class WCourse(val id: String, val name: String, val holes: List<WHole>)

// Club bag with metre carries — matches the phone app's default bag.
data class WClub(val name: String, val meters: Int)

val DEFAULT_BAG: List<WClub> = listOf(
    WClub("Driver", 229),
    WClub("3 Wood", 210),
    WClub("5 Wood", 197),
    WClub("Hybrid", 183),
    WClub("4 Iron", 174),
    WClub("5 Iron", 165),
    WClub("6 Iron", 155),
    WClub("7 Iron", 144),
    WClub("8 Iron", 133),
    WClub("9 Iron", 121),
    WClub("PW", 108),
    WClub("GW", 91),
    WClub("SW", 75),
    WClub("LW", 57),
)

private val KEMPTON_PARK = WCourse(
    id = "kempton-park",
    name = "Kempton Park Golf Club",
    // Green coordinates from the on-course GPS survey (matches the phone app's
    // courseGps). Hole 1 also has front/back for a true F/M/B readout.
    holes = listOf(
        WHole(1, 5, 527, green = LatLng(-26.110071, 28.216514), greenFront = LatLng(-26.110011, 28.216410), greenBack = LatLng(-26.110126, 28.216595)),
        WHole(2, 4, 312, green = LatLng(-26.107831, 28.219363)),
        WHole(3, 4, 353, green = LatLng(-26.110642, 28.219272)),
        WHole(4, 4, 353, green = LatLng(-26.107499, 28.220178)),
        WHole(5, 3, 180, green = LatLng(-26.107282, 28.218124)),
        WHole(6, 4, 384, green = LatLng(-26.104632, 28.215785)),
        WHole(7, 4, 349, green = LatLng(-26.107703, 28.217346)),
        WHole(8, 5, 393, green = LatLng(-26.105514, 28.215114)),
        WHole(9, 3, 156, green = LatLng(-26.106920, 28.214374)),
        WHole(10, 4, 344, green = LatLng(-26.1002884, 28.2154995), greenFront = LatLng(-26.1004079, 28.215527), greenBack = LatLng(-26.1001979, 28.2155278)),
        WHole(11, 3, 114, green = LatLng(-26.100992, 28.2140412), greenFront = LatLng(-26.1009339, 28.2140891), greenBack = LatLng(-26.1011183, 28.2138881)),
        WHole(12, 5, 427, green = LatLng(-26.1040487, 28.2152608), greenFront = LatLng(-26.1038945, 28.2153297), greenBack = LatLng(-26.1041257, 28.215233)),
        WHole(13, 5, 411, green = LatLng(-26.104635, 28.220320)),
        WHole(14, 4, 320, green = LatLng(-26.102195, 28.218880)),
        WHole(15, 4, 384, green = LatLng(-26.100574, 28.216361)),
        WHole(16, 4, 327, green = LatLng(-26.102888, 28.218834)),
        WHole(17, 3, 161, green = LatLng(-26.103300, 28.216391)),
        WHole(18, 4, 360, green = LatLng(-26.106629, 28.213204)),
    ),
)


private val SERENGETI_MASAI = WCourse(
    id = "serengeti-masai",
    name = "Serengeti — Masai Mara (Signature)",
    // Par + metres from the club scorecard; green front/middle/back from the
    // on-course GPS survey (matches the phone app's courseGps).
    holes = listOf(
        WHole(1, 4, 364, green = LatLng(-26.044332, 28.29521), greenFront = LatLng(-26.044317, 28.295044), greenBack = LatLng(-26.044337, 28.295361)),
        WHole(2, 4, 272, green = LatLng(-26.042861, 28.297604), greenFront = LatLng(-26.042963, 28.297521), greenBack = LatLng(-26.042811, 28.297652)),
        WHole(3, 5, 503, green = LatLng(-26.048404, 28.299724), greenFront = LatLng(-26.048296, 28.29962), greenBack = LatLng(-26.048494, 28.299856)),
        WHole(4, 4, 363, green = LatLng(-26.051075, 28.297512), greenFront = LatLng(-26.050952, 28.29756), greenBack = LatLng(-26.051191, 28.297445)),
        WHole(5, 3, 153, green = LatLng(-26.051487, 28.295321), greenFront = LatLng(-26.051554, 28.295495), greenBack = LatLng(-26.051456, 28.295205)),
        WHole(6, 4, 364, green = LatLng(-26.048547, 28.291683), greenFront = LatLng(-26.048677, 28.29175), greenBack = LatLng(-26.048433, 28.291611)),
        WHole(7, 4, 385, green = LatLng(-26.047956, 28.295712), greenFront = LatLng(-26.048019, 28.295583), greenBack = LatLng(-26.047853, 28.2958)),
        WHole(8, 5, 420, green = LatLng(-26.045334, 28.291619), greenFront = LatLng(-26.045493, 28.291718), greenBack = LatLng(-26.045197, 28.291517)),
        WHole(9, 3, 179, green = LatLng(-26.043202, 28.291807)),
        WHole(10, 4, 340, green = LatLng(-26.040732, 28.29528), greenFront = LatLng(-26.040732, 28.295127), greenBack = LatLng(-26.040719, 28.295385)),
        WHole(11, 5, 464, green = LatLng(-26.035827, 28.295366), greenFront = LatLng(-26.035967, 28.295401), greenBack = LatLng(-26.035683, 28.295323)),
        WHole(12, 3, 181, green = LatLng(-26.036324, 28.292885), greenFront = LatLng(-26.036326, 28.293083), greenBack = LatLng(-26.036377, 28.292767)),
        WHole(13, 4, 400, green = LatLng(-26.03635, 28.288714), greenFront = LatLng(-26.03641, 28.2888), greenBack = LatLng(-26.036283, 28.288615)),
        WHole(14, 4, 263, green = LatLng(-26.035432, 28.292225), greenFront = LatLng(-26.035545, 28.292169), greenBack = LatLng(-26.03536, 28.292319)),
        WHole(15, 3, 129, green = LatLng(-26.034834, 28.29395), greenFront = LatLng(-26.035001, 28.293942), greenBack = LatLng(-26.034719, 28.29395)),
        WHole(16, 5, 507, green = LatLng(-26.03548, 28.288625), greenFront = LatLng(-26.035362, 28.28873), greenBack = LatLng(-26.035591, 28.288505)),
        WHole(17, 4, 302, green = LatLng(-26.037941, 28.287518), greenFront = LatLng(-26.037806, 28.287523), greenBack = LatLng(-26.038044, 28.287518)),
        WHole(18, 4, 406, green = LatLng(-26.041358, 28.291471)),
    ),
)

// Generic 18-hole par-72 fallback for a course we don't have a card for yet.
private fun genericCourse(id: String): WCourse {
    val pars = listOf(4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5)
    return WCourse(
        id = id,
        name = "Course",
        holes = pars.mapIndexed { i, p ->
            WHole(i + 1, p, if (p == 3) 155 else if (p == 5) 480 else 360)
        },
    )
}

object Courses {
    fun forId(id: String?): WCourse = when (id) {
        "kempton-park" -> KEMPTON_PARK
        "serengeti-masai" -> SERENGETI_MASAI
        else -> genericCourse(id ?: "course")
    }
}
