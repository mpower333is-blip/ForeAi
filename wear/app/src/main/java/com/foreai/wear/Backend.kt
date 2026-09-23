package com.foreai.wear

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

// --- Configuration ---------------------------------------------------------
// The watch is standalone: it talks straight to the same backend and event the
// phones use. Preset so a player just opens the app on the day.
object Config {
    // Backend base is set at build time (BuildConfig.API_BASE) so club flavours
    // point at their own instance; defaults to the shared ForeAi backend.
    val API_BASE = BuildConfig.API_BASE
    // The bundled course shown standalone (no backend). Blank -> generic card.
    val DEFAULT_COURSE_ID: String = BuildConfig.DEFAULT_COURSE_ID
    // Optional live event for player pick + score sync. Blank -> pure rangefinder,
    // the watch never touches the network (see build.gradle.kts for why).
    val PRESET_EVENT_CODE: String = BuildConfig.EVENT_CODE
    val HAS_EVENT: Boolean get() = PRESET_EVENT_CODE.isNotBlank()
    // Public status endpoint for the on-wrist lightning alert + next tee times.
    val STATUS_URL: String = BuildConfig.STATUS_URL
    val HAS_STATUS: Boolean get() = STATUS_URL.isNotBlank()
    const val CLUB_KEY = "kempton"
}

// On-wrist extras from the watchStatus endpoint.
data class WLightning(val level: String, val body: String?) // level: "approaching" | "overhead"
data class WTee(val teeMs: Long, val timeLabel: String, val names: List<String>, val party: Int)
data class WStatus(val lightning: WLightning?, val teeTimes: List<WTee>)

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

    // NOTE: every call is wrapped in try/catch. A free backend that has cold-
    // started, been suspended or retired answers with an HTML error page, not
    // JSON, and JSONObject(body) would throw JSONException. Thrown inside a
    // viewModelScope coroutine that would crash the app — which is exactly what a
    // Play reviewer would hit. Any failure (network, non-2xx, non-JSON) now just
    // returns null, and the UI treats that as "no live event" and stays a
    // rangefinder instead of crashing.
    suspend fun eventByCode(code: String): WEvent? = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("${Config.API_BASE}/tournaments/code/${code.trim().uppercase()}")
                .get().build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                val body = res.body?.string() ?: return@withContext null
                parseEvent(JSONObject(body))
            }
        } catch (_: Exception) {
            null
        }
    }

    suspend fun refresh(eventId: String): WEvent? = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("${Config.API_BASE}/tournaments/$eventId").get().build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                val body = res.body?.string() ?: return@withContext null
                parseEvent(JSONObject(body))
            }
        } catch (_: Exception) {
            null
        }
    }

    suspend fun setScore(eventId: String, playerId: String, hole: Int, strokes: Int): WEvent? =
        withContext(Dispatchers.IO) {
            try {
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
            } catch (_: Exception) {
                null
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

    // --- Watch status (lightning + tee times) -------------------------------
    // Club runs on SAST; format tee times in that zone so the label is right
    // whatever the watch's own timezone is set to.
    private val SAST = TimeZone.getTimeZone("Africa/Johannesburg")
    private val hhmm = SimpleDateFormat("HH:mm", Locale.UK).apply { timeZone = SAST }
    private val dayFmt = SimpleDateFormat("yyyyMMdd", Locale.UK).apply { timeZone = SAST }
    private val dowFmt = SimpleDateFormat("EEE", Locale.UK).apply { timeZone = SAST }

    private fun teeLabel(ms: Long): String {
        val d = dayFmt.format(Date(ms))
        val today = dayFmt.format(Date())
        val tomorrow = dayFmt.format(Date(System.currentTimeMillis() + 24 * 60 * 60 * 1000))
        val when_ = when (d) { today -> "Today"; tomorrow -> "Tomorrow"; else -> dowFmt.format(Date(ms)) }
        return "$when_ ${hhmm.format(Date(ms))}"
    }

    suspend fun status(): WStatus? = withContext(Dispatchers.IO) {
        if (!Config.HAS_STATUS) return@withContext null
        try {
            val url = "${Config.STATUS_URL}?club=${Config.CLUB_KEY}"
            val req = Request.Builder().url(url).get().build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                val body = res.body?.string() ?: return@withContext null
                val o = JSONObject(body)
                val lo = o.optJSONObject("lightning")
                val lightning = lo?.optString("level")?.takeIf { it.isNotBlank() && it != "null" }?.let {
                    WLightning(level = it, body = lo.optString("body").ifBlank { null })
                }
                val tees = mutableListOf<WTee>()
                o.optJSONArray("teeTimes")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        val t = arr.getJSONObject(i)
                        val ms = t.optLong("teeMs", 0L)
                        if (ms <= 0L) continue
                        val names = mutableListOf<String>()
                        t.optJSONArray("names")?.let { na ->
                            for (j in 0 until na.length()) names.add(na.optString(j))
                        }
                        tees.add(WTee(ms, teeLabel(ms), names, t.optInt("party", names.size.coerceAtLeast(1))))
                    }
                }
                WStatus(lightning, tees)
            }
        } catch (_: Exception) {
            null
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
