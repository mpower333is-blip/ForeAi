package com.foreai.wear

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

// Drives the watch experience: connect to the event, remember which player this
// watch is, enter per-hole scores that sync to the phones' leaderboard, and —
// Stage 2 — pick your club and read live GPS distances to the green.
class RoundViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs = app.getSharedPreferences("foreai_wear", 0)
    private val location = LocationProvider(app)

    var loading by mutableStateOf(true); private set
    var error by mutableStateOf<String?>(null); private set
    var event by mutableStateOf<WEvent?>(null); private set
    var myPlayerId by mutableStateOf<String?>(prefs.getString("playerId", null)); private set
    var viewingHole by mutableStateOf(1); private set
    var busy by mutableStateOf(false); private set

    // Stage 2 state.
    var selectedClub by mutableStateOf(prefs.getString("club", null)); private set
    var currentLoc by mutableStateOf<LatLng?>(null); private set
    var accuracyM by mutableStateOf<Float?>(null); private set
    var locationOn by mutableStateOf(false); private set

    init {
        connect(Config.PRESET_EVENT_CODE)
    }

    // The bundled card for the event's course.
    private fun course(): WCourse = Courses.forId(event?.courseId)

    fun holeInfo(): WHole {
        val holes = course().holes
        return holes.getOrNull(viewingHole - 1) ?: holes.first()
    }

    // Front / middle / back distances (metres) from the current fix to the green,
    // or null when the course has no green GPS yet (survey pending) or no fix.
    data class Dist(val front: Int?, val mid: Int?, val back: Int?, val hasGps: Boolean)

    fun distances(): Dist {
        val h = holeInfo()
        val here = currentLoc
        val pin = h.green ?: h.greenFront ?: h.greenBack
        if (here == null || pin == null) return Dist(null, null, null, hasGps = pin != null)
        return Dist(
            front = h.greenFront?.let { distanceMeters(here, it) },
            mid = (h.green ?: pin).let { distanceMeters(here, it) },
            back = h.greenBack?.let { distanceMeters(here, it) },
            hasGps = true,
        )
    }

    fun connect(code: String) {
        loading = true; error = null
        viewModelScope.launch {
            val ev = Backend.eventByCode(code)
            loading = false
            if (ev == null) {
                error = "Can't reach the golf day. Check the watch's connection and try again."
                return@launch
            }
            event = ev
            if (myPlayerId != null && ev.players.none { it.id == myPlayerId }) setPlayer(null)
            myPlayerId?.let { viewingHole = ev.currentHole(it) }
        }
    }

    fun retry() = connect(Config.PRESET_EVENT_CODE)

    fun setPlayer(id: String?) {
        myPlayerId = id
        prefs.edit().apply { if (id == null) remove("playerId") else putString("playerId", id) }.apply()
        val ev = event
        if (id != null && ev != null) viewingHole = ev.currentHole(id)
    }

    // Called from the Activity once location permission is granted.
    fun startLocation() {
        if (locationOn) return
        location.start { latLng, acc ->
            currentLoc = latLng
            accuracyM = if (acc.isNaN()) null else acc
        }
        locationOn = location.hasPermission()
    }

    fun selectClub(name: String) {
        selectedClub = name
        prefs.edit().putString("club", name).apply()
    }

    fun prevHole() { if (viewingHole > 1) viewingHole -= 1 }
    fun nextHole() { if (viewingHole < 18) viewingHole += 1 }

    // Defaults to the hole's par until a score is entered.
    fun displayedScore(): Int {
        val ev = event ?: return holeInfo().par
        val pid = myPlayerId ?: return holeInfo().par
        return ev.scoreAt(ev.scoringIdFor(pid), viewingHole) ?: holeInfo().par
    }

    fun bump(delta: Int) {
        val ev = event ?: return
        val pid = myPlayerId ?: return
        val next = (displayedScore() + delta).coerceIn(1, 15)
        val scoringId = ev.scoringIdFor(pid)
        busy = true
        viewModelScope.launch {
            val updated = Backend.setScore(ev.id, scoringId, viewingHole, next)
            busy = false
            if (updated != null) event = updated else error = "Score didn't sync — tap again."
        }
    }

    fun holesPlayed(): Int {
        val ev = event ?: return 0
        val pid = myPlayerId ?: return 0
        return ev.thruFor(ev.scoringIdFor(pid))
    }

    override fun onCleared() {
        location.stop()
        super.onCleared()
    }
}
