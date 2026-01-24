// src/middleware/compression.js - Response Compression and Cache Headers
const zlib = require('zlib');

/**
 * GZIP compression middleware
 * Compresses responses for supported content types
 */
function compressionMiddleware(options = {}) {
    const {
        threshold = 1024,  // Minimum size to compress (1KB)
        level = 6,         // Compression level (1-9)
        filter = defaultFilter
    } = options;

    return (req, res, next) => {
        // Check if client accepts gzip
        const acceptEncoding = req.headers['accept-encoding'] || '';

        if (!acceptEncoding.includes('gzip')) {
            return next();
        }

        // Store original methods
        const originalWrite = res.write;
        const originalEnd = res.end;

        // Buffer to collect response
        const chunks = [];
        let size = 0;

        // Override write
        res.write = function (chunk, encoding) {
            if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
                size += chunk.length;
            }
            return true;
        };

        // Override end
        res.end = function (chunk, encoding) {
            if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
                size += chunk.length;
            }

            const body = Buffer.concat(chunks);

            // Check if should compress
            if (size < threshold || !filter(req, res)) {
                // Send uncompressed
                res.setHeader('Content-Length', body.length);
                originalWrite.call(res, body);
                originalEnd.call(res);
                return;
            }

            // Compress with gzip
            zlib.gzip(body, { level }, (err, compressed) => {
                if (err) {
                    // Fallback to uncompressed
                    res.setHeader('Content-Length', body.length);
                    originalWrite.call(res, body);
                    originalEnd.call(res);
                    return;
                }

                res.setHeader('Content-Encoding', 'gzip');
                res.setHeader('Content-Length', compressed.length);
                res.setHeader('Vary', 'Accept-Encoding');

                originalWrite.call(res, compressed);
                originalEnd.call(res);
            });
        };

        next();
    };
}

/**
 * Default filter for compression
 */
function defaultFilter(req, res) {
    const contentType = res.getHeader('Content-Type') || '';

    // Compress text-based content types
    const compressible = [
        'text/',
        'application/json',
        'application/javascript',
        'application/xml'
    ];

    return compressible.some(type => contentType.includes(type));
}

/**
 * Cache control middleware
 * Sets appropriate cache headers based on route
 */
function cacheControl(options = {}) {
    const {
        maxAge = 0,
        private: isPrivate = true,
        noCache = false,
        noStore = false,
        mustRevalidate = true
    } = options;

    return (req, res, next) => {
        // Build cache control header
        const directives = [];

        if (noStore) {
            directives.push('no-store');
        } else {
            if (noCache) {
                directives.push('no-cache');
            } else {
                directives.push(isPrivate ? 'private' : 'public');
                directives.push(`max-age=${maxAge}`);
            }

            if (mustRevalidate) {
                directives.push('must-revalidate');
            }
        }

        res.setHeader('Cache-Control', directives.join(', '));

        // Add ETag support
        const originalSend = res.json.bind(res);
        res.json = function (body) {
            if (maxAge > 0 && typeof body === 'object') {
                const etag = generateETag(JSON.stringify(body));
                res.setHeader('ETag', etag);

                const ifNoneMatch = req.headers['if-none-match'];
                if (ifNoneMatch === etag) {
                    return res.status(304).end();
                }
            }

            return originalSend(body);
        };

        next();
    };
}

/**
 * Generate simple ETag
 */
function generateETag(content) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    return `"${hash.substring(0, 16)}"`;
}

/**
 * Preset cache configurations
 */
const cachePresets = {
    // No caching (default for API)
    noCache: cacheControl({ noCache: true }),

    // API responses (short cache)
    api: cacheControl({ maxAge: 60, private: true }),

    // Static content (long cache)
    static: cacheControl({ maxAge: 86400, private: false }),

    // Menu data (medium cache)
    menu: cacheControl({ maxAge: 300, private: true }),

    // User data (no store)
    sensitive: cacheControl({ noStore: true })
};

module.exports = {
    compressionMiddleware,
    cacheControl,
    cachePresets
};
