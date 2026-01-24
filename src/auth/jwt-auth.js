// src/auth/jwt-auth.js - JWT Authentication Middleware
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Warn if using auto-generated secret
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not configured - using auto-generated secret (not suitable for production!)');
}

// Store for refresh tokens (use Redis in production)
const refreshTokenStore = new Map();

/**
 * Generate access token
 * @param {Object} payload - User data to encode
 * @returns {string} JWT access token
 */
function generateAccessToken(payload) {
    return jwt.sign(
        {
            ...payload,
            type: 'access',
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Generate refresh token
 * @param {Object} payload - User data to encode
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
    const refreshToken = jwt.sign(
        {
            ...payload,
            type: 'refresh',
            jti: crypto.randomUUID(), // Unique token ID
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    // Store refresh token for validation
    const decoded = jwt.decode(refreshToken);
    refreshTokenStore.set(decoded.jti, {
        userId: payload.userId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(decoded.exp * 1000).toISOString()
    });

    // Clean expired tokens periodically
    cleanExpiredRefreshTokens();

    return refreshToken;
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object with id and role
 * @returns {Object} Access and refresh tokens
 */
function generateTokenPair(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role || 'user'
    };

    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
        expiresIn: JWT_EXPIRES_IN,
        tokenType: 'Bearer'
    };
}

/**
 * Verify and decode token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        throw error;
    }
}

/**
 * Verify refresh token and generate new access token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} New access token
 */
function refreshAccessToken(refreshToken) {
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
    }

    // Check if refresh token is in store (not revoked)
    if (!refreshTokenStore.has(decoded.jti)) {
        throw new Error('Refresh token revoked or invalid');
    }

    // Generate new access token
    const payload = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
    };

    return {
        accessToken: generateAccessToken(payload),
        expiresIn: JWT_EXPIRES_IN,
        tokenType: 'Bearer'
    };
}

/**
 * Revoke refresh token (logout)
 * @param {string} refreshToken - Token to revoke
 */
function revokeRefreshToken(refreshToken) {
    try {
        const decoded = jwt.decode(refreshToken);
        if (decoded && decoded.jti) {
            refreshTokenStore.delete(decoded.jti);
            return true;
        }
    } catch (error) {
        console.error('Error revoking token:', error.message);
    }
    return false;
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 */
function revokeAllUserTokens(userId) {
    for (const [jti, data] of refreshTokenStore.entries()) {
        if (data.userId === userId) {
            refreshTokenStore.delete(jti);
        }
    }
}

/**
 * Clean expired refresh tokens
 */
function cleanExpiredRefreshTokens() {
    const now = new Date();
    for (const [jti, data] of refreshTokenStore.entries()) {
        if (new Date(data.expiresAt) < now) {
            refreshTokenStore.delete(jti);
        }
    }
}

// Clean tokens every hour
setInterval(cleanExpiredRefreshTokens, 60 * 60 * 1000);

/**
 * JWT Authentication Middleware
 * Protects routes by requiring valid JWT
 */
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No authorization header provided'
        });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid authorization format. Use: Bearer <token>'
        });
    }

    const token = parts[1];

    try {
        const decoded = verifyToken(token);

        if (decoded.type !== 'access') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token type'
            });
        }

        // Attach user info to request
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: error.message
        });
    }
}

/**
 * Optional JWT Authentication Middleware
 * Attaches user to request if valid token present, but doesn't block
 */
function optionalAuthenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next();
    }

    const parts = authHeader.split(' ');

    if (parts.length === 2 && parts[0] === 'Bearer') {
        try {
            const decoded = verifyToken(parts[1]);
            if (decoded.type === 'access') {
                req.user = {
                    id: decoded.userId,
                    email: decoded.email,
                    role: decoded.role
                };
            }
        } catch (error) {
            // Ignore invalid tokens for optional auth
        }
    }

    next();
}

/**
 * Role-based Authorization Middleware
 * @param {Array<string>} allowedRoles - Roles allowed to access the route
 */
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions'
            });
        }

        next();
    };
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateTokenPair,
    verifyToken,
    refreshAccessToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    authenticateJWT,
    optionalAuthenticateJWT,
    authorizeRoles,
    JWT_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN
};
