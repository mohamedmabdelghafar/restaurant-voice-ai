// src/auth/token-manager.js - Centralized Token Management
// NOTE: square-oauth is loaded lazily to avoid circular dependency
// token-manager.js <-> square-oauth.js

const encryption = require('../utils/encryption');

/**
 * Lazy load square-oauth module to prevent circular dependency
 * @returns {Object} square-oauth module
 */
function getSquareOAuth() {
  return require('./square-oauth');
}

/**
 * In-memory storage (replace with database in production)
 * Structure: Map<merchantId, { platform, accessToken (encrypted), refreshToken (encrypted), expiresAt, ... }>
 */
const tokenStore = new Map();

/**
 * Store OAuth tokens for a merchant (with encryption)
 */
async function storeTokens(tokenData) {
  const key = `${tokenData.platform}_${tokenData.merchantId}`;

  // Encrypt sensitive tokens before storage
  const encryptedData = {
    ...tokenData,
    accessToken: tokenData.accessToken ? encryption.encrypt(tokenData.accessToken) : null,
    refreshToken: tokenData.refreshToken ? encryption.encrypt(tokenData.refreshToken) : null,
    updatedAt: new Date().toISOString()
  };

  tokenStore.set(key, encryptedData);

  console.log(`Tokens stored (encrypted) for ${tokenData.platform} merchant:`, tokenData.merchantId);

  // TODO: Save to database
  // await db.query('INSERT INTO tokens ...')

  return true;
}

/**
 * Get valid access token (auto-refresh if expired)
 */
async function getAccessToken(platform, merchantId) {
  const key = `${platform}_${merchantId}`;
  const tokenData = tokenStore.get(key);

  if (!tokenData) {
    throw new Error(`No tokens found for ${platform} merchant: ${merchantId}`);
  }

  // Square tokens expire after 30 days
  if (platform === 'square') {
    const now = new Date();
    const expiresAt = new Date(tokenData.expiresAt);

    // Refresh if expired or expiring within 1 day
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (expiresAt <= oneDayFromNow) {
      console.log(`Refreshing Square token for merchant: ${merchantId}`);

      try {
        // Decrypt refresh token before using it
        const decryptedRefreshToken = encryption.decrypt(tokenData.refreshToken);
        const newTokens = await getSquareOAuth().refreshAccessToken(decryptedRefreshToken);

        // Update stored tokens
        await storeTokens({
          platform: 'square',
          merchantId: newTokens.merchantId,
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt,
          restaurantId: tokenData.restaurantId
        });

        return newTokens.accessToken;

      } catch (error) {
        console.error('Token refresh failed:', error);
        throw new Error('Access token expired and refresh failed');
      }
    }
  }

  // Decrypt and return the stored token
  return encryption.decrypt(tokenData.accessToken);
}

/**
 * Get all token data for a merchant
 */
function getTokenData(platform, merchantId) {
  const key = `${platform}_${merchantId}`;
  return tokenStore.get(key);
}

/**
 * Remove tokens (on revocation or deletion)
 */
function removeTokens(platform, merchantId) {
  const key = `${platform}_${merchantId}`;
  tokenStore.delete(key);
  console.log(`Tokens removed for ${platform} merchant:`, merchantId);
}

/**
 * Get all connected merchants
 */
function getAllMerchants() {
  const merchants = [];

  for (const [key, data] of tokenStore.entries()) {
    merchants.push({
      platform: data.platform,
      merchantId: data.merchantId,
      restaurantId: data.restaurantId,
      connectedAt: data.updatedAt
    });
  }

  return merchants;
}

/**
 * Check if merchant is connected
 */
function isConnected(platform, merchantId) {
  const key = `${platform}_${merchantId}`;
  return tokenStore.has(key);
}

/**
 * Auto-refresh scheduler (run every 7 days)
 * Refreshes all Square tokens to prevent expiration
 */
async function autoRefreshSquareTokens() {
  console.log('Starting auto-refresh of Square tokens...');

  for (const [key, data] of tokenStore.entries()) {
    if (data.platform === 'square') {
      try {
        await getAccessToken('square', data.merchantId);
        console.log(`Auto-refreshed token for merchant: ${data.merchantId}`);
      } catch (error) {
        console.error(`Failed to refresh token for merchant ${data.merchantId}:`, error);
      }
    }
  }

  console.log('Auto-refresh completed');
}

// Run auto-refresh every 7 days
setInterval(autoRefreshSquareTokens, 7 * 24 * 60 * 60 * 1000);

module.exports = {
  storeTokens,
  getAccessToken,
  getTokenData,
  removeTokens,
  getAllMerchants,
  isConnected,
  autoRefreshSquareTokens
};
