package com.foreai.wear

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import java.util.concurrent.TimeUnit

// --- Configuration ---------------------------------------------------------
// The watch is standalone: it talks straight to the same backend and event the
// phones use. Preset so a player just opens the app on the day.
object Config {
    const val API_BASE = "https://foreai.onrender.com"
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

// --- API client ------------------------------------------------------------
object Backend {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS) // free backend can cold-start (~30s)
        .build()

    private val JSON = "application/json; charset=utf-8".toMediaType()

    suspend fun eventByCode(code: String): WEvent? = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${Config.API_BASE}/tournaments/code/${code.trim().uppercase()}")
            .get().build()
        client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) return@withContext null
            val body = res.body?.string() ?: return@withContext null
            parseEvent(JSONObject(body))
        }
    }

    suspend fun refresh(eventId: String): WEvent? = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("${Config.API_BASE}/tournaments/$eventId").get().build()
        client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) return@withContext null
            val body = res.body?.string() ?: return@withContext null
            parseEvent(JSONObject(body))
        }
    }

    suspend fun setScore(eventId: String, playerId: String, hole: Int, strokes: Int): WEvent? =
        withContext(Dispatchers.IO) {
            val payload = JSONObject()
                .put("playerId", playerId)
                .put("hole", hole)
                .put("strokes", strokes)
            val req = Request.Builder()
                .url("${Config.API_BASE}/tournaments/$eventId/scores")
                .put(payload.toString().toRequestBody(JSON))
                .build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                val body = res.body?.string() ?: return@withContext null
                parseEvent(JSONObject(body))
            }
        }

    // Post a swing mark (the watch's GPS + chosen club + hole). The phone polls
    // these to log shots hands-free. Best-effort — returns true on 2xx.
    suspend fun postMark(
        eventId: String,
        playerId: String,
        club: String?,
        hole: Int,
        lat: Double?,
        lng: Double?,
    ): Boolean = withContext(Dispatchers.IO) {
        val payload = JSONObject().put("hole", hole).put("source", "watch")
        if (club != null) payload.put("club", club)
        if (lat != null) payload.put("lat", lat)
        if (lng != null) payload.put("lng", lng)
        val req = Request.Builder()
            .url("${Config.API_BASE}/tournaments/$eventId/players/$playerId/marks")
            .post(payload.toString().toRequestBody(JSON))
            .build()
        try {
            client.newCall(req).execute().use { res -> res.isSuccessful }
        } catch (_: Exception) {
            false
        }
    }

    private fun parseEvent(o: JSONObject): WEvent {
        val players = mutableListOf<WPlayer>()
        o.optJSONArray("players")?.let { arr ->
            for (i in 0 until arr.length()) {
                val p = arr.getJSONObject(i)
                players.add(
                    WPlayer(
                        id = p.getString("id"),
                        name = p.optString("name"),
                        groupId = p.optString("groupId").ifBlank { null },
                    )
                )
            }
        }
        val groups = mutableListOf<WGroup>()
        o.optJSONArray("groups")?.let { arr ->
            for (i in 0 until arr.length()) {
                val g = arr.getJSONObject(i)
                val ids = mutableListOf<String>()
                g.optJSONArray("playerIds")?.let { pa ->
                    for (j in 0 until pa.length()) ids.add(pa.getString(j))
                }
                groups.add(WGroup(id = g.getString("id"), playerIds = ids))
            }
        }
        val scores = mutableMapOf<String, MutableMap<Int, Int>>()
        o.optJSONObject("scores")?.let { s ->
            for (pid in s.keys()) {
                val holes = s.getJSONObject(pid)
                val map = mutableMapOf<Int, Int>()
                for (h in holes.keys()) map[h.toInt()] = holes.getInt(h)
                scores[pid] = map
            }
        }
        return WEvent(
            id = o.getString("id"),
            name = o.optString("name", "Golf Day"),
            courseId = o.optString("courseId"),
            format = o.optString("format", "stroke"),
            shotgun = o.optBoolean("shotgun", false),
            players = players,
            groups = groups,
            scores = scores,
        )
    }
}
