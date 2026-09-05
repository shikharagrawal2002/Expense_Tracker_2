package com.ledger.smsforwarder

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Shows the last notifications seen by [TransactionNotificationListener] with
 * the verdict applied to each (forwarded / skipped / ignored, and why). Use it
 * to diagnose why Slice alerts aren't being captured.
 */
class DebugActivity : AppCompatActivity() {

    private lateinit var listView: ListView
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_debug)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        listView = findViewById(R.id.debugList)
        statusText = findViewById(R.id.debugStatus)

        findViewById<TextView>(R.id.debugClear).setOnClickListener {
            NotificationLogStore.clear()
            refresh()
            Toast.makeText(this, "Log cleared", Toast.LENGTH_SHORT).show()
        }

        findViewById<TextView>(R.id.debugGrantAccess).setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        refresh()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    private fun refresh() {
        // Access-status banner.
        val enabledListeners = Settings.Secure.getString(
            contentResolver,
            "enabled_notification_listeners",
        ) ?: ""
        val hasAccess = enabledListeners.split(":")
            .any { it.substringAfterLast('/').equals(packageName, ignoreCase = true) }
        statusText.text = if (hasAccess) {
            "✅ Notification access granted"
        } else {
            "⚠️ Notification access NOT granted — tap here to grant it"
        }

        val entries = NotificationLogStore.all()
        if (entries.isEmpty()) {
            listView.adapter = ArrayAdapter(
                this,
                android.R.layout.simple_list_item_1,
                listOf("""No notifications captured yet.

Make a transaction in Slice (or any monitored app) with this screen open in recents, then come back."""),
            )
            return
        }
        listView.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, entries.map { it.formatted() })
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, DebugActivity::class.java))
        }
    }
}