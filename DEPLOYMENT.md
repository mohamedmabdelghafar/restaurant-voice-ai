# Deployment & Testing Guide

## 🚀 Local Development Setup

### 1. Prerequisites
```bash
# Required software
- Node.js 18+
- PostgreSQL 14+ (or SQLite for testing)
- n8n (self-hosted or cloud)
- ngrok (for local webhook testing)
```

### 2. Installation
```bash
# Clone repository
git clone <your-repo>
cd restaurant-voice-ai

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 3. Database Setup
```bash
# For PostgreSQL
createdb restaurant_ai
npm run db:setup

# For SQLite (testing)
# Just run npm run db:setup (will create database.sqlite)
```

### 4. Start Development Server
```bash
npm run dev

# Server will start on http://localhost:3000
```

### 5. Expose Local Server (for webhooks)
```bash
# In new terminal
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update .env: BASE_URL=https://abc123.ngrok.io
```

---

## 🧪 Testing OAuth Flows

### Testing Square OAuth

1. **Start server** with ngrok
2. **Configure Square app:**
   - Redirect URL: `https://abc123.ngrok.io/auth/square/callback`
3. **Test authorization:**
   ```bash
   # Open in browser
   http://localhost:3000/auth/square?restaurant_id=test_rest_1
   ```
4. **Complete authorization** on Square page
5. **Check logs** for tokens

### Testing Clover OAuth

1. **Configure Clover app:**
   - Redirect URL: `https://abc123.ngrok.io/auth/clover/callback`
2. **Test authorization:**
   ```bash
   http://localhost:3000/auth/clover?restaurant_id=test_rest_1
   ```
3. **Complete authorization** on Clover page

---

## 📋 Testing API Endpoints

### Get Menu
```bash
# Square menu
curl http://localhost:3000/api/menu/test_rest_1

# Search menu
curl http://localhost:3000/api/menu/search/test_rest_1/burger
```

### Create Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "test_rest_1",
    "lineItems": [
      {
        "variationId": "variation_id_here",
        "quantity": 2,
        "modifiers": []
      }
    ],
    "customer": {
      "name": "John Doe",
      "phone": "+1234567890"
    },
    "fulfillment": {
      "type": "PICKUP",
      "pickupTime": null
    }
  }'
```

---

## 🔔 Testing Webhooks

### Square Webhook Test
```bash
# Configure in Square Dashboard:
# Webhook URL: https://abc123.ngrok.io/webhook/square
# Subscribe to: order.created, order.updated, payment.created

# Test with Square API Explorer or create test order
```

### Retell Webhook Test
```bash
# Configure in Retell Dashboard:
# Webhook URL: https://abc123.ngrok.io/webhook/retell

# Make test call to trigger webhook
```

---

## 🌐 Production Deployment

### Option 1: Railway (Recommended)

1. **Create Railway account**
2. **New Project** → Deploy from GitHub
3. **Add PostgreSQL** database
4. **Set environment variables:**
   - Copy all from `.env`
   - Update `BASE_URL` to Railway URL
5. **Deploy**

### Option 2: Heroku

```bash
# Install Heroku CLI
heroku create restaurant-voice-ai

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set SQUARE_APPLICATION_ID=xxx
heroku config:set SQUARE_APPLICATION_SECRET=xxx
# ... (set all variables)

# Deploy
git push heroku main

# Run database setup
heroku run npm run db:setup
```

### Option 3: VPS (DigitalOcean, Linode, AWS)

```bash
# SSH into server
ssh user@your-server

# Install Node.js & PostgreSQL
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# Clone and setup
git clone <your-repo>
cd restaurant-voice-ai
npm install
npm run db:setup

# Install PM2 for process management
npm install -g pm2
pm2 start server.js --name restaurant-ai
pm2 save
pm2 startup

# Setup Nginx reverse proxy
sudo apt-get install nginx
# Configure nginx (see nginx.conf example below)
```

---

## 🔧 Production Configuration

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL Certificate (Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🔄 n8n Integration

### Setup n8n Workflows

1. **Import workflow:**
   - Open n8n
   - Settings → Import from File
   - Select `src/n8n/workflows.json`

2. **Configure credentials:**
   - PostgreSQL connection
   - Twilio (for SMS)
   - HTTP Auth for API calls

3. **Update webhook URLs:**
   - Retell webhook: `https://your-n8n.com/webhook/retell-order`

4. **Activate workflow**

---

## 📊 Monitoring & Logs

### View Logs (PM2)
```bash
pm2 logs restaurant-ai
pm2 monit
```

### Database Monitoring
```bash
# PostgreSQL
psql -d restaurant_ai -c "SELECT * FROM restaurants;"
psql -d restaurant_ai -c "SELECT COUNT(*) FROM orders;"
```

### Health Check
```bash
curl https://yourdomain.com/health
```

---

## 🐛 Troubleshooting

### OAuth Issues
- ✅ Check redirect URLs match exactly
- ✅ Verify credentials are correct
- ✅ Ensure HTTPS in production
- ✅ Check token expiration

### Webhook Issues
- ✅ Verify webhook URL is accessible
- ✅ Check signature verification
- ✅ Review webhook logs
- ✅ Test with ngrok first

### Database Issues
- ✅ Check DATABASE_URL format
- ✅ Verify database exists
- ✅ Run migrations: `npm run db:setup`
- ✅ Check connection limits

---

## 📞 Support

For issues:
1. Check server logs
2. Review webhook event logs
3. Test in sandbox first
4. Contact support

---

## 🔐 Security Checklist

- [ ] All credentials in environment variables
- [ ] HTTPS enabled in production
- [ ] Webhook signature verification active
- [ ] Database backups configured
- [ ] Rate limiting enabled
- [ ] Error messages don't expose secrets
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] CORS configured properly
