-- src/database/schema.sql - Database Schema
-- Restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('square', 'toast')),
    merchant_id VARCHAR(100) NOT NULL,
    location_id VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, merchant_id)
);
-- OAuth tokens table
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id SERIAL PRIMARY KEY,
    restaurant_id VARCHAR(50) REFERENCES restaurants(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,
    merchant_id VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    scopes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, merchant_id)
);
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
    active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(50) PRIMARY KEY,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    scopes TEXT [] DEFAULT ARRAY ['read'],
    active BOOLEAN DEFAULT true,
    created_by VARCHAR(50) REFERENCES users(id),
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Refresh tokens table (for JWT)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY,
    restaurant_id VARCHAR(50) REFERENCES restaurants(id),
    platform VARCHAR(20) NOT NULL,
    platform_order_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    total_amount INTEGER,
    -- in cents
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    fulfillment_type VARCHAR(20),
    -- 'PICKUP', 'DELIVERY', 'DINE_IN'
    fulfillment_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, platform_order_id)
);
-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    item_id VARCHAR(100),
    variation_id VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_price INTEGER,
    -- in cents
    total_price INTEGER,
    -- in cents
    modifiers JSONB,
    -- array of modifier objects
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Call logs table (Retell AI)
CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    call_id VARCHAR(100) UNIQUE NOT NULL,
    restaurant_id VARCHAR(50) REFERENCES restaurants(id),
    order_id VARCHAR(100) REFERENCES orders(id),
    from_number VARCHAR(20),
    to_number VARCHAR(20),
    agent_id VARCHAR(100),
    duration_seconds INTEGER,
    transcript TEXT,
    call_analysis JSONB,
    sentiment VARCHAR(20),
    disconnection_reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);
-- Webhook events table (for deduplication)
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(20) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    merchant_id VARCHAR(100),
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);
-- Menu cache table (optional - for performance)
CREATE TABLE IF NOT EXISTS menu_cache (
    id SERIAL PRIMARY KEY,
    restaurant_id VARCHAR(50) REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(restaurant_id)
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_restaurant ON call_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_order ON call_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at);
-- Views for analytics
-- Daily orders summary
CREATE OR REPLACE VIEW daily_orders_summary AS
SELECT restaurant_id,
    DATE(created_at) as order_date,
    COUNT(*) as total_orders,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as average_order_value
FROM orders
WHERE status NOT IN ('CANCELED', 'FAILED')
GROUP BY restaurant_id,
    DATE(created_at);
-- Restaurant performance
CREATE OR REPLACE VIEW restaurant_performance AS
SELECT r.id,
    r.name,
    r.platform,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT c.id) as total_calls,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value,
    AVG(c.duration_seconds) as avg_call_duration
FROM restaurants r
    LEFT JOIN orders o ON r.id = o.restaurant_id
    LEFT JOIN call_logs c ON r.id = c.restaurant_id
GROUP BY r.id,
    r.name,
    r.platform;
-- Comments
COMMENT ON TABLE restaurants IS 'Stores restaurant information and POS platform details';
COMMENT ON TABLE oauth_tokens IS 'Stores OAuth access and refresh tokens for each platform';
COMMENT ON TABLE orders IS 'Main orders table tracking all orders across platforms';
COMMENT ON TABLE order_items IS 'Individual items within each order';
COMMENT ON TABLE call_logs IS 'Logs of all Retell AI voice calls';
COMMENT ON TABLE webhook_events IS 'Tracks webhook events for deduplication and audit';
COMMENT ON TABLE menu_cache IS 'Caches menu data to reduce API calls';