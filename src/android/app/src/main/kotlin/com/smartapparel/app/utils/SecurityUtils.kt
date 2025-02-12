package com.smartapparel.app.utils

import android.security.keystore.KeyGenParameterSpec // version: API 29+
import android.security.keystore.KeyProperties // version: API 29+
import android.util.Base64
import java.security.KeyStore // version: API 29+
import java.security.SecureRandom // version: API 29+
import javax.crypto.Cipher // version: API 29+
import javax.crypto.KeyGenerator // version: API 29+
import javax.crypto.SecretKey // version: API 29+
import javax.crypto.spec.GCMParameterSpec
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import com.smartapparel.app.utils.Constants.API_CONFIG.ENCRYPTION_CONFIG

/**
 * Data class representing encrypted data with metadata for integrity verification
 */
data class EncryptedData(
    val data: ByteArray,
    val iv: ByteArray,
    val authTag: ByteArray,
    val timestamp: Long,
    val compressed: Boolean
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as EncryptedData
        return data.contentEquals(other.data) &&
                iv.contentEquals(other.iv) &&
                authTag.contentEquals(other.authTag) &&
                timestamp == other.timestamp &&
                compressed == other.compressed
    }

    override fun hashCode(): Int {
        var result = data.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        result = 31 * result + authTag.contentHashCode()
        result = 31 * result + timestamp.hashCode()
        result = 31 * result + compressed.hashCode()
        return result
    }
}

/**
 * Singleton class providing comprehensive cryptographic operations with hardware-backed security
 */
object SecurityUtils {
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val MASTER_KEY_ALIAS = "SmartApparel_MasterKey"
    private const val TRANSFORMATION_AES_GCM = "AES/GCM/NoPadding"
    private const val KEY_SIZE_BITS = 256
    private const val GCM_TAG_LENGTH = 128
    private const val IV_LENGTH_BYTES = 12
    private const val KEY_ROTATION_INTERVAL_MS = TimeUnit.DAYS.toMillis(90) // 90 days rotation
    
    private val keyStore: KeyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply {
        load(null)
    }
    private val secureRandom = SecureRandom()

    init {
        if (!keyStore.containsAlias(MASTER_KEY_ALIAS)) {
            generateMasterKey()
        }
    }

    /**
     * Generates or retrieves the hardware-backed master encryption key
     */
    @Synchronized
    private fun generateMasterKey(): SecretKey {
        val existingKey = keyStore.getKey(MASTER_KEY_ALIAS, null) as? SecretKey
        
        // Check if key rotation is needed
        if (existingKey != null) {
            val entry = keyStore.getEntry(MASTER_KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
            val creationDate = entry?.creationDate?.time ?: 0
            if (System.currentTimeMillis() - creationDate < KEY_ROTATION_INTERVAL_MS) {
                return existingKey
            }
        }

        // Generate new key with hardware-backed protection
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_PROVIDER
        )

        val keyGenParameterSpec = KeyGenParameterSpec.Builder(
            MASTER_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        ).apply {
            setKeySize(KEY_SIZE_BITS)
            setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            setUserAuthenticationRequired(false)
            setRandomizedEncryptionRequired(true)
            setIsStrongBoxBacked(true)
        }.build()

        keyGenerator.init(keyGenParameterSpec)
        return keyGenerator.generateKey()
    }

    /**
     * Encrypts data using AES-256-GCM with hardware acceleration
     */
    @Throws(SecurityException::class)
    fun encryptData(data: ByteArray, requireAuth: Boolean = false): EncryptedData {
        if (data.isEmpty()) {
            throw IllegalArgumentException("Data to encrypt cannot be empty")
        }

        val masterKey = generateMasterKey()
        val cipher = Cipher.getInstance(TRANSFORMATION_AES_GCM)
        val iv = ByteArray(IV_LENGTH_BYTES).apply {
            secureRandom.nextBytes(this)
        }

        cipher.init(Cipher.ENCRYPT_MODE, masterKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        
        val encrypted = cipher.doFinal(data)
        val authTag = encrypted.takeLast(GCM_TAG_LENGTH / 8).toByteArray()
        val encryptedData = encrypted.dropLast(GCM_TAG_LENGTH / 8).toByteArray()

        return EncryptedData(
            data = encryptedData,
            iv = iv,
            authTag = authTag,
            timestamp = System.currentTimeMillis(),
            compressed = false
        )
    }

    /**
     * Decrypts AES-256-GCM encrypted data with integrity verification
     */
    @Throws(SecurityException::class)
    fun decryptData(encryptedData: EncryptedData, requireAuth: Boolean = false): ByteArray {
        val masterKey = generateMasterKey()
        val cipher = Cipher.getInstance(TRANSFORMATION_AES_GCM)

        cipher.init(
            Cipher.DECRYPT_MODE,
            masterKey,
            GCMParameterSpec(GCM_TAG_LENGTH, encryptedData.iv)
        )

        val combinedData = ByteBuffer.allocate(
            encryptedData.data.size + encryptedData.authTag.size
        ).apply {
            put(encryptedData.data)
            put(encryptedData.authTag)
        }.array()

        return cipher.doFinal(combinedData)
    }

    /**
     * Creates cryptographically secure SHA-256 hash with salt
     */
    fun hashString(input: String, salt: ByteArray? = null): String {
        val saltBytes = salt ?: ByteArray(32).apply { secureRandom.nextBytes(this) }
        val messageDigest = MessageDigest.getInstance("SHA-256")
        
        messageDigest.update(saltBytes)
        val hash = messageDigest.digest(input.toByteArray())
        
        return Base64.encodeToString(
            ByteBuffer.allocate(saltBytes.size + hash.size)
                .put(saltBytes)
                .put(hash)
                .array(),
            Base64.NO_WRAP
        )
    }

    /**
     * Generates cryptographically secure token using hardware RNG
     */
    fun generateSecureToken(length: Int = 32): String {
        require(length > 0) { "Token length must be positive" }
        
        val randomBytes = ByteArray(length).apply {
            secureRandom.nextBytes(this)
        }
        
        return Base64.encodeToString(randomBytes, Base64.URL_SAFE or Base64.NO_WRAP)
            .take(length)
            .toString()
    }

    /**
     * Securely clears sensitive data from memory
     */
    private fun clearSensitiveData(data: ByteArray) {
        secureRandom.nextBytes(data)
    }
}