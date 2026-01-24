// src/auth/api-key-auth.js - API Key Authentication for External Services
const crypto = require('crypto');

// API Key store (use database in production)
const apiKeys = new Map();

// Default API key for testing
const initDefaultApiKey = () => {
    const testKey = 'rva_test_' + crypto.randomBytes(16).toString('hex');

    // Check if we have a configured default key
    if (process.env.DEFAULT_API_KEY) {
        apiKeys.set(process.env.DEFAULT_API_KEY, {
            id: 'key_default',
            name: 'Default API Key',
            scopes: ['read', 'write', 'webhooks'],
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
            active: true
        });
    }

    console.log('ℹ️  API Key authentication enabled');
};

initDefaultApiKey();

/**
 * Generate a new API key
 * @param {Object} options - Key options
 * @returns {Object} Generated key info
 */
function generateApiKey(options = {}) {
    const { name = 'API Key', scopes = ['read'], expiresIn = null } = options;

    // Generate key with prefix for easy identification
    const keyId = 'key_' + crypto.randomBytes(8).toString('hex');
    const keySecret = 'rva_' + crypto.randomBytes(32).toString('hex');

    // Hash the key for storage (we only store hash, not the actual key)
    const keyHash = crypto
        .createHash('sha256')
        .update(keySecret)
        .digest('hex');

    const keyData = {
        id: keyId,
        keyHash,
        name,
        scopes,
        createdAt: new Date().toISOString(),
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn).toISOString() : null,
        lastUsedAt: null,
        active: true
    };

    apiKeys.set(keyHash, keyData);

    // Return the actual key (only shown once!)
    return {
        id: keyId,
        key: keySecret,
        name,
        scopes,
        expiresAt: keyData.expiresAt,
        message: 'Save this key securely! It will not be shown again.'
    };
}

/**
 * Verify API key
 * @param {string} apiKey - API key to verify
 * @returns {Object|null} Key data if valid, null otherwise
 */
function verifyApiKey(apiKey) {
    if (!apiKey) return null;

    // Hash the provided key
    const keyHash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex');

    const keyData = apiKeys.get(keyHash);

    if (!keyData) return null;

    // Check if active
    if (!keyData.active) return null;

    // Check expiration
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return null;
    }

    // Update last used
    keyData.lastUsedAt = new Date().toISOString();

    return keyData;
}

/**
 * Check if key has required scope
 * @param {Object} keyData - Key data object
 * @param {string} scope - Required scope
 * @returns {boolean}
 */
function hasScope(keyData, scope) {
    if (!keyData || !keyData.scopes) return false;
    return keyData.scopes.includes(scope) || keyData.scopes.includes('*');
}

/**
 * Revoke an API key
 * @param {string} keyId - Key ID to revoke
 * @returns {boolean}
 */
function revokeApiKey(keyId) {
    for (const [hash, data] of apiKeys.entries()) {
        if (data.id === keyId) {
            data.active = false;
            data.revokedAt = new Date().toISOString();
            return true;
        }
    }
    return false;
}

/**
 * List all API keys (without secrets)
 * @returns {Array}
 */
function listApiKeys() {
    return Array.from(apiKeys.values()).map(key => ({
        id: key.id,
        name: key.name,
        scopes: key.scopes,
        active: key.active,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt
    }));
}

/**
 * API Key Authentication Middleware
 * Supports both header and query parameter
 */
function authenticateApiKey(req, res, next) {
    // Check header first: X-API-Key or Authorization: ApiKey xxx
    let apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('ApiKey ')) {
            apiKey = authHeader.substring(7);
        }
    }

    // Fallback to query parameter (not recommended for production)
    if (!apiKey && req.query.api_key) {
        apiKey = req.query.api_key;
        console.warn('⚠️  API key passed in query string - not recommended!');
    }

    if (!apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key required. Use X-API-Key header.'
        });
    }

    const keyData = verifyApiKey(apiKey);

    if (!keyData) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired API key'
        });
    }

    // Attach key info to request
    req.apiKey = {
        id: keyData.id,
        name: keyData.name,
        scopes: keyData.scopes
    };

    next();
}

/**
 * Scope-based Authorization Middleware
 * @param {string} requiredScope - Scope required for the route
 */
function requireScope(requiredScope) {
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'API key authentication required'
            });
        }

        if (!hasScope(req.apiKey, requiredScope)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Scope '${requiredScope}' required`
            });
        }

        next();
    };
}

/**
 * Combined authentication: Accept either JWT or API Key
 */
function authenticateJWTOrApiKey(req, res, next) {
    const jwtAuth = require('./jwt-auth');

    // Check for JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return jwtAuth.authenticateJWT(req, res, next);
    }

    // Fall back to API Key
    return authenticateApiKey(req, res, next);
}

module.exports = {
    generateApiKey,
    verifyApiKey,
    hasScope,
    revokeApiKey,
    listApiKeys,
    authenticateApiKey,
    requireScope,
    authenticateJWTOrApiKey
};
