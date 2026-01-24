// src/auth/square-oauth.js - Square OAuth 2.0 Implementation
const crypto = require('crypto');
const TokenManager = require('./token-manager');

const config = {
  applicationId: process.env.SQUARE_APPLICATION_ID,
  applicationSecret: process.env.SQUARE_APPLICATION_SECRET,
  environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
  redirectUri: `${process.env.BASE_URL}/auth/square/callback`
};

const BASE_URL = config.environment === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com';

// Required permissions for restaurant ordering
const SCOPES = [
  'MERCHANT_PROFILE_READ',
  'ORDERS_READ',
  'ORDERS_WRITE',
  'PAYMENTS_READ',
  'PAYMENTS_WRITE',
  'ITEMS_READ',
  'INVENTORY_READ',
  'CUSTOMERS_READ'
].join('+');

// Temporary storage for CSRF tokens (use Redis in production)
const csrfTokens = new Map();

/**
 * Step 1: Redirect merchant to Square authorization page
 */
async function authorize(req, res) {
  try {
    // Generate CSRF token for security
    const csrfToken = crypto.randomBytes(32).toString('hex');
    csrfTokens.set(csrfToken, { 
      timestamp: Date.now(),
      restaurantId: req.query.restaurant_id // Optional: track which restaurant
    });
    
    // Clean old tokens (older than 10 minutes)
    for (const [token, data] of csrfTokens.entries()) {
      if (Date.now() - data.timestamp > 600000) {
        csrfTokens.delete(token);
      }
    }
    
    const authUrl = `${BASE_URL}/oauth2/authorize?` +
      `client_id=${config.applicationId}&` +
      `scope=${SCOPES}&` +
      `state=${csrfToken}&` +
      `session=false`;
    
    console.log('Redirecting to Square authorization:', authUrl);
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('Square OAuth authorization error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
}

/**
 * Step 2: Handle OAuth callback from Square
 */
async function callback(req, res) {
  const { code, state, error, error_description } = req.query;
  
  try {
    // Handle authorization errors
    if (error) {
      console.error('Square authorization error:', error, error_description);
      return res.status(400).json({ 
        error,
        description: error_description 
      });
    }
    
    // Validate CSRF token
    if (!csrfTokens.has(state)) {
      console.error('Invalid CSRF token:', state);
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    const csrfData = csrfTokens.get(state);
    csrfTokens.delete(state);
    
    // Exchange authorization code for access token
    const tokens = await exchangeCodeForTokens(code);
    
    // Store tokens securely
    await TokenManager.storeTokens({
      platform: 'square',
      merchantId: tokens.merchantId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      restaurantId: csrfData.restaurantId
    });
    
    console.log('Square authorization successful for merchant:', tokens.merchantId);
    
    // Redirect to success page or return JSON
    res.json({
      success: true,
      platform: 'square',
      merchantId: tokens.merchantId,
      message: 'Square connected successfully'
    });
    
  } catch (error) {
    console.error('Square OAuth callback error:', error);
    res.status(500).json({ 
      error: 'Token exchange failed',
      details: error.message 
    });
  }
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(authorizationCode) {
  const response = await fetch(`${BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Square-Version': '2025-01-23'
    },
    body: JSON.stringify({
      client_id: config.applicationId,
      client_secret: config.applicationSecret,
      code: authorizationCode,
      grant_type: 'authorization_code'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || JSON.stringify(data.errors));
  }
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    merchantId: data.merchant_id,
    tokenType: data.token_type
  };
}

/**
 * Refresh expired access token
 */
async function refreshAccessToken(refreshToken) {
  const response = await fetch(`${BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Square-Version': '2025-01-23'
    },
    body: JSON.stringify({
      client_id: config.applicationId,
      client_secret: config.applicationSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Token refresh failed');
  }
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    merchantId: data.merchant_id
  };
}

module.exports = {
  authorize,
  callback,
  refreshAccessToken,
  BASE_URL
};
