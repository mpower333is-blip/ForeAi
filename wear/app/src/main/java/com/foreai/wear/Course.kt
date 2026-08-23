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
    holes = listOf(
        WHole(1, 5, 527), WHole(2, 4, 312), WHole(3, 4, 353),
        WHole(4, 4, 353), WHole(5, 3, 180), WHole(6, 4, 384),
        WHole(7, 4, 349), WHole(8, 5, 393), WHole(9, 3, 156),
        WHole(10, 4, 344), WHole(11, 3, 114), WHole(12, 5, 427),
        WHole(13, 5, 411), WHole(14, 4, 320), WHole(15, 4, 384),
        WHole(16, 4, 327), WHole(17, 3, 161), WHole(18, 4, 360),
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
        else -> genericCourse(id ?: "course")
    }
}
