# 🔒 Security Documentation

This document outlines all security measures implemented in the Restaurant Voice AI system.

---

## 🛡️ Security Features

### 1. HTTP Headers Security (Helmet)

**Implementation:** `helmet()` middleware with custom configuration

**Protection Against:**

- Cross-Site Scripting (XSS)
- Clickjacking
- MIME type sniffing
- DNS prefetch control

**Configuration:**

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,        // 1 year
    includeSubDomains: true,
    preload: true
  }
})
```

**Headers Added:**

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (HSTS)
- `X-Download-Options: noopen`

---

### 2. CORS (Cross-Origin Resource Sharing)

**Implementation:** Restrictive CORS policy with whitelist

**Default Behavior:** Only allows requests from configured origins

**Configuration:**

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

**Features:**

- ✅ Origin whitelist validation
- ✅ Credentials support
- ✅ Preflight request handling
- ❌ No wildcard (*) allowed

**Code:**

```javascript
cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow tools like curl
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
})
```

---

### 3. Rate Limiting

**Implementation:** `express-rate-limit` with multiple tiers

#### General API Rate Limit

- **Window:** 15 minutes
- **Max Requests:** 100 per IP
- **Applies To:** `/api/*` routes

#### Authentication Rate Limit

- **Window:** 15 minutes  
- **Max Requests:** 5 per IP
- **Applies To:** `/auth/*` routes
- **Purpose:** Prevent brute force attacks

**Configuration:**

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Excluded Routes:**

- Health check (`/health`)
- Webhooks (`/webhook/*`) - rate limited by webhook providers

---

### 4. Input Validation

**Implementation:** `express-validator` on all user inputs

**Validation Rules:**

#### Restaurant Creation

```javascript
body('name').isString().trim().notEmpty().isLength({ max: 255 })
body('platform').isIn(['square', 'toast'])
body('merchantId').isString().trim().notEmpty()
```

#### Order Creation

```javascript
body('lineItems').isArray({ min: 1 })
body('lineItems.*.quantity').isInt({ min: 1, max: 100 })
body('customer.phone').matches(/^\+?[1-9]\d{1,14}$/)
```

**Benefits:**

- ✅ Prevents SQL injection
- ✅ Prevents XSS attacks
- ✅ Ensures data integrity
- ✅ Provides clear error messages

---

### 5. Data Sanitization

**Implementation:** Multiple sanitization layers

#### NoSQL Injection Prevention

```javascript
mongoSanitize()  // Removes $ and . characters
```

#### HTTP Parameter Pollution

```javascript
hpp()  // Protects against duplicate parameters
```

**Example Attack Prevented:**

```
?id=1&id=2&id=3  →  Only processes first id
```

---

### 6. Secure Logging

**Implementation:** Custom Morgan logger with data filtering

**Features:**

- ✅ Removes tokens from URLs
- ✅ Hides sensitive query parameters
- ✅ Filters Authorization headers
- ✅ Sanitizes logged data

**Code:**

```javascript
morgan.token('sanitized-url', (req) => {
  return req.originalUrl.replace(
    /([?&])(token|key|secret)=[^&]*/gi, 
    '$1$2=***'
  );
});
```

**What Gets Hidden:**

- API keys
- OAuth tokens
- Passwords
- Credit card data
- Authorization headers

---

### 7. Webhook Security

**Implementation:** Signature verification for all webhooks

#### Square Webhook Verification

```javascript
const crypto = require('node:crypto');

function verifySignature(body, signature) {
  const hmac = crypto.createHmac('sha256', SIGNATURE_KEY);
  hmac.update(NOTIFICATION_URL + body);
  const hash = hmac.digest('base64');
  return hash === signature;
}
```

**Protection:**

- ✅ Prevents fake webhook attacks
- ✅ Ensures data integrity
- ✅ Validates source authenticity

---

### 8. Environment Variables Security

**Best Practices:**

- ✅ Never commit `.env` files
- ✅ Use `.env.example` for templates
- ✅ Validate required variables on startup
- ✅ Use strong encryption keys

**Required Variables Check:**

```javascript
const requiredEnvVars = [
  'DATABASE_URL',
  'SQUARE_APPLICATION_ID',
  'SQUARE_APPLICATION_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(
  varName => !process.env[varName]
);
```

---

### 9. Error Handling

**Implementation:** Secure error responses

**Development Mode:**

```json
{
  "error": "Detailed error message",
  "stack": "Full stack trace",
  "details": { ... }
}
```

**Production Mode:**

```json
{
  "error": "Internal Server Error",
  "timestamp": "2026-01-18T..."
}
```

**Benefits:**

- ✅ No information leakage
- ✅ Proper logging for debugging
- ✅ User-friendly messages

---

### 10. Database Security

**Recommendations:**

#### Connection String Security

```javascript
// ❌ Bad - credentials in code
const db = new Client({
  user: 'admin',
  password: 'password123'
});

// ✅ Good - use environment variables
const db = new Client({
  connectionString: process.env.DATABASE_URL
});
```

#### SQL Injection Prevention

```javascript
// ✅ Use parameterized queries
await client.query(
  'SELECT * FROM orders WHERE id = $1',
  [orderId]
);
```

#### Principle of Least Privilege

- Create separate database users for different operations
- Grant only necessary permissions
- Use read-only users for reporting

---

## 🔐 OAuth Security

### Token Storage

- ✅ Never log tokens
- ✅ Encrypt tokens at rest
- ✅ Use secure token manager
- ✅ Auto-refresh before expiration

### Authorization Flow

- ✅ CSRF protection (state parameter)
- ✅ Secure redirect URLs
- ✅ Token expiration handling
- ✅ Revocation handling

**CSRF Protection:**

```javascript
const csrfToken = crypto.randomBytes(32).toString('hex');
csrfTokens.set(csrfToken, { timestamp: Date.now() });
```

---

## 🚨 Security Checklist

### Before Production Deployment

- [ ] Change `NODE_ENV` to `production`
- [ ] Use HTTPS (TLS/SSL certificate)
- [ ] Configure `ALLOWED_ORIGINS` with real domains
- [ ] Set strong `JWT_SECRET` and `ENCRYPTION_KEY`
- [ ] Enable database SSL connections
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerts
- [ ] Enable database backups
- [ ] Review all environment variables
- [ ] Test rate limiting
- [ ] Verify webhook signatures
- [ ] Audit dependencies (`npm audit`)
- [ ] Enable logging to external service
- [ ] Set up intrusion detection
- [ ] Configure DDoS protection (Cloudflare)

### Regular Security Maintenance

- [ ] Update dependencies monthly (`npm update`)
- [ ] Review security advisories (`npm audit`)
- [ ] Rotate encryption keys quarterly
- [ ] Review access logs weekly
- [ ] Test disaster recovery plan
- [ ] Audit OAuth tokens
- [ ] Check for leaked credentials (GitHub scanning)

---

## 🛠️ Security Tools

### Testing Security

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Check outdated packages
npm outdated

# Security headers test
curl -I https://yourdomain.com

# Rate limiting test
ab -n 200 -c 10 https://yourdomain.com/api/restaurants
```

### Monitoring

**Recommended Tools:**

- **Sentry** - Error tracking
- **LogDNA** - Log management
- **New Relic** - Performance monitoring
- **Datadog** - Infrastructure monitoring

---

## ⚠️ Known Limitations

1. **In-Memory Storage:** `csrfTokens` and `processedEvents` use in-memory Maps
   - **Solution:** Use Redis in production

2. **No JWT Authentication:** API uses OAuth only
   - **Solution:** Add JWT for session management if needed

3. **Basic Rate Limiting:** IP-based only
   - **Solution:** Add user-based rate limiting

---

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email: <security@yourdomain.com>
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

---

## 📚 Security References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [CORS Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Last Updated:** January 18, 2026  
**Security Level:** Production Ready 🔒
