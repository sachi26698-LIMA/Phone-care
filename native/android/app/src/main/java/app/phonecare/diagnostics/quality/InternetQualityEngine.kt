package app.phonecare.diagnostics.quality

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.time.Instant
import kotlin.math.abs
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Latency, jitter, DNS timing and directional HTTP throughput.
 *
 * Method: docs/native/NETWORK-SPEC.md. The first probe is discarded as a cold
 * connection; median and minimum are both reported; a score is withheld when
 * probe failures exceed 5 % or jitter exceeds 150 ms (RFC 6349 §3 rationale).
 *
 * There is no packet-loss measurement. ICMP and raw sockets need root or a VpnService,
 * and pretending that HTTP failures are packet loss would be a lie.
 */
class InternetQualityEngine(private val baseUrl: String) {

    enum class Failure(val json: String) { NONE("none"), TIMEOUT("timeout"), NETWORK("network"), HTTP("http") }

    data class ProbeSample(val index: Int, val rttMs: Double?, val failure: Failure, val at: Instant)

    data class LatencySummary(
        val attempted: Int,
        val succeeded: Int,
        val failures: Int,
        val failureRatePct: Double,
        val medianMs: Double?,
        val minMs: Double?,
        val maxMs: Double?,
        val jitterMs: Double?,
        val cvPct: Double?,
        val spreadMs: Double?,
    )

    data class Transfer(val direction: String, val bytes: Long, val ms: Long, val mbps: Double)

    data class Stability(val roundMedians: List<Double>, val cvPct: Double?, val label: String)

    data class Result(
        val startedAt: Instant,
        val finishedAt: Instant,
        val durationMs: Long,
        val server: String?,
        val samples: List<ProbeSample>,
        val latency: LatencySummary,
        val stability: Stability,
        val download: Transfer?,
        val upload: Transfer?,
        val dnsMs: Double?,
        val validityReasons: List<String>,
        val scores: Map<String, Double?>,
        val limitations: List<String>,
    ) {
        val scored: Boolean get() = validityReasons.isEmpty()
    }

    suspend fun run(onProgress: (String) -> Unit = {}): Result = withContext(Dispatchers.IO) {
        val startedAt = Instant.now()
        val startedNanos = System.nanoTime()
        onProgress("Resolving the test host")

        val dnsMs = measureDns()

        onProgress("Running probe round 1")
        val first = probeSeries(8, onProgress)
        onProgress("Measuring download")
        val download = download(3 * 1024 * 1024, onProgress)
        onProgress("Measuring upload")
        val upload = upload(2 * 1024 * 1024, onProgress)
        onProgress("Checking stability")
        val second = probeSeries(5, onProgress)
        val third = probeSeries(5, onProgress)

        val allSamples = first + second + third
        val latency = summarise(allSamples)
        val stability = stability(listOf(median(first.mapNotNull { it.rttMs }), median(second.mapNotNull { it.rttMs }), median(third.mapNotNull { it.rttMs })))

        val reasons = buildList {
            if (latency.attempted < 3) add("fewer than three probes attempted")
            else if (latency.succeeded < 3) add("fewer than three successful probes")
            latency.jitterMs?.let { if (it > 150) add("jitter ${it.toInt()} ms exceeds the 150 ms ceiling") }
            if (latency.failureRatePct > 5) add("probe failure rate ${"%.1f".format(latency.failureRatePct)} % exceeds 5 %")
            if (download == null && upload == null) add("no throughput transfer completed")
        }

        val scores = score(latency, download?.mbps, upload?.mbps, stability.cvPct, reasons.isEmpty())
        val limitations = buildList {
            add("Throughput is measured against the configured test server, so its distance is part of the result.")
            add("Probe failures are HTTP-level failures, not packet loss; Android apps cannot read packet loss without root or a VPN service.")
            add("Radio metrics are measured separately by the cellular and Wi-Fi collectors.")
            if (reasons.isNotEmpty()) add("No score published: ${reasons.joinToString("; ")}.")
        }

        Result(
            startedAt = startedAt,
            finishedAt = Instant.now(),
            durationMs = (System.nanoTime() - startedNanos) / 1_000_000,
            server = baseUrl.takeIf { it.isNotBlank() },
            samples = allSamples,
            latency = latency,
            stability = stability,
            download = download,
            upload = upload,
            dnsMs = dnsMs,
            validityReasons = reasons,
            scores = scores,
            limitations = limitations,
        )
    }

    private fun measureDns(): Double? {
        val host = runCatching { URL(baseUrl).host }.getOrNull() ?: return null
        return runCatching {
            val start = System.nanoTime()
            InetAddress.getAllByName(host)
            (System.nanoTime() - start) / 1_000_000.0
        }.getOrNull()
    }

    private fun probeSeries(count: Int, onProgress: (String) -> Unit): List<ProbeSample> {
        if (baseUrl.isBlank()) return emptyList()
        return (0 until count).map { index ->
            onProgress("Probe ${index + 1} of $count")
            val connection = (URL("$baseUrl/api/network/ping?probe=$index").openConnection() as HttpURLConnection).apply {
                connectTimeout = 4_000
                readTimeout = 4_000
                requestMethod = "GET"
                useCaches = false
            }
            val start = System.nanoTime()
            var failure = Failure.NONE
            var rtt: Double? = null
            try {
                val code = connection.responseCode
                connection.inputStream.use { it.readBytes() }
                if (code in 200..299) {
                    rtt = (System.nanoTime() - start) / 1_000_000.0
                } else {
                    failure = Failure.HTTP
                }
            } catch (timeout: java.net.SocketTimeoutException) {
                failure = Failure.TIMEOUT
            } catch (other: Exception) {
                failure = Failure.NETWORK
            } finally {
                connection.disconnect()
            }
            ProbeSample(index, rtt, failure, Instant.now())
        }
    }

    private fun download(bytes: Int, onProgress: (String) -> Unit): Transfer? {
        if (baseUrl.isBlank()) return null
        val connection = (URL("$baseUrl/api/network/download?bytes=$bytes").openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 30_000
            useCaches = false
        }
        return try {
            if (connection.responseCode !in 200..299) return null
            val start = System.nanoTime()
            var received = 0L
            BufferedInputStream(connection.inputStream).use { stream ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val read = stream.read(buffer)
                    if (read <= 0) break
                    received += read
                    onProgress("Downloaded ${received / 1024} KB")
                }
            }
            val ms = (System.nanoTime() - start) / 1_000_000
            if (received < 1024 || ms < 8) null else Transfer("download", received, ms, received * 8.0 / (ms / 1000.0) / 1_000_000)
        } catch (error: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun upload(bytes: Int, onProgress: (String) -> Unit): Transfer? {
        if (baseUrl.isBlank()) return null
        val payload = Random.nextBytes(bytes)
        val connection = (URL("$baseUrl/api/network/upload").openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 30_000
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "application/octet-stream")
            setFixedLengthStreamingMode(payload.size)
            useCaches = false
        }
        return try {
            val start = System.nanoTime()
            connection.outputStream.use { it.write(payload) }
            val code = connection.responseCode
            connection.inputStream.use { it.readBytes() }
            val ms = (System.nanoTime() - start) / 1_000_000
            onProgress("Upload complete")
            if (code !in 200..299 || ms < 8) null else Transfer("upload", payload.size.toLong(), ms, payload.size * 8.0 / (ms / 1000.0) / 1_000_000)
        } catch (error: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        fun summarise(samples: List<ProbeSample>): LatencySummary {
            val successful = samples.mapNotNull { it.rttMs }
            val failures = samples.size - successful.size
            // Drop the cold sample from the statistics, keep it in the raw list.
            val usable = if (successful.size > 3) successful.drop(1) else successful
            val base = if (usable.isNotEmpty()) usable else successful
            val median = median(base)
            val mean = if (base.isEmpty()) null else base.average()
            val jitter = if (base.size < 2) null else base.zipWithNext { a, b -> abs(b - a) }.average()
            val cv = if (mean != null && mean > 0 && base.size > 1) {
                sqrt(base.sumOf { (it - mean) * (it - mean) } / (base.size - 1)) / mean * 100
            } else {
                null
            }
            val sorted = base.sorted()
            val spread = if (sorted.isEmpty()) null else (sorted[(sorted.size - 1) * 3 / 4] - sorted[sorted.size / 4]) / 2
            return LatencySummary(
                attempted = samples.size,
                succeeded = successful.size,
                failures = failures,
                failureRatePct = if (samples.isEmpty()) 0.0 else failures * 100.0 / samples.size,
                medianMs = median,
                minMs = base.minOrNull(),
                maxMs = base.maxOrNull(),
                jitterMs = jitter,
                cvPct = cv,
                spreadMs = spread,
            )
        }

        fun median(values: List<Double>): Double? {
            if (values.isEmpty()) return null
            val sorted = values.sorted()
            val middle = sorted.size / 2
            return if (sorted.size % 2 == 0) (sorted[middle - 1] + sorted[middle]) / 2 else sorted[middle]
        }

        fun stability(roundMedians: List<Double?>): Stability {
            val values = roundMedians.filterNotNull()
            if (values.size < 2) return Stability(values, null, "unknown")
            val mean = values.average()
            val cv = if (mean <= 0) null else sqrt(values.sumOf { (it - mean) * (it - mean) } / (values.size - 1)) / mean * 100
            val label = when {
                cv == null -> "unknown"
                cv <= 10 -> "stable"
                cv <= 25 -> "variable"
                else -> "unstable"
            }
            return Stability(values, cv, label)
        }

        fun score(
            latency: LatencySummary,
            downloadMbps: Double?,
            uploadMbps: Double?,
            stabilityCv: Double?,
            scored: Boolean,
        ): Map<String, Double?> {
            val download = downloadMbps?.let { if (it >= 50) 95.0 else if (it >= 20) 85.0 else if (it >= 8) 70.0 else if (it >= 2) 55.0 else 35.0 }
            val upload = uploadMbps?.let { if (it >= 20) 92.0 else if (it >= 8) 80.0 else if (it >= 3) 66.0 else if (it >= 1) 52.0 else 38.0 }
            val latencyScore = latency.medianMs?.let { if (it <= 40) 94.0 else if (it <= 80) 84.0 else if (it <= 150) 70.0 else if (it <= 300) 52.0 else 34.0 }
            val stabilityScore = stabilityCv?.let { if (it <= 10) 92.0 else if (it <= 25) 74.0 else if (it <= 50) 52.0 else 30.0 }

            val parts = listOf(download to 0.45, upload to 0.25, latencyScore to 0.2, stabilityScore to 0.1)
                .filter { it.first != null }
            val weight = parts.sumOf { it.second }
            val total = if (!scored || weight == 0.0) null else parts.sumOf { (it.first ?: 0.0) * it.second } / weight
            return mapOf(
                "download" to download,
                "upload" to upload,
                "latency" to latencyScore,
                "stability" to stabilityScore,
                "total" to total,
            )
        }
    }
}
