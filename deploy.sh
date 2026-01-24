#!/bin/bash
# ============================================
# SmartJump.AI - Automatic Deployment Script
# For Hostinger VPS (Ubuntu/Debian)
# ============================================

set -e  # Stop on any error

echo "🚀 Starting SmartJump.AI Deployment..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/restaurant-voice-ai"
DOMAIN="resturantsolutions.online"

# Step 1: Update System
echo -e "${YELLOW}[1/8] Updating system...${NC}"
apt update && apt upgrade -y

# Step 2: Install Required Packages
echo -e "${YELLOW}[2/8] Installing required packages...${NC}"
apt install -y curl git nginx certbot python3-certbot-nginx

# Step 3: Install Node.js 20
echo -e "${YELLOW}[3/8] Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo -e "${GREEN}Node.js version: $(node -v)${NC}"

# Step 4: Install PM2
echo -e "${YELLOW}[4/8] Installing PM2...${NC}"
npm install -g pm2

# Step 5: Create App Directory
echo -e "${YELLOW}[5/8] Setting up application directory...${NC}"
mkdir -p $APP_DIR
cd $APP_DIR

# Check if files exist
if [ ! -f "server.js" ]; then
    echo -e "${RED}⚠️  Please upload your project files to $APP_DIR first!${NC}"
    echo -e "${RED}   Use FileZilla or WinSCP to upload the files.${NC}"
    echo -e "${YELLOW}After uploading, run this script again.${NC}"
    exit 1
fi

# Step 6: Install Dependencies
echo -e "${YELLOW}[6/8] Installing npm dependencies...${NC}"
npm install --production

# Step 7: Configure Nginx
echo -e "${YELLOW}[7/8] Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/restaurant-api << 'EOF'
server {
    listen 80;
    server_name resturantsolutions.online;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/restaurant-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Step 8: Start Application with PM2
echo -e "${YELLOW}[8/8] Starting application with PM2...${NC}"
cd $APP_DIR
pm2 delete restaurant-api 2>/dev/null || true
pm2 start server.js --name "restaurant-api"
pm2 save
pm2 startup

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Your app is running at: ${YELLOW}http://$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Test: curl http://$DOMAIN/health"
echo "2. Install SSL: certbot --nginx -d $DOMAIN"
echo "3. Update .env with: BASE_URL=https://$DOMAIN"
echo "4. Restart: pm2 restart restaurant-api"
echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo "  pm2 status          - Check app status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart app"
echo ""
