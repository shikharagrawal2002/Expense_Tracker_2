package com.ledger.smsforwarder

import android.content.Context
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
 */
class SecretStore(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    fun saveSecret(alias: String, value: String) {
        val key = getOrCreateAesKey(alias)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))

        val encodedIv = Base64.encodeToString(iv, Base64.NO_WRAP)
        val encodedCt = Base64.encodeToString(ciphertext, Base64.NO_WRAP)
        prefs.edit().putString(alias, "$encodedIv:$encodedCt").apply()
    }

    fun readSecret(alias: String): String? {
        val stored = prefs.getString(alias, null) ?: return null
        val parts = stored.split(":")
        if (parts.size != 2) return null
        val iv = Base64.decode(parts[0], Base64.NO_WRAP)
        val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)

        return try {
            val entry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry ?: return null
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, entry.secretKey, GCMParameterSpec(128, iv))
            String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        } catch (e: Exception) {
            null
        }
    }

    fun clear(alias: String) {
        prefs.edit().remove(alias).apply()
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
    }
}