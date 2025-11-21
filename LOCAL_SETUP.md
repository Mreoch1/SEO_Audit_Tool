# Running SEO Audit App Locally (Free - No Database Fees)

Perfect choice! Running locally with SQLite is completely free and works great for personal use.

## Quick Start

### 1. Make sure dependencies are installed
```bash
cd /Users/michaelreoch/seo-audit-app
npm install
```

### 2. Set up your .env file

Create `.env` in the project root:

```env
# Database (SQLite - Free!)
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-here"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="your-email@gmail.com"

# Optional: PageSpeed API
PAGESPEED_INSIGHTS_API_KEY="your-api-key"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Set up database
```bash
npm run db:generate
npm run db:migrate
```

### 4. Create admin user
```bash
npm run create-user -- --email=admin@example.com --password=yourpassword
```

### 5. Start the app
```bash
npm run dev
```

Visit: `http://localhost:3000`

---

## Using the Startup Script

Even easier - use the startup script:

```bash
./start-app.sh
```

This checks everything and starts the server automatically.

---

## Accessing from Other Devices (Optional)

If you want to access it from other devices on your network:

### Option 1: Use your computer's IP
```bash
# Find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Start on all interfaces
npm run dev -- -H 0.0.0.0
```

Then access from other devices: `http://YOUR_IP:3000`

### Option 2: Use a local domain (macOS)

Edit `/etc/hosts`:
```bash
sudo nano /etc/hosts
```

Add:
```
127.0.0.1 seoauditpro.local
```

Update `.env`:
```env
NEXTAUTH_URL="http://seoauditpro.local:3000"
```

Access: `http://seoauditpro.local:3000`

---

## Keeping It Running

### Option 1: Just leave terminal open
- Simplest option
- App runs until you close terminal or press Ctrl+C

### Option 2: Use PM2 (Runs in background)
```bash
# Install PM2
npm install -g pm2

# Build the app
npm run build

# Start with PM2
pm2 start npm --name "seo-audit-app" -- start

# Useful commands
pm2 list              # See running apps
pm2 logs seo-audit-app # View logs
pm2 stop seo-audit-app # Stop
pm2 restart seo-audit-app # Restart
pm2 save              # Save process list
pm2 startup           # Auto-start on boot
```

### Option 3: Create a macOS Service (Advanced)

Create `~/Library/LaunchAgents/com.seoauditapp.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.seoauditapp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npm</string>
        <string>start</string>
        <string>--prefix</string>
        <string>/Users/michaelreoch/seo-audit-app</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/michaelreoch/seo-audit-app</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.seoauditapp.plist
```

---

## Cost Comparison

**Local (SQLite):**
- ✅ $0/month
- ✅ No database limits
- ✅ Full control
- ✅ Works offline

**Netlify + Supabase:**
- 💰 Free tier: Limited
- 💰 Paid: $25+/month
- ⚠️ Requires internet
- ⚠️ More complex setup

---

## Backup Your Data

Since you're using SQLite locally, make sure to backup:

```bash
# Backup database
cp prisma/dev.db prisma/dev.db.backup

# Or use a script
cat > backup-db.sh << 'EOF'
#!/bin/bash
cp prisma/dev.db "prisma/backups/dev-$(date +%Y%m%d-%H%M%S).db"
echo "Backup created!"
EOF
chmod +x backup-db.sh
```

---

## Daily Usage

**Start the app:**
```bash
cd /Users/michaelreoch/seo-audit-app
npm run dev
```

**Or use the script:**
```bash
./start-app.sh
```

**Access:** `http://localhost:3000`

That's it! No fees, no complexity, just works. 🎉

