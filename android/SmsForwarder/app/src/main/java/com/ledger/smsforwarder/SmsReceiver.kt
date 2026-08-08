package com.ledger.smsforwarder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Telephony
import android.telephony.SmsMessage
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
 * BroadcastReceiver that intercepts incoming SMS messages.
 * Filters for bank/UPI transaction messages and forwards them
 * to the Supabase ingest-sms Edge Function.
 */
class SmsReceiver : BroadcastReceiver() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        val apiKey = prefs.getString("api_key", "") ?: ""
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val enabledOnly = prefs.getBoolean("filter_bank_sms", true)

        if (apiKey.isBlank() || serverUrl.isBlank()) {
            Log.w(TAG, "SMS Forwarder not configured - skipping")
            return
        }

        val messages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } else {
            val bundle = intent.extras ?: return
            parseLegacyMessages(bundle)
        }

        for (sms in messages) {
            val messageBody = sms.messageBody ?: continue
            val senderPhone = sms.originatingAddress ?: continue
            val receivedAt = sms.timestampMillis

            // If filtering is enabled, skip non-bank SMS
            if (enabledOnly && !isBankSms(messageBody)) {
                Log.d(TAG, "Skipping non-bank SMS from $senderPhone")
                continue
            }

            Log.d(TAG, "Forwarding SMS from $senderPhone: ${messageBody.take(80)}")

            scope.launch {
                forwardSms(context, serverUrl, apiKey, senderPhone, messageBody, receivedAt)
            }
        }
    }

    private fun isBankSms(text: String): Boolean {
        val keywords = listOf(
            "debited", "credited", "spent", "paid", "purchase",
            "upi", "trf", "withdrawn", "refund", "cashback",
            "used", "txn", "account", "balance", "reward",
            "emi", "bill", "payment", "received", "sent",
            "hdfc", "icici", "sbi", "axis", "kotak", "yes bank",
            "indusind", "idfc", "paytm", "phonepe", "gpay",
            "google pay", "amazon pay", "bhim"
        )
        val lower = text.lowercase()
        return keywords.any { lower.contains(it) }
    }

    private fun forwardSms(
        context: Context,
        serverUrl: String,
        apiKey: String,
        senderPhone: String,
        rawText: String,
        receivedAt: Long
    ) {
        try {
            val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            val isoDate = dateFormat.format(Date(receivedAt))

            val json = JSONObject().apply {
                put("apiKey", apiKey)
                put("senderPhone", senderPhone)
                put("rawText", rawText)
                put("receivedAt", isoDate)
            }

            val requestBody = json.toString().toRequestBody(JSON_MEDIA_TYPE)
            val request = Request.Builder()
                .url(serverUrl)
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (response.isSuccessful) {
                Log.d(TAG, "SMS forwarded successfully: $responseBody")
                // Show a notification for the forwarded SMS
                NotificationHelper.showForwardedNotification(context, rawText)
            } else {
                Log.e(TAG, "Failed to forward SMS: ${response.code} $responseBody")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error forwarding SMS", e)
        }
    }

    private fun parseLegacyMessages(bundle: Bundle): Array<SmsMessage> {
        val pdus = bundle["pdus"] as? Array<*>
        if (pdus == null) return emptyArray()

        val format = bundle.getString("format")
        return pdus.mapNotNull { pdu ->
            try {
                SmsMessage.createFromPdu(pdu as ByteArray, format)
            } catch (e: Exception) {
                null
            }
        }.toTypedArray()
    }

    companion object {
        private const val TAG = "SmsReceiver"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}