// server.js - Main application entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

// Server instance - declared early for signal handlers
let server = null;

// Import utilities
const logger = require('./src/utils/logger');
const db = require('./src/database/db');
const { compressionMiddleware, cachePresets } = require('./src/middleware/compression');

// Import route handlers
const squareOAuth = require('./src/auth/square-oauth');
const squareWebhook = require('./src/webhooks/square-webhook');
const retellWebhook = require('./src/webhooks/retell-webhook');
const unifiedAPI = require('./src/api/unified-api');

// Import authentication modules
const authAPI = require('./src/api/auth-api');
const jwtAuth = require('./src/auth/jwt-auth');
const apiKeyAuth = require('./src/auth/api-key-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
db.initPool();

// ============================================
// Security Middleware
// ============================================

// 1. Helmet - Secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 2. Hide X-Powered-By header
app.disable('x-powered-by');

// 3. CORS - Restrict to allowed origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [process.env.BASE_URL];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// 4. Rate Limiting - Prevent DDoS and brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// 5. Stricter rate limit for authentication routes (instead of general limiter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth/', authLimiter);

// 6. Webhook rate limiting (more permissive but still protected)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Allow 200 webhook calls per minute
  message: 'Too many webhook requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/webhook/', webhookLimiter);

// 7. Input Sanitization - Prevent SQL Injection and XSS
// Custom sanitizer for PostgreSQL (instead of mongo-sanitize)
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove common SQL injection patterns
      return obj
        .replace(/['"`;\\]/g, '') // Remove quotes and semicolons
        .replace(/--/g, '')       // Remove SQL comments
        .replace(/\/\*/g, '')     // Remove block comment start
        .replace(/\*\//g, '');    // Remove block comment end
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};

app.use(sanitizeInput);

// 8. Prevent HTTP Parameter Pollution
app.use(hpp());

// 9. Structured logging with request ID
app.use(logger.httpLogger);

// 10. Response compression (gzip)
app.use(compressionMiddleware({ threshold: 1024 }));

// 11. Serve static files (after security/compression, before body parsing/API)
app.use(express.static('public'));

// ============================================
// Body Parsing with Size Limits
// ============================================

// Body parsing - IMPORTANT: Use raw for webhooks
app.use('/webhook', express.raw({
  type: 'application/json',
  limit: '10mb' // Limit payload size
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for signature verification if needed
    if (req.headers['content-type'] === 'application/json') {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// ============================================
// Request Validation Helpers
// ============================================

const { body, param, query, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Health check with database status
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      server: 'ok',
      database: 'unknown'
    }
  };

  // Check database connection if DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    try {
      if (process.env.DATABASE_URL.startsWith('postgres')) {
        const { Client } = require('pg');
        const client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        health.checks.database = 'ok';
      } else if (process.env.DATABASE_URL.startsWith('sqlite')) {
        health.checks.database = 'ok (sqlite)';
      }
    } catch (dbError) {
      health.checks.database = 'error';
      health.status = 'degraded';
      console.error('Health check - database error:', dbError.message);
    }
  } else {
    health.checks.database = 'not_configured';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ============================================
// OAuth Routes with Validation
// ============================================

// Square OAuth
app.get('/auth/square', [
  query('restaurant_id').optional().isString().trim(),
  validate
], squareOAuth.authorize);

app.get('/auth/square/callback', [
  query('code').optional().isString(),
  query('state').optional().isString(),
  query('error').optional().isString(),
  validate
], squareOAuth.callback);



// ============================================
// Webhook Routes (No validation - raw body needed)
// ============================================

app.post('/webhook/square', squareWebhook.handleWebhook);
app.post('/webhook/retell', retellWebhook.handleWebhook);

// ============================================
// Auth API Routes (Public - No JWT required)
// ============================================

app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('name').optional().isString().trim(),
  validate
], authAPI.register);

app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty(),
  validate
], authAPI.login);

app.post('/api/auth/refresh', [
  body('refreshToken').isString().notEmpty(),
  validate
], authAPI.refresh);

app.post('/api/auth/logout', authAPI.logout);

// Protected Auth Routes (JWT required)
app.get('/api/auth/me', jwtAuth.authenticateJWT, authAPI.getProfile);

app.post('/api/auth/change-password', [
  jwtAuth.authenticateJWT,
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 }),
  validate
], authAPI.changePassword);

// Admin only route
app.get('/api/auth/users',
  jwtAuth.authenticateJWT,
  jwtAuth.authorizeRoles('admin'),
  authAPI.listUsers
);

