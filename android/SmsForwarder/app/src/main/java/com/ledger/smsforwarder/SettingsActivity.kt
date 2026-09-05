package com.ledger.smsforwarder

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.appcompat.app.AppCompatActivity
import androidx.preference.EditTextPreference
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(com.ledger.smsforwarder.R.layout.activity_settings)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        if (savedInstanceState == null) {
            supportFragmentManager
                .beginTransaction()
                .replace(com.ledger.smsforwarder.R.id.settings_container, SettingsFragment())
                .commit()
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    class SettingsFragment : PreferenceFragmentCompat() {
        override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
            setPreferencesFromResource(com.ledger.smsforwarder.R.xml.preferences, rootKey)

            val serverUrlPref = findPreference<EditTextPreference>("server_url")
            val apiKeyPref = findPreference<EditTextPreference>("api_key")

            serverUrlPref?.summary = serverUrlPref?.text?.ifBlank { "e.g. https://your-project.supabase.co/functions/v1/ingest-sms" }
            apiKeyPref?.summary = apiKeyPref?.text?.let {
                if (it.length > 8) "${it.take(8)}..." else it
            }?.ifBlank { "Paste your API key from Ledger web app" }

            // Persist credentials into Keystore-encrypted storage immediately.
            // The plaintext EditTextPreference value is removed by the next
            // migrateLegacySecrets() run on app start.
            serverUrlPref?.setOnPreferenceChangeListener { pref, newValue ->
                val valStr = newValue.toString()
                pref.summary = valStr.ifBlank { "e.g. https://your-project.supabase.co/functions/v1/ingest-sms" }
                SecretStore(requireContext()).saveSecret("server_url", valStr)
                true
            }
            apiKeyPref?.setOnPreferenceChangeListener { pref, newValue ->
                val valStr = newValue.toString()
                pref.summary = if (valStr.length > 8) "${valStr.take(8)}..." else valStr
                SecretStore(requireContext()).saveSecret("api_key", valStr)
                true
            }

            // Opens Android's Notification access screen so the user can grant
            // read access for fintech app alerts (Slice, etc.).
            findPreference<Preference>("open_notification_access")?.setOnPreferenceClickListener {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                true
            }

            // Debug: log ALL apps' notifications for 10 minutes so the user can
            // discover an app's exact package ID from the Debug screen.
            findPreference<Preference>("debug_log_all_apps")?.setOnPreferenceClickListener {
                val prefs = androidx.preference.PreferenceManager.getDefaultSharedPreferences(requireContext())
                prefs.edit()
                    .putLong("debug_all_apps_until", System.currentTimeMillis() + 10 * 60 * 1000L)
                    .apply()
                android.widget.Toast.makeText(
                    requireContext(),
                    "Logging all notifications for the next 10 minutes",
                    android.widget.Toast.LENGTH_LONG,
                ).show()
                true
            }

            findPreference<Preference>("open_debug_log")?.setOnPreferenceClickListener {
                DebugActivity.start(requireContext())
                true
            }
        }
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, SettingsActivity::class.java))
        }
    }
}