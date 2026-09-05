package com.ledger.smsforwarder

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.preference.PreferenceManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Reads transaction alerts posted as in-app/push notifications by fintech
 * apps (e.g. Slice) that don't send regular bank SMS.
 *
 * Requires the user to grant "Notification access" for this app in
 * Settings > Special app access > Notification access.
 *
 * Filtered notifications are forwarded to the same ingest-sms Edge Function
 * used by SmsReceiver, with senderPhone = "APP:<label>" so the web SMS
 * Tracking page shows them alongside SMS transactions.
 *
 * Debug: every notification's verdict is recorded in [NotificationLogStore]
 * and viewable in DebugActivity. With "debug_all_apps" enabled, ALL apps'
 * notifications are logged for 10 minutes so users can discover package IDs.
 */
class TransactionNotificationListener : NotificationListenerService() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return

        // Ensure legacy credentials / package-ID migration has run even if the
        // main activity hasn't been opened since the app was updated.
        SecretStore(this).migrateLegacySecrets()

        val prefs = PreferenceManager.getDefaultSharedPreferences(this)
        val debugAllUntil = prefs.getLong("debug_all_apps_until", 0L)
        val debugAllActive = System.currentTimeMillis() < debugAllUntil

        val extras = sbn.notification?.extras
        var title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        var text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText = extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""
        if (text.isBlank()) text = bigText
        // Fallback for custom-layout notifications with empty extras.
        if (title.isBlank() && text.isBlank()) {
            title = sbn.notification?.tickerText?.toString() ?: ""
        }
        val body = listOf(title, text).filter { it.isNotBlank() }.joinToString(" | ")

        // Not a monitored app — only record when debug-all is active.
        if (!isMonitoredPackage(pkg)) {
            if (debugAllActive && body.isNotBlank()) {
                NotificationLogStore.add(pkg, title, text, "IGNORED: not in Monitored apps")
            }
            return
        }

        if (body.isBlank()) {
            NotificationLogStore.add(pkg, "(no text)", "", "SKIPPED: notification had no readable text")
            return
        }

        // Skip OTP / verification messages
        if (OTP_KEYWORDS.any { body.lowercase().contains(it) }) {
            Log.d(TAG, "Skipping OTP-like notification from $pkg")
            NotificationLogStore.add(pkg, title, text, "SKIPPED: looks like an OTP")
            return
        }

        // Require a monetary value + transaction keyword (same rules as SMS)
        if (!hasAmount(body)) {
            NotificationLogStore.add(pkg, title, text, "IGNORED: no monetary amount found")
            return
        }
        if (!hasTransactionKeyword(body)) {
            NotificationLogStore.add(pkg, title, text, "IGNORED: no transaction keyword found")
            return
        }

        val apiKey = SecretStore(this).readSecret("api_key") ?: ""
        val serverUrl = SecretStore(this).readSecret("server_url") ?: ""
        if (apiKey.isBlank() || serverUrl.isBlank()) {
            Log.w(TAG, "Forwarder not configured - skipping notification")
            NotificationLogStore.add(pkg, title, text, "SKIPPED: API key / server URL not configured")
            return
        }

        val label = APP_LABELS[pkg] ?: pkg.substringAfterLast('.')
        val receivedAt = sbn.postTime

        Log.d(TAG, "Forwarding app notification from $pkg: ${body.take(80)}")
        NotificationLogStore.add(pkg, title, text, "FORWARDED as APP:$label")

        scope.launch {
            forwardToServer(serverUrl, apiKey, "APP:$label", body, receivedAt)
        }
    }

    private fun isMonitoredPackage(pkg: String): Boolean {
        val prefs = PreferenceManager.getDefaultSharedPreferences(this)
        val configured = prefs.getString("monitored_apps", DEFAULT_MONITORED_APPS) ?: DEFAULT_MONITORED_APPS
        return configured.split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .any { pkg.equals(it, ignoreCase = true) }
    }

    private fun hasAmount(text: String): Boolean {
        return AMOUNT_PREFIX_RE.containsMatchIn(text) || DECIMAL_AMOUNT_RE.containsMatchIn(text)
    }

    private fun hasTransactionKeyword(text: String): Boolean {
        val lower = text.lowercase()
        return TRANSACTION_KEYWORDS.any { lower.contains(it) }
    }

    private fun forwardToServer(
        serverUrl: String,
        apiKey: String,
        senderPhone: String,
        rawText: String,
        receivedAt: Long,
    ) {
        try {
            val isoDate = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date(receivedAt))
            val json = JSONObject().apply {
                put("apiKey", apiKey)
                put("senderPhone", senderPhone)
                put("rawText", rawText)
                put("receivedAt", isoDate)
            }
            val request = Request.Builder()
                .url(serverUrl)
                .post(json.toString().toRequestBody(JSON_MEDIA_TYPE))
                .build()
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Log.d(TAG, "App notification forwarded: $senderPhone")
                    NotificationHelper.showForwardedNotification(this, rawText)
                } else {
                    Log.e(TAG, "Failed to forward notification: ${response.code}")
                    NotificationLogStore.add(senderPhone.removePrefix("APP:"), "", "", "ERROR: server returned ${response.code}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error forwarding notification", e)
            NotificationLogStore.add(senderPhone.removePrefix("APP:"), "", "", "ERROR: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "TxnNotifListener"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        /** Default monitored packages — Slice first; users can add more. */
        const val DEFAULT_MONITORED_APPS = "indwin.c3.shareapp"

        /** Friendly labels shown in the web review queue. */
        val APP_LABELS = mapOf(
            "indwin.c3.shareapp" to "slice",
        )

        private val AMOUNT_PREFIX_RE =
            Regex("""(?:rs\.?|inr|₹)\s?\d[\d,]*\.?\d*""", RegexOption.IGNORE_CASE)
        private val DECIMAL_AMOUNT_RE = Regex("""\b\d{1,3}(?:,\d{3})*\.\d{2}\b""")
        private val TRANSACTION_KEYWORDS = listOf(
            "debited", "credited", "spent", "paid", "purchase",
            "upi", "trf", "withdrawn", "refund", "cashback",
            "used", "txn", "payment", "received", "sent",
            "emi", "bill", "recharge", "recharged", "repaid",
        )
        private val OTP_KEYWORDS = listOf(
            "otp", "one time password", "one-time password",
            "verification code", "do not share", "never share",
        )
    }
}