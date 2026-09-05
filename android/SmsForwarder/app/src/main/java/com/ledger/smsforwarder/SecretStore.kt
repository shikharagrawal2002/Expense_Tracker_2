package com.ledger.smsforwarder

import android.content.Context
import android.content.SharedPreferences
import android.preference.PreferenceManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Stores secrets (API key / server URL) in Android Keystore-backed AES-GCM
 * encryption. The 256-bit key never leaves the hardware-backed Keystore.
 *
 * Legacy compatibility: values saved before encryption existed live as
 * plaintext in the default SharedPreferences (written by the settings
 * screen). [readSecret] falls back to those, and [migrateLegacySecrets]
 * upgrades them to encrypted storage.
 */
class SecretStore(context: Context) {

    private val appContext = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val legacyPrefs: SharedPreferences =
        PreferenceManager.getDefaultSharedPreferences(appContext)
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    fun saveSecret(alias: String, value: String) {
        if (value.isBlank()) {
            clear(alias)
            return
        }
        val key = getOrCreateAesKey(alias)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))

        val encodedIv = Base64.encodeToString(iv, Base64.NO_WRAP)
        val encodedCt = Base64.encodeToString(ciphertext, Base64.NO_WRAP)
        prefs.edit().putString(alias, "$encodedIv:$encodedCt").apply()
    }

    /** Reads an encrypted secret; falls back to legacy plaintext if present. */
    fun readSecret(alias: String): String? {
        // 1) Encrypted value
        val stored = prefs.getString(alias, null)
        if (stored != null) {
            val parts = stored.split(":")
            if (parts.size == 2) {
                return try {
                    val iv = Base64.decode(parts[0], Base64.NO_WRAP)
                    val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)
                    val entry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
                        ?: return null
                    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                    cipher.init(Cipher.DECRYPT_MODE, entry.secretKey, GCMParameterSpec(128, iv))
                    String(cipher.doFinal(ciphertext), Charsets.UTF_8)
                } catch (e: Exception) {
                    null
                }
            }
        }

        // 2) Legacy plaintext written by the settings screen
        return legacyPrefs.getString(alias, null)?.takeIf { it.isNotBlank() }
    }

    fun clear(alias: String) {
        prefs.edit().remove(alias).apply()
    }

    /**
     * One-time upgrade: copies any legacy plaintext secrets into encrypted
     * storage and removes them from plaintext preferences. Safe to call on
     * every app start — no-ops when there is nothing to migrate.
     *
     * Also migrates the old "com.sliceapp.android" monitored-apps default to
     * the current "indwin.c3.shareapp" package ID, so existing installs pick
     * up the new Slice package without the user having to edit settings.
     */
    fun migrateLegacySecrets() {
        for (alias in MIGRATABLE_ALIASES) {
            val alreadyEncrypted = prefs.getString(alias, null) != null
            val legacyValue = legacyPrefs.getString(alias, null)?.takeIf { it.isNotBlank() }
            if (!alreadyEncrypted && legacyValue != null) {
                saveSecret(alias, legacyValue)
            }
            if (legacyValue != null) {
                legacyPrefs.edit().remove(alias).apply()
            }
        }

        // Migrate "com.sliceapp.android" → "indwin.c3.shareapp" for legacy installs.
        val legacyApps = legacyPrefs.getString("monitored_apps", null)?.takeIf { it.isNotBlank() }
        if (legacyApps != null) {
            val updated = legacyApps
                .split(',')
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .map { if (it.equals("com.sliceapp.android", ignoreCase = true)) "indwin.c3.shareapp" else it }
                .distinct()
                .joinToString(",")
            if (updated != legacyApps) {
                legacyPrefs.edit().putString("monitored_apps", updated).apply()
            }
        }
    }

    private fun getOrCreateAesKey(alias: String): SecretKey {
        val existing = keyStore.getEntry(alias, null)
        if (existing is KeyStore.SecretKeyEntry) {
            return existing.secretKey
        }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(false)
                .build(),
        )
        return generator.generateKey()
    }

    companion object {
        private const val PREFS_NAME = "ledger_secure_prefs"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"

        /** Aliases that may exist as legacy plaintext in default prefs. */
        val MIGRATABLE_ALIASES = listOf("api_key", "server_url")
    }
}