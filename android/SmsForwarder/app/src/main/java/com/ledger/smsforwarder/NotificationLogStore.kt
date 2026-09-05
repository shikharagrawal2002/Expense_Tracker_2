package com.ledger.smsforwarder

import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale

/**
 * In-memory ring buffer of recent notification events seen by
 * [TransactionNotificationListener], used by the Debug screen to show exactly
 * what the listener receives and why each alert was forwarded or skipped.
 */
object NotificationLogStore {

    data class Entry(
        val timestamp: Long,
        val packageName: String,
        val title: String,
        val text: String,
        val verdict: String,
    ) {
        fun formatted(): String {
            val time = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(timestamp))
            return """$time  [$packageName]
$title
$text
→ $verdict"""
        }
    }

    private const val MAX_ENTRIES = 50
    private val entries = ArrayDeque<Entry>(MAX_ENTRIES)

    @Synchronized
    fun add(packageName: String, title: String, text: String, verdict: String) {
        if (entries.size >= MAX_ENTRIES) entries.removeFirst()
        entries.addLast(Entry(System.currentTimeMillis(), packageName, title, text, verdict))
    }

    @Synchronized
    fun all(): List<Entry> = entries.toList().reversed() // newest first

    @Synchronized
    fun clear() = entries.clear()
}