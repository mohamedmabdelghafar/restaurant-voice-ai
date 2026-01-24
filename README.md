# Restaurant Voice AI - Multi-POS Integration

🔒 **v1.1.0 - Security Hardened Edition**

AI Voice Ordering System integrated with Square, Clover, and Toast POS systems using Retell AI and n8n.

## ⭐ Key Features

- 🎤 **AI Voice Ordering** - Retell AI integration for phone orders
- 🏪 **Multi-POS Support** - Square, Clover, and Toast
- 🔐 **OAuth 2.0 Authentication** - Secure merchant authorization
- 🔄 **n8n Automation** - Advanced workflow orchestration
- 📊 **Unified API** - Single interface for all POS systems
- ⚡ **Real-time Webhooks** - Instant order updates
- 🛡️ **Production-Ready Security** - Enterprise-grade protection

## 🔒 Security Features (NEW in v1.1.0)

✅ **Helmet.js** - HTTP header security (XSS, Clickjacking protection)  
✅ **Rate Limiting** - DDoS and brute force prevention  
✅ **Input Validation** - SQL injection and XSS prevention  
✅ **CORS Whitelist** - Restricted origin access  
✅ **Data Sanitization** - NoSQL injection protection  
✅ **Secure Logging** - Sensitive data filtering  
✅ **Webhook Verification** - HMAC signature validation  

📖 **See [SECURITY.md](SECURITY.md) for complete security documentation**

## 🏗️ Project Structure

```
restaurant-voice-ai/
├── src/
│   ├── auth/
│   │   ├── square-oauth.js      # Square OAuth handler
│   │   ├── clover-oauth.js      # Clover OAuth handler
│   │   └── token-manager.js     # Token refresh & storage
│   ├── api/
│   │   ├── square-api.js        # Square menu & orders
│   │   ├── clover-api.js        # Clover menu & orders
│   │   └── unified-api.js       # Unified interface
│   ├── webhooks/
│   │   ├── square-webhook.js    # Square webhooks
│   │   ├── clover-webhook.js    # Clover webhooks
│   │   └── retell-webhook.js    # Retell AI webhooks
│   ├── n8n/
│   │   └── workflows.json       # n8n workflow templates
│   └── database/
│       └── schema.sql           # Database schema
├── .env.example
├── package.json
└── server.js                    # Main Express server
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Setup Database
```bash
npm run db:setup
```

### 4. Start Server
```bash
npm start
```

## 📊 Tech Stack

- **Backend**: Node.js + Express
- **POS Integration**: Square API, Clover REST API
- **Voice AI**: Retell AI
- **Automation**: n8n
- **Database**: PostgreSQL or SQLite
- **Authentication**: OAuth 2.0

## 🔧 Configuration

### Square Setup
1. Create app at https://developer.squareup.com/apps
2. Copy Application ID and Secret to `.env`
3. Set redirect URL: `https://yourapp.com/auth/square/callback`

### Clover Setup
1. Create app at https://www.clover.com/developers
2. Get API credentials
3. Submit for approval (3-5 days)

### Retell AI Setup
1. Get API key from Retell AI
2. Configure webhook URL: `https://yourapp.com/webhook/retell`

## 📖 API Endpoints

### OAuth
- `GET /auth/square` - Square authorization
- `GET /auth/square/callback` - Square callback
- `GET /auth/clover` - Clover authorization
- `GET /auth/clover/callback` - Clover callback

### Menu
- `GET /api/menu/:restaurantId` - Get restaurant menu
- `GET /api/search/:query` - Search menu items

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:orderId` - Get order status
- `PATCH /api/orders/:orderId` - Update order

### Webhooks
- `POST /webhook/square` - Square events
- `POST /webhook/clover` - Clover events
- `POST /webhook/retell` - Retell AI events

## 🏃 Development Timeline

| Phase | Duration |
|-------|----------|
| Setup & OAuth | 3-4 days |
| Menu APIs | 2-3 days |
| Order APIs | 2-3 days |
| n8n Integration | 1-2 days |
| Testing | 2-3 days |
| **Total** | **12-18 days** |

## 📝 License

MIT
