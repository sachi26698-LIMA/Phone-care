package app.phonecare.diagnostics.survey

import android.content.Context
import app.phonecare.diagnostics.quality.InternetQualityEngine
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.util.UUID

/**
 * Room-by-room sessions.
 *
 * Location is manual by design: the user names rooms, so no location permission
 * is involved and no movement track is stored. A room is only scored after three
 * samples, and the radio reading is optional.
 */
class SurveySession(private val context: Context) {

    data class Sample(
        val at: Instant,
        val latencyMedianMs: Double?,
        val jitterMs: Double?,
        val failureRatePct: Double,
        val score: Double?,
        val userDbm: Double?,
    )

    data class Room(
        val id: String,
        val name: String,
        val samples: List<Sample> = emptyList(),
    )

    data class Summary(
        val score: Double?,
        val sampleCount: Int,
        val latencyMedianMs: Double?,
        val latencySpreadMs: Double?,
        val failureRatePct: Double?,
        val userDbmMedian: Double?,
        val confidence: String,
        val note: String,
    )

    data class Survey(val startedAt: Instant, val rooms: List<Room>)

    private val file get() = File(context.filesDir, "phonecare-survey.json")

    fun load(): Survey {
        if (!file.exists()) return Survey(Instant.now(), emptyList())
        return runCatching {
            val root = JSONObject(file.readText())
            val rooms = root.optJSONArray("rooms")?.let { array ->
                (0 until array.length()).map { index ->
                    val room = array.getJSONObject(index)
                    val samples = room.optJSONArray("samples")?.let { sampleArray ->
                        (0 until sampleArray.length()).map { sampleIndex ->
                            val item = sampleArray.getJSONObject(sampleIndex)
                            Sample(
                                at = Instant.parse(item.getString("at")),
                                latencyMedianMs = item.optDoubleOrNull("latencyMedianMs"),
                                jitterMs = item.optDoubleOrNull("jitterMs"),
                                failureRatePct = item.optDouble("failureRatePct", 0.0),
                                score = item.optDoubleOrNull("score"),
                                userDbm = item.optDoubleOrNull("userDbm"),
                            )
                        }
                    } ?: emptyList()
                    Room(room.getString("id"), room.getString("name"), samples)
                }
            } ?: emptyList()
            Survey(Instant.parse(root.optString("startedAt", Instant.now().toString())), rooms)
        }.getOrElse { Survey(Instant.now(), emptyList()) }
    }

    fun save(survey: Survey) : Survey {
        val root = JSONObject().apply {
            put("startedAt", survey.startedAt.toString())
            put("rooms", JSONArray().apply {
                survey.rooms.forEach { room ->
                    put(JSONObject().apply {
                        put("id", room.id)
                        put("name", room.name)
                        put("samples", JSONArray().apply {
                            room.samples.forEach { sample ->
                                put(JSONObject().apply {
                                    put("at", sample.at.toString())
                                    put("latencyMedianMs", sample.latencyMedianMs ?: JSONObject.NULL)
                                    put("jitterMs", sample.jitterMs ?: JSONObject.NULL)
                                    put("failureRatePct", sample.failureRatePct)
                                    put("score", sample.score ?: JSONObject.NULL)
                                    put("userDbm", sample.userDbm ?: JSONObject.NULL)
                                })
                            }
                        })
                    })
                }
            })
        }
        runCatching { file.writeText(root.toString()) }
        return survey
    }

    fun addRoom(survey: Survey, name: String): Survey {
        val trimmed = name.trim()
        if (trimmed.isEmpty() || survey.rooms.size >= 12) return survey
        if (survey.rooms.any { it.name.equals(trimmed, ignoreCase = true) }) return survey
        return save(survey.copy(rooms = survey.rooms + Room(UUID.randomUUID().toString(), trimmed)))
    }

    fun removeRoom(survey: Survey, roomId: String): Survey =
        save(survey.copy(rooms = survey.rooms.filterNot { it.id == roomId }))

    /** Records one measured five-probe series. A room never gets a score from a guess. */
    fun addSample(survey: Survey, roomId: String, probes: List<InternetQualityEngine.ProbeSample>, userDbm: Double?): Survey {
        val latency = InternetQualityEngine.summarise(probes)
        val score = latency.medianMs?.let { ms ->
            when {
                ms <= 40 -> 94.0
                ms <= 80 -> 84.0
                ms <= 150 -> 70.0
                ms <= 300 -> 52.0
                else -> 34.0
            }
        }
        val sample = Sample(
            at = Instant.now(),
            latencyMedianMs = latency.medianMs,
            jitterMs = latency.jitterMs,
            failureRatePct = latency.failureRatePct,
            score = score,
            userDbm = userDbm,
        )
        val updated = survey.copy(
            rooms = survey.rooms.map { room ->
                if (room.id != roomId) room
                else room.copy(samples = (room.samples + sample).takeLast(20))
            },
        )
        return save(updated)
    }

    fun summarise(room: Room): Summary {
        val usable = room.samples.filter { it.latencyMedianMs != null }
        val latencies = usable.mapNotNull { it.latencyMedianMs }.sorted()
        val scores = usable.mapNotNull { it.score }
        val dbms = room.samples.mapNotNull { it.userDbm }
        val median = if (latencies.isEmpty()) null else {
            val middle = latencies.size / 2
            if (latencies.size % 2 == 0) (latencies[middle - 1] + latencies[middle]) / 2 else latencies[middle]
        }
        val p25 = latencies.getOrNull(latencies.size / 4)
        val p75 = latencies.getOrNull(((latencies.size - 1) * 3) / 4)
        val confidence = when {
            usable.size >= 5 -> "high"
            usable.size >= 3 -> "medium"
            usable.size >= 1 -> "low"
            else -> "none"
        }
        val note = when {
            usable.isEmpty() -> "No measured samples yet."
            usable.size < 3 -> "${3 - usable.size} more samples needed before this room can be scored."
            scores.size < 3 -> "Some probes failed, so the room score is withheld."
            dbms.size < 2 -> "Link-based score only. Add a dBm reading from the phone's field-test screen for radio context."
            else -> "Link score with user-entered dBm readings."
        }
        return Summary(
            score = if (scores.size >= 3) scores.sorted().let { it[it.size / 2] } else null,
            sampleCount = room.samples.size,
            latencyMedianMs = if (usable.size >= 3) median else null,
            latencySpreadMs = if (p25 != null && p75 != null) (p75 - p25) / 2 else null,
            failureRatePct = if (usable.isEmpty()) null else usable.map { it.failureRatePct }.average(),
            userDbmMedian = if (dbms.size >= 2) dbms.sorted().let { it[it.size / 2] } else null,
            confidence = confidence,
            note = note,
        )
    }

    companion object {
        fun classifyRsrp(dbm: Double): String = when {
            dbm >= -80 -> "Excellent"
            dbm >= -90 -> "Good"
            dbm >= -100 -> "Fair"
            dbm >= -110 -> "Weak"
            else -> "Very weak"
        }

        fun classifyRssi(dbm: Double): String = when {
            dbm >= -50 -> "Excellent"
            dbm >= -60 -> "Good"
            dbm >= -70 -> "Fair"
            dbm >= -80 -> "Weak"
            else -> "Very weak"
        }
    }
}

private fun JSONObject.optDoubleOrNull(key: String): Double? =
    if (isNull(key)) null else optDouble(key).takeIf { it.isFinite() }
