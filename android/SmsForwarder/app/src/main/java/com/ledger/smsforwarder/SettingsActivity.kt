package com.ledger.smsforwarder

import android.content.Context
import android.content.Intent
import android.os.Bundle
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

            serverUrlPref?.setOnPreferenceChangeListener { pref, newValue ->
                pref.summary = newValue.toString().ifBlank { "e.g. https://your-project.supabase.co/functions/v1/ingest-sms" }
                true
            }
            apiKeyPref?.setOnPreferenceChangeListener { pref, newValue ->
                val valStr = newValue.toString()
                pref.summary = if (valStr.length > 8) "${valStr.take(8)}..." else valStr
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