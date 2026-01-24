# 🚀 Quick Start Guide - 15 Minutes to First Order

## Prerequisites (5 minutes)
```bash
✅ Node.js 18+ installed
✅ Square Developer account (free, instant)
✅ Code editor (VS Code)
```

---

## Step 1: Clone & Install (2 minutes)

```bash
# Download code
git clone <repository>
cd restaurant-voice-ai

# Install packages
npm install

# Copy environment file
cp .env.example .env
```

---

## Step 2: Setup Square (3 minutes)

### A. Create Square App
1. Go to: https://developer.squareup.com/apps
2. Click "+" to create app
3. Name it: "Voice AI Test"
4. Copy credentials:

```env
SQUARE_APPLICATION_ID=sq0idp-xxxxxxxxxxxxx
SQUARE_APPLICATION_SECRET=sq0csp-xxxxxxxxxxxxx
```

### B. Get Sandbox Token
1. In Square app, click "OAuth" tab
2. Scroll to "Test accounts"
3. Click "Generate token"
4. Copy sandbox token:

```env
SQUARE_ACCESS_TOKEN=EAAAxxxxxxxxxxxxx
SQUARE_ENVIRONMENT=sandbox
```

### C. Get Location ID
1. Run this command:
```bash
node -e "
const { Client } = require('square');
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: 'sandbox'
});
client.locationsApi.listLocations().then(r => 
  console.log('Location ID:', r.result.locations[0].id)
);
"
```

2. Add to `.env`:
```env
SQUARE_LOCATION_ID=Lxxxxxxxxxxxxx
```

---

## Step 3: Database Setup (1 minute)

```bash
# For quick testing, use SQLite
echo "DATABASE_URL=sqlite:./database.sqlite" >> .env

# Setup database
npm run db:setup
```

---

## Step 4: Start Server (1 minute)

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Expose with ngrok
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and update `.env`:
```env
BASE_URL=https://abc123.ngrok.io
```

Restart server: `npm start`

---

## Step 5: Connect Restaurant (2 minutes)

### A. Register Restaurant
```bash
curl -X POST http://localhost:3000/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Burger Shop",
    "platform": "square",
    "merchantId": "sandbox_merchant",
    "locationId": "YOUR_LOCATION_ID_HERE"
  }'
```

Save the restaurant ID (e.g., `rest_1234567890`)

### B. Test OAuth (Optional)
```bash
# Open in browser
http://localhost:3000/auth/square?restaurant_id=rest_1234567890
```

---

## Step 6: Get Menu (1 minute)

```bash
# Get full menu
curl http://localhost:3000/api/menu/rest_1234567890

# Search for item
curl http://localhost:3000/api/menu/search/rest_1234567890/burger
```

---

## Step 7: Create First Order! (1 minute)

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "rest_1234567890",
    "lineItems": [
      {
        "variationId": "VARIATION_ID_FROM_MENU",
        "quantity": 2,
        "modifiers": []
      }
    ],
    "customer": {
      "name": "Mohamed",
      "phone": "+201234567890"
    },
    "fulfillment": {
      "type": "PICKUP"
    }
  }'
```

✅ **Order created!** Check Square Sandbox Dashboard to see it.

---

## 🎉 Success! What's Next?

### Add Retell AI (Voice Ordering)

1. **Get Retell API Key:**
   - Sign up at https://retellai.com
   - Copy API key to `.env`

2. **Configure Webhook:**
   ```env
   RETELL_API_KEY=key_xxxxxxxxxxxxx
   RETELL_AGENT_ID=agent_xxxxxxxxxxxxx
   ```

3. **Update Retell webhook URL:**
   - Set to: `https://your-ngrok-url.ngrok.io/webhook/retell`

4. **Test call** - orders will auto-create!

---

## 🔄 Setup n8n Automation

1. **Install n8n:**
   ```bash
   npx n8n
   ```

2. **Import workflow:**
   - Open n8n: http://localhost:5678
   - Settings → Import
   - Select: `src/n8n/workflows.json`

3. **Activate workflow**

---

## 📱 Add Clover POS

1. **Create Clover app:**
   - https://www.clover.com/developers
   
2. **Add to `.env`:**
   ```env
   CLOVER_APP_ID=xxxxxxxxxxxxx
   CLOVER_APP_SECRET=xxxxxxxxxxxxx
   CLOVER_ENVIRONMENT=sandbox
   ```

3. **Connect restaurant:**
   ```bash
   # Open in browser
   http://localhost:3000/auth/clover
   ```

---

## 🐛 Troubleshooting

### "Cannot find module 'square'"
```bash
npm install
```

### "Database connection failed"
```bash
npm run db:setup
```

### "Invalid access token"
- Generate new sandbox token from Square dashboard
- Update SQUARE_ACCESS_TOKEN in .env

### "Webhook not working"
- Ensure ngrok is running
- Update BASE_URL in .env
- Restart server

---

## 📚 Resources

- **Square API Docs:** https://developer.squareup.com/docs
- **Clover API Docs:** https://docs.clover.com
- **Retell AI Docs:** https://docs.retellai.com
- **n8n Docs:** https://docs.n8n.io

---

## 💡 Pro Tips

1. **Use Sandbox first** - test everything before production
2. **Save tokens securely** - never commit .env to git
3. **Test webhooks** - use ngrok for local testing
4. **Monitor logs** - `tail -f logs/app.log`
5. **Backup database** - before making changes

---

## 🎯 Next Steps

- [ ] Add more restaurants
- [ ] Configure webhooks
- [ ] Setup SMS notifications
- [ ] Deploy to production
- [ ] Add Clover integration
- [ ] Connect Retell AI
- [ ] Build admin dashboard

**Need help?** Check DEPLOYMENT.md for detailed guides!
