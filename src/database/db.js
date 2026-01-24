// src/database/db.js - Database Service with Connection Pooling
const { Pool } = require('pg');
const logger = require('../utils/logger').createChild({ service: 'database' });

// Connection pool configuration
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX) || 20,           // Maximum connections
    min: parseInt(process.env.DB_POOL_MIN) || 2,            // Minimum connections
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT) || 5000,
    allowExitOnIdle: false
};

// Create pool instance
let pool = null;

/**
 * Initialize database pool
 */
function initPool() {
    if (!process.env.DATABASE_URL) {
        logger.warn('DATABASE_URL not configured - using in-memory storage');
        return null;
    }

    pool = new Pool(poolConfig);

    // Pool error handler
    pool.on('error', (err) => {
        logger.error('Unexpected pool error', { error: err.message });
    });

    // Connection handler
    pool.on('connect', () => {
        logger.debug('New database connection established');
    });

    logger.info('Database pool initialized', {
        max: poolConfig.max,
        min: poolConfig.min
    });

    return pool;
}

/**
 * Get database pool
 * @returns {Pool|null}
 */
function getPool() {
    if (!pool && process.env.DATABASE_URL) {
        return initPool();
    }
    return pool;
}

/**
 * Execute query with automatic connection handling
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
    const currentPool = getPool();

    if (!currentPool) {
        throw new Error('Database not configured');
    }

    const start = Date.now();

    try {
        const result = await currentPool.query(text, params);
        const duration = Date.now() - start;

        logger.debug('Query executed', {
            query: text.substring(0, 100),
            duration: `${duration}ms`,
            rows: result.rowCount
        });

        return result;
    } catch (error) {
        logger.error('Query failed', {
            query: text.substring(0, 100),
            error: error.message
        });
        throw error;
    }
}

/**
 * Execute query with transaction
 * @param {Function} callback - Function receiving client
 * @returns {Promise<any>}
 */
async function transaction(callback) {
    const currentPool = getPool();

    if (!currentPool) {
        throw new Error('Database not configured');
    }

    const client = await currentPool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Check database health
 * @returns {Promise<Object>}
 */
async function healthCheck() {
    const currentPool = getPool();

    if (!currentPool) {
        return { status: 'not_configured' };
    }

    try {
        const start = Date.now();
        await currentPool.query('SELECT 1');
        const duration = Date.now() - start;

        return {
            status: 'healthy',
            responseTime: `${duration}ms`,
            totalConnections: currentPool.totalCount,
            idleConnections: currentPool.idleCount,
            waitingRequests: currentPool.waitingCount
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
}

/**
 * Close all connections
 */
async function close() {
    if (pool) {
        await pool.end();
        logger.info('Database pool closed');
        pool = null;
    }
}

// ============================================
// Repository Functions
// ============================================

/**
 * Get restaurant by ID
 */
async function getRestaurantById(id) {
    const result = await query(
        'SELECT * FROM restaurants WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

/**
 * Get all restaurants
 */
async function getAllRestaurants() {
    const result = await query('SELECT * FROM restaurants ORDER BY created_at DESC');
    return result.rows;
}

/**
 * Create restaurant
 */
async function createRestaurant(data) {
    const result = await query(
        `INSERT INTO restaurants (id, name, platform, merchant_id, location_id, phone, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
        [data.id, data.name, data.platform, data.merchantId, data.locationId, data.phone, true]
    );
    return result.rows[0];
}

/**
 * Store OAuth tokens
 */
async function storeTokens(data) {
    const result = await query(
        `INSERT INTO oauth_tokens (platform, merchant_id, access_token, refresh_token, expires_at, restaurant_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (platform, merchant_id) 
     DO UPDATE SET 
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING *`,
        [data.platform, data.merchantId, data.accessToken, data.refreshToken, data.expiresAt, data.restaurantId]
    );
    return result.rows[0];
}

/**
 * Get OAuth tokens
 */
async function getTokens(platform, merchantId) {
    const result = await query(
        'SELECT * FROM oauth_tokens WHERE platform = $1 AND merchant_id = $2',
        [platform, merchantId]
    );
    return result.rows[0] || null;
}

/**
 * Store user
 */
async function createUser(data) {
    const result = await query(
        `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, role, created_at`,
        [data.id, data.email, data.passwordHash, data.name, data.role]
    );
    return result.rows[0];
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
    const result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );
    return result.rows[0] || null;
}

/**
 * Get user by ID
 */
async function getUserById(id) {
    const result = await query(
        'SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

module.exports = {
    initPool,
    getPool,
    query,
    transaction,
    healthCheck,
    close,
    // Repositories
    getRestaurantById,
    getAllRestaurants,
    createRestaurant,
    storeTokens,
    getTokens,
    createUser,
    getUserByEmail,
    getUserById
};
