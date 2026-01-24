// src/utils/encryption.js - Data Encryption Utilities
const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Get encryption key from environment or generate one
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.warn('⚠️  ENCRYPTION_KEY not configured - using auto-generated key (not suitable for production!)');
    ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}

// Ensure key is 32 bytes (256 bits) for AES-256
const getKey = () => {
    if (ENCRYPTION_KEY.length === 64) {
        // Hex string
        return Buffer.from(ENCRYPTION_KEY, 'hex');
    } else if (ENCRYPTION_KEY.length === 32) {
        // Raw 32-byte string
        return Buffer.from(ENCRYPTION_KEY, 'utf8');
    } else {
        // Hash the key to get correct length
        return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    }
};

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted data as base64 string
 */
function encrypt(plaintext) {
    if (!plaintext) return null;

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = getKey();

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH
        });

        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Combine IV + AuthTag + Encrypted data
        const combined = Buffer.concat([
            iv,
            authTag,
            Buffer.from(encrypted, 'base64')
        ]);

        return combined.toString('base64');
    } catch (error) {
        console.error('Encryption error:', error.message);
        throw new Error('Encryption failed');
    }
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Base64 encrypted data
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedData) {
    if (!encryptedData) return null;

    try {
        const combined = Buffer.from(encryptedData, 'base64');

        // Extract IV, AuthTag, and encrypted data
        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const key = getKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH
        });

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error.message);
        throw new Error('Decryption failed');
    }
}

/**
 * Hash data using SHA-256 (one-way)
 * @param {string} data - Data to hash
 * @returns {string} Hex hash
 */
function hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash with salt (for passwords - but prefer bcrypt for passwords)
 * @param {string} data - Data to hash
 * @param {string} salt - Salt (optional, will generate if not provided)
 * @returns {Object} { hash, salt }
 */
function hashWithSalt(data, salt = null) {
    const useSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hashed = crypto
        .createHmac('sha256', useSalt)
        .update(data)
        .digest('hex');

    return {
        hash: hashed,
        salt: useSalt
    };
}

/**
 * Verify salted hash
 * @param {string} data - Original data
 * @param {string} hashedData - Hashed data to compare
 * @param {string} salt - Salt used in hashing
 * @returns {boolean}
 */
function verifySaltedHash(data, hashedData, salt) {
    const { hash: computed } = hashWithSalt(data, salt);
    return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(hashedData, 'hex')
    );
}

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} Hex token
 */
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypt object (JSON)
 * @param {Object} obj - Object to encrypt
 * @returns {string} Encrypted base64 string
 */
function encryptObject(obj) {
    return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt to object (JSON)
 * @param {string} encryptedData - Encrypted base64 string
 * @returns {Object} Decrypted object
 */
function decryptObject(encryptedData) {
    const decrypted = decrypt(encryptedData);
    return JSON.parse(decrypted);
}

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of visible characters at start and end
 * @returns {string} Masked data
 */
function maskSensitiveData(data, visibleChars = 4) {
    if (!data) return '***';
    if (data.length <= visibleChars * 2) return '***';

    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const masked = '*'.repeat(Math.min(data.length - visibleChars * 2, 8));

    return `${start}${masked}${end}`;
}

module.exports = {
    encrypt,
    decrypt,
    hash,
    hashWithSalt,
    verifySaltedHash,
    generateSecureToken,
    encryptObject,
    decryptObject,
    maskSensitiveData,
    ALGORITHM
};
