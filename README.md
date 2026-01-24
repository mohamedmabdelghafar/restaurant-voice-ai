# Restaurant Voice AI - Square POS Integration

🔒 **v2.0.0 - Square POS Edition**

AI Voice Ordering System integrated with Square POS using Retell AI and n8n.

## ⭐ Key Features

- 🎤 **AI Voice Ordering** - Retell AI integration for phone orders
- 🏪 **Square POS Integration** - Full menu and order management
- 🔐 **OAuth 2.0 Authentication** - Secure merchant authorization
- 🔄 **n8n Automation** - Advanced workflow orchestration
- 📊 **Unified API** - Clean RESTful interface
- ⚡ **Real-time Webhooks** - Instant order updates
- 🛡️ **Production-Ready Security** - Enterprise-grade protection

## 🔒 Security Features

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
│   │   ├── jwt-auth.js          # JWT authentication
│   │   ├── api-key-auth.js      # API key authentication
│   │   └── token-manager.js     # Token refresh & storage
│   ├── api/
│   │   ├── square-api.js        # Square menu & orders
│   │   ├── auth-api.js          # User authentication API
│   │   └── unified-api.js       # Unified interface
│   ├── webhooks/
│   │   ├── square-webhook.js    # Square webhooks
│   │   └── retell-webhook.js    # Retell AI webhooks
│   ├── n8n/
│   │   └── workflows.json       # n8n workflow templates
│   ├── database/
│   │   ├── schema.sql           # Database schema
│   │   ├── db.js                # Database connection
│   │   └── setup.js             # Database setup
│   ├── middleware/
│   │   └── compression.js       # Response compression
│   └── utils/
│       ├── encryption.js        # Data encryption
│       └── logger.js            # Structured logging
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
- **POS Integration**: Square API
- **Voice AI**: Retell AI
- **Automation**: n8n
- **Database**: PostgreSQL (Neon) or SQLite
- **Authentication**: OAuth 2.0, JWT, API Keys

## 🔧 Configuration

### Square Setup

1. Create app at <https://developer.squareup.com/apps>
2. Copy Application ID and Secret to `.env`
3. Set redirect URL: `https://yourapp.com/auth/square/callback`
4. Configure webhook URL: `https://yourapp.com/webhook/square`

### Retell AI Setup

1. Get API key from Retell AI
2. Configure webhook URL: `https://yourapp.com/webhook/retell`

## 📖 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### OAuth

- `GET /auth/square` - Square authorization
- `GET /auth/square/callback` - Square callback

### Menu

- `GET /api/menu/:restaurantId` - Get restaurant menu
- `GET /api/menu/search/:restaurantId/:query` - Search menu items

### Orders

- `POST /api/orders` - Create new order
- `GET /api/orders/:orderId` - Get order status
- `PATCH /api/orders/:orderId` - Update order

### Webhooks

- `POST /webhook/square` - Square events
- `POST /webhook/retell` - Retell AI events

### Health

- `GET /health` - Server health check

## 🌐 Live Demo

- **Production**: <https://resturantsolutions.online>
- **Health Check**: <https://resturantsolutions.online/health>

## 📝 License

MIT
