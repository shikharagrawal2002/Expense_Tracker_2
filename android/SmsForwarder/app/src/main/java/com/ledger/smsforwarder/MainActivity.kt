package com.ledger.smsforwarder

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Telephony
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.preference.PreferenceManager
import com.ledger.smsforwarder.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val smsPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            Toast.makeText(this, "SMS Forwarding is active", Toast.LENGTH_SHORT).show()
            updateStatus()
        } else {
            Toast.makeText(this, "SMS permission is required to forward transactions", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.buttonRequestPermissions.setOnClickListener {
            requestSmsPermissions()
        }

        binding.buttonOpenSettings.setOnClickListener {
            SettingsActivity.start(this)
        }

        updateStatus()
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun updateStatus() {
        val prefs = PreferenceManager.getDefaultSharedPreferences(this)
        val apiKey = prefs.getString("api_key", "") ?: ""
        val serverUrl = prefs.getString("server_url", "") ?: ""

        val hasSmsPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        } else true

        val isConfigured = apiKey.isNotBlank() && serverUrl.isNotBlank()
        val isDefaultSms = Telephony.Sms.getDefaultSmsPackage(this) == packageName

        binding.textStatus.text = when {
            !hasSmsPermission -> "⚠️ SMS permission not granted"
            !isConfigured -> "⚠️ Configure API key & server URL in Settings"
            else -> """
                ✅ SMS Forwarding Active
                
                Server: $serverUrl
                API Key: ${apiKey.take(8)}...
                
                Note: This app does NOT need to be your default SMS app.
                It reads incoming SMS broadcasts without intercepting them.
            """.trimIndent()
        }
    }

    private fun requestSmsPermissions() {
        val permissions = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.RECEIVE_SMS)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_SMS)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissions.isNotEmpty()) {
            smsPermissionLauncher.launch(permissions.toTypedArray())
        } else {
            Toast.makeText(this, "All permissions already granted", Toast.LENGTH_SHORT).show()
        }
    }
}