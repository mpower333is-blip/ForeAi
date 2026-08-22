package com.foreai.wear

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

// Drives the whole watch experience for Stage 1: connect to the event, remember
// which player this watch is, and enter per-hole scores that sync to the
// leaderboard the phones read.
class RoundViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs = app.getSharedPreferences("foreai_wear", 0)

    var loading by mutableStateOf(true); private set
    var error by mutableStateOf<String?>(null); private set
    var event by mutableStateOf<WEvent?>(null); private set
    var myPlayerId by mutableStateOf<String?>(prefs.getString("playerId", null)); private set
    var viewingHole by mutableStateOf(1); private set
    var busy by mutableStateOf(false); private set

    init {
        connect(Config.PRESET_EVENT_CODE)
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
            // If our saved player is no longer in the event, forget it.
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

    fun prevHole() { if (viewingHole > 1) viewingHole -= 1 }
    fun nextHole() { if (viewingHole < 18) viewingHole += 1 }

    // The score currently shown for the hole in view (defaults to 4 until set —
    // par-aware defaults arrive with Stage 2 once course data is on the watch).
    fun displayedScore(): Int {
        val ev = event ?: return 4
        val pid = myPlayerId ?: return 4
        return ev.scoreAt(ev.scoringIdFor(pid), viewingHole) ?: 4
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
}
