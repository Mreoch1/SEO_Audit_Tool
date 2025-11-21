# Running the SEO Audit App Independently

This guide shows you how to run your app without opening Cursor AI.

## Quick Start

### Development Mode (for testing)

1. **Open Terminal** (not Cursor)
2. **Navigate to your project**:
   ```bash
   cd /Users/michaelreoch/seo-audit-app
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```
4. **Access the app**: Open `http://localhost:3000` in your browser

The app will keep running until you press `Ctrl+C` in the terminal.

---

## Production Mode (for actual use)

### Option 1: Simple Production Build

1. **Build the app**:
   ```bash
   cd /Users/michaelreoch/seo-audit-app
   npm run build
   ```

2. **Start the production server**:
   ```bash
   npm start
   ```

3. **Access the app**: Open `http://localhost:3000` in your browser

### Option 2: Using PM2 (Recommended - Keeps app running in background)

PM2 keeps your app running even if you close the terminal.

1. **Install PM2 globally**:
   ```bash
   npm install -g pm2
   ```

2. **Build the app**:
   ```bash
   cd /Users/michaelreoch/seo-audit-app
   npm run build
   ```

3. **Start with PM2**:
   ```bash
   pm2 start npm --name "seo-audit-app" -- start
   ```

4. **Useful PM2 commands**:
   ```bash
   pm2 list              # See running apps
   pm2 logs seo-audit-app # View logs
   pm2 stop seo-audit-app # Stop the app
   pm2 restart seo-audit-app # Restart the app
   pm2 delete seo-audit-app # Remove from PM2
   pm2 save              # Save current process list
   pm2 startup           # Auto-start on system boot
   ```

---

## Environment Setup

Before running, make sure you have a `.env` file with required variables:

```bash
# Create .env file if it doesn't exist
cd /Users/michaelreoch/seo-audit-app
touch .env
```

Add these variables to `.env`:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-key-here"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="your-email@gmail.com"

# Optional: PageSpeed Insights API
PAGESPEED_INSIGHTS_API_KEY="your-api-key-here"
```

---

## Creating a Startup Script (Mac)

Create a simple script to start the app with one command:

1. **Create the script**:
   ```bash
   nano ~/start-seo-audit.sh
   ```

2. **Add this content**:
   ```bash
   #!/bin/bash
   cd /Users/michaelreoch/seo-audit-app
   npm run dev
   ```

3. **Make it executable**:
   ```bash
   chmod +x ~/start-seo-audit.sh
   ```

4. **Run it anytime**:
   ```bash
   ~/start-seo-audit.sh
   ```

---

## Running on a Different Port

If port 3000 is busy, run on a different port:

```bash
PORT=3001 npm run dev
```

Or for production:
```bash
PORT=3001 npm start
```

---

## Troubleshooting

### "Port already in use"
- Kill the process: `lsof -ti:3000 | xargs kill -9`
- Or use a different port (see above)

### "Database not found"
- Run: `npm run db:generate && npm run db:migrate`

### "Module not found"
- Run: `npm install`

### App stops when terminal closes
- Use PM2 (see Option 2 above) to keep it running in background

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:studio` | Open database GUI |
| `npm run audit -- --url=https://example.com` | Run CLI audit |

---

## Next Steps

1. Set up your `.env` file with proper credentials
2. Create an admin user: `npm run create-user -- --email=admin@example.com --password=yourpassword`
3. Start the app: `npm run dev`
4. Access at `http://localhost:3000`

For production, use PM2 to keep it running 24/7.

