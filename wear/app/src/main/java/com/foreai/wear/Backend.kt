package com.foreai.wear

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

// --- Configuration ---------------------------------------------------------
// The watch is standalone: it reads/writes the SAME Firestore store the phones
// and the clubhouse website use (project foreai-f9cfa), so scores entered on the
// watch land on the same live leaderboard. Preset so a player just opens the app
// on the day. (Render is retired — this talks straight to Firestore now.)
object Config {
    const val PRESET_EVENT_CODE = "3YG6JS" // ECS Golf Day
}

// --- Models (only what the round screen needs) -----------------------------
data class WPlayer(val id: String, val name: String, val groupId: String?)
data class WGroup(val id: String, val playerIds: List<String>)
data class WEvent(
    val id: String,
    val name: String,
    val courseId: String,
    val format: String, // "stroke" | "stableford" | "scramble"
    val shotgun: Boolean,
    val players: List<WPlayer>,
    val groups: List<WGroup>,
    // scores[playerId][hole] = strokes
    val scores: Map<String, Map<Int, Int>>,
) {
    fun groupOf(playerId: String): WGroup? =
        groups.firstOrNull { it.playerIds.contains(playerId) }

    // A scramble team's single card lives under its captain (first player added).
    fun scoringIdFor(playerId: String): String {
        if (format != "scramble") return playerId
        return groupOf(playerId)?.playerIds?.firstOrNull() ?: playerId
    }

    fun thruFor(scoringId: String): Int = scores[scoringId]?.size ?: 0

    fun scoreAt(scoringId: String, hole: Int): Int? = scores[scoringId]?.get(hole)

    // Hole this player/team is currently on (shotgun- and format-aware). 18 = done.
    fun currentHole(playerId: String): Int {
        val gid = scoringIdFor(playerId)
        val done = thruFor(gid)
        if (done >= 18) return 18
        if (shotgun) {
            val idx = groups.indexOfFirst { it.id == groupOf(playerId)?.id }.coerceAtLeast(0)
            val start = (idx % 18) + 1
            return ((start - 1 + done) % 18) + 1
        }
        return done + 1
    }
}

// --- Firestore client ------------------------------------------------------
// Mirrors the phone's tournamentFirestore.ts and the website's events-fs.js:
//   eventCodes/{CODE}          -> { eventId }
//   events/{id}                -> { name, courseId, format, shotgun, ... }
//   events/{id}/players/{pid}  -> { name, handicap, deviceId, groupId }
//   events/{id}/groups/{gid}   -> { order, createdAt }   (playerIds derived)
//   events/{id}/scores/{pid_h} -> { playerId, hole, strokes }
//   events/{id}/shotMarks/{id} -> append-only, watch -> phone
object Backend {
    private val db: FirebaseFirestore get() = FirebaseFirestore.getInstance()
    private val auth: FirebaseAuth get() = FirebaseAuth.getInstance()

    private fun eventDoc(id: String) = db.collection("events").document(id)
    private fun sub(id: String, name: String) = eventDoc(id).collection(name)

    // Anonymous sign-in so writes satisfy the Firestore rules (reads are public).
    // Fire-and-forget; a failure just means writes fail soft, reads still work.
    private suspend fun ensureSignedIn() {
        // Fully guarded: even obtaining the Auth/Firestore instance can throw on a
        // watch without full Google Play services — never let that crash the app.
        try {
            if (auth.currentUser != null) return
            auth.signInAnonymously().await()
        } catch (_: Throwable) {
        }
    }

    // Firestore stores JS numbers as Long or Double — read either safely.
    private fun toInt(v: Any?): Int? = (v as? Number)?.toInt()
    private fun toLong(v: Any?): Long = (v as? Number)?.toLong() ?: 0L

    suspend fun eventByCode(code: String): WEvent? {
        ensureSignedIn()
        return try {
            val key = code.trim().uppercase()
            val codeSnap = db.collection("eventCodes").document(key).get().await()
            val eventId = codeSnap.getString("eventId") ?: return null
            assemble(eventId)
        } catch (_: Throwable) {
            null
        }
    }

    suspend fun refresh(eventId: String): WEvent? {
        ensureSignedIn()
        return try {
            assemble(eventId)
        } catch (_: Throwable) {
            null
        }
    }

    private suspend fun assemble(eventId: String): WEvent? {
        val meta = eventDoc(eventId).get().await()
        if (!meta.exists()) return null
        val playersSnap = sub(eventId, "players").get().await()
        val groupsSnap = sub(eventId, "groups").get().await()
        val scoresSnap = sub(eventId, "scores").get().await()

        val players = playersSnap.documents.map { d ->
            WPlayer(
                id = d.id,
                name = d.getString("name") ?: "",
                groupId = d.getString("groupId")?.ifBlank { null },
            )
        }
        // Order groups by their tee order (matches the phone/board), then derive
        // each group's players from the players' groupId.
        val groupDocs = groupsSnap.documents.sortedWith(
            compareBy({ toInt(it.get("order")) ?: 0 }, { toLong(it.get("createdAt")) }, { it.id })
        )
        val groups = groupDocs.map { g ->
            WGroup(id = g.id, playerIds = players.filter { it.groupId == g.id }.map { it.id })
        }
        val scores = mutableMapOf<String, MutableMap<Int, Int>>()
        for (s in scoresSnap.documents) {
            val pid = s.getString("playerId") ?: continue
            val hole = toInt(s.get("hole")) ?: continue
            val strokes = toInt(s.get("strokes")) ?: continue
            scores.getOrPut(pid) { mutableMapOf() }[hole] = strokes
        }
        return WEvent(
            id = eventId,
            name = meta.getString("name") ?: "Golf Day",
            courseId = meta.getString("courseId") ?: "",
            format = meta.getString("format") ?: "stroke",
            shotgun = meta.getBoolean("shotgun") ?: false,
            players = players,
            groups = groups,
            scores = scores,
        )
    }

    suspend fun setScore(eventId: String, playerId: String, hole: Int, strokes: Int): WEvent? {
        ensureSignedIn()
        return try {
            val ref = sub(eventId, "scores").document("${playerId}_$hole")
            if (strokes <= 0) {
                ref.delete().await()
            } else {
                ref.set(
                    mapOf(
                        "playerId" to playerId,
                        "hole" to hole,
                        "strokes" to strokes,
                        "updatedAt" to System.currentTimeMillis(),
                    )
                ).await()
            }
            assemble(eventId)
        } catch (_: Throwable) {
            null
        }
    }

    // Post a swing mark (the watch's GPS + chosen club + hole) to shotMarks. The
    // phone reads these to log shots hands-free. Best-effort — returns true on OK.
    suspend fun postMark(
        eventId: String,
        playerId: String,
        club: String?,
        hole: Int,
        lat: Double?,
        lng: Double?,
    ): Boolean {
        ensureSignedIn()
        return try {
            val data = hashMapOf<String, Any>(
                "playerId" to playerId,
                "hole" to hole,
                "source" to "watch",
                "createdAt" to System.currentTimeMillis(),
            )
            if (club != null) data["club"] = club
            if (lat != null) data["lat"] = lat
            if (lng != null) data["lng"] = lng
            sub(eventId, "shotMarks").add(data).await()
            true
        } catch (_: Throwable) {
            false
        }
    }
}