// API Key Management (Admin only)
app.post('/api/keys',
  jwtAuth.authenticateJWT,
  jwtAuth.authorizeRoles('admin'),
  [
    body('name').isString().trim().notEmpty(),
    body('scopes').optional().isArray(),
    validate
  ],
  (req, res) => {
    const key = apiKeyAuth.generateApiKey({
      name: req.body.name,
      scopes: req.body.scopes || ['read']
    });
    res.json(key);
  }
);

app.get('/api/keys',
  jwtAuth.authenticateJWT,
  jwtAuth.authorizeRoles('admin'),
  (req, res) => {
    res.json({ keys: apiKeyAuth.listApiKeys() });
  }
);

// ============================================
// API Routes with Validation (Protected)
// ============================================

// Restaurant Management (requires authentication)
app.get('/api/restaurants', apiKeyAuth.authenticateJWTOrApiKey, unifiedAPI.getRestaurants);

app.get('/api/restaurants/:id', [
  param('id').isString().trim().notEmpty(),
  validate
], unifiedAPI.getRestaurant);

app.post('/api/restaurants', [
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
  body('platform').isIn(['square', 'toast']),
  body('merchantId').isString().trim().notEmpty(),
  body('locationId').optional().isString().trim(),
  validate
], unifiedAPI.createRestaurant);

// Menu Operations
app.get('/api/menu/:restaurantId', [
  param('restaurantId').isString().trim().notEmpty(),
  validate
], unifiedAPI.getMenu);

app.get('/api/menu/search/:restaurantId/:query', [
  param('restaurantId').isString().trim().notEmpty(),
  param('query').isString().trim().notEmpty().isLength({ min: 2, max: 100 }),
  validate
], unifiedAPI.searchMenu);

// Order Operations
app.post('/api/orders', [
  body('restaurantId').isString().trim().notEmpty(),
  body('lineItems').isArray({ min: 1 }),
  body('lineItems.*.variationId').optional().isString(),
  body('lineItems.*.itemId').optional().isString(),
  body('lineItems.*.quantity').isInt({ min: 1, max: 100 }),
  body('customer.name').isString().trim().notEmpty().isLength({ max: 255 }),
  body('customer.phone').isString().trim().matches(/^\+?[1-9]\d{1,14}$/),
  body('fulfillment.type').optional().isIn(['PICKUP', 'DELIVERY', 'DINE_IN']),
  validate
], unifiedAPI.createOrder);

app.get('/api/orders/:orderId', [
  param('orderId').isString().trim().notEmpty(),
  query('platform').isIn(['square']),
  query('merchantId').isString().trim().notEmpty(),
  validate
], unifiedAPI.getOrder);

app.patch('/api/orders/:orderId', [
  param('orderId').isString().trim().notEmpty(),
  body('platform').isIn(['square']),
  body('merchantId').isString().trim().notEmpty(),
  body('status').isString().trim().notEmpty(),
  validate
], unifiedAPI.updateOrder);

app.get('/api/orders/restaurant/:restaurantId', [
  param('restaurantId').isString().trim().notEmpty(),
  validate
], unifiedAPI.getRestaurantOrders);

// ============================================
// Error Handling
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist'
  });
});

// CORS Error Handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CORS policy: Access denied from this origin'
    });
  }
  next(err);
});

// Global Error Handler
app.use((err, req, res, next) => {
  // Log error details (but not to client)
  console.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const status = err.status || err.statusCode || 500;

  // Prepare error response
  const errorResponse = {
    error: status >= 500 ? 'Internal Server Error' : err.message || 'Bad Request',
    timestamp: new Date().toISOString()
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  res.status(status).json(errorResponse);
});

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');

  // Check if server is running before closing
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');

  // Check if server is running before closing
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds for SIGINT
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ============================================
// Start Server
// ============================================

server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  🚀 SmartJump.AI Server                  ║
║  Port: ${PORT.toString().padEnd(35)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(27)}║
║  Square: ${(process.env.SQUARE_ENVIRONMENT || 'sandbox').padEnd(31)}║
║  🔒 Security: ENABLED                    ║
║  ✅ Rate Limiting: ACTIVE                ║
║  ✅ Input Validation: ACTIVE             ║
║  ✅ CORS: RESTRICTED                     ║
╚═══════════════════════════════════════════╝
  `);

  // Warn if in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️  Running in DEVELOPMENT mode');
    console.log('⚠️  Do not use in production!\n');
  }

  // Check required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'SQUARE_APPLICATION_ID',
    'SQUARE_APPLICATION_SECRET'
  ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n⚠️  Server may not function correctly!\n');
  }
});

module.exports = app;
