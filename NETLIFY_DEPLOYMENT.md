# Deploying to Netlify (seoauditpro.net)

Complete guide for deploying your SEO Audit App to Netlify with your custom domain.

## Prerequisites

1. **Netlify account** (free tier works)
2. **Domain**: seoauditpro.net (pointed to Netlify)
3. **Database**: PostgreSQL (SQLite won't work on Netlify - it's serverless)

## Important Notes

⚠️ **SQLite won't work on Netlify** - Netlify is serverless, so you need a hosted database:
- **Free options**: Supabase, Neon, Railway, PlanetScale
- **Recommended**: Supabase (free tier, easy setup)

⚠️ **Puppeteer**: May need adjustments for Netlify's serverless environment. Consider using a headless browser service or adjusting Puppeteer config.

## Step 1: Set Up Database (Supabase - Free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Get your connection string from Settings → Database
4. It will look like: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

## Step 2: Install Netlify CLI

```bash
npm install -g netlify-cli
```

## Step 3: Login to Netlify

```bash
netlify login
```

This will open your browser to authorize.

## Step 4: Initialize Netlify Site

```bash
cd /Users/michaelreoch/seo-audit-app
netlify init
```

Follow the prompts:
- **Create & configure a new site**: Yes
- **Team**: Select your team (or create one)
- **Site name**: seo-audit-app (or any name)
- **Build command**: `npm run build` (should auto-detect)
- **Directory to deploy**: `.next` (should auto-detect)

## Step 5: Update Database Schema for PostgreSQL

Your Prisma schema should work, but make sure your `DATABASE_URL` uses PostgreSQL format:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
```

## Step 6: Set Environment Variables in Netlify

### Option A: Via Netlify Dashboard (Recommended)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add these variables:

```
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
NEXTAUTH_URL=https://seoauditpro.net
NEXTAUTH_SECRET=your-strong-random-secret-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
PAGESPEED_INSIGHTS_API_KEY=your-api-key (optional)
```

### Option B: Via CLI

```bash
netlify env:set DATABASE_URL "postgresql://postgres:password@host:5432/postgres"
netlify env:set NEXTAUTH_URL "https://seoauditpro.net"
netlify env:set NEXTAUTH_SECRET "your-strong-random-secret"
netlify env:set SMTP_HOST "smtp.gmail.com"
netlify env:set SMTP_PORT "587"
netlify env:set SMTP_USER "your-email@gmail.com"
netlify env:set SMTP_PASSWORD "your-app-password"
netlify env:set SMTP_FROM "your-email@gmail.com"
```

**Generate a strong NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

## Step 7: Run Database Migrations

You need to run migrations before deploying. You can do this:

### Option A: Run locally with production database

Temporarily set your local `.env` to use the production database, then:

```bash
npm run db:generate
npm run db:migrate
```

### Option B: Use Prisma Studio with production database

```bash
DATABASE_URL="your-production-url" npx prisma studio
```

### Option C: Use Supabase SQL Editor

Copy the migration SQL from `prisma/migrations/` and run it in Supabase SQL Editor.

## Step 8: Add Next.js Plugin to package.json

The `netlify.toml` references the Next.js plugin. Make sure it's installed:

```bash
npm install --save-dev @netlify/plugin-nextjs
```

Or add to `package.json`:
```json
"devDependencies": {
  "@netlify/plugin-nextjs": "^4.39.0"
}
```

## Step 9: Deploy to Netlify

### Option A: Deploy via CLI

```bash
netlify deploy --prod
```

### Option B: Deploy via Git (Recommended)

1. **Push to GitHub/GitLab/Bitbucket**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main
   ```

2. **Connect to Netlify**:
   - Go to Netlify dashboard
   - Click **Add new site** → **Import an existing project**
   - Connect your Git provider
   - Select your repository
   - Netlify will auto-detect Next.js settings

3. **Auto-deploy**: Every push to main branch will auto-deploy

## Step 10: Add Custom Domain

1. Go to **Site settings** → **Domain management**
2. Click **Add custom domain**
3. Enter: `seoauditpro.net`
4. Netlify will give you DNS records to add:
   - **A record**: `@` → Netlify IP
   - **CNAME**: `www` → your-site.netlify.app
5. Add these records in your domain registrar
6. Wait for DNS propagation (5-60 minutes)
7. Netlify will automatically provision SSL certificate

## Step 11: Create Admin User

After deployment, create your admin user:

### Option A: Use Netlify Functions (Recommended)

Create a one-time function to create users, or:

### Option B: Run locally with production database

```bash
DATABASE_URL="your-production-database-url" npm run create-user -- --email=admin@example.com --password=yourpassword
```

### Option C: Use Prisma Studio

```bash
DATABASE_URL="your-production-database-url" npx prisma studio
```

Then manually create a user with a hashed password.

## Step 12: Test Your Deployment

1. Visit `https://seoauditpro.net`
2. You should see the login page
3. Log in with your admin credentials
4. Test creating an audit

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
- Make sure all dependencies are in `package.json` (not just devDependencies)
- Run `npm install` locally to verify

**Error: "Prisma Client not generated"**
- Add to `package.json` scripts:
  ```json
  "postinstall": "prisma generate"
  ```

### Database Connection Issues

- Verify `DATABASE_URL` is correct in Netlify dashboard
- Check if your database allows connections from Netlify IPs
- Supabase: Go to Settings → Database → Connection Pooling (use the pooler URL)

### Puppeteer Issues

Puppeteer may not work on Netlify's serverless functions. Options:

1. **Use a headless browser service**: Browserless.io, ScrapingBee
2. **Adjust Puppeteer config** for serverless:
   ```javascript
   const browser = await puppeteer.launch({
     args: ['--no-sandbox', '--disable-setuid-sandbox'],
     executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
   });
   ```
3. **Use Netlify Edge Functions** (if compatible)

### NextAuth Issues

- Make sure `NEXTAUTH_URL` is exactly `https://seoauditpro.net` (no trailing slash)
- Verify `NEXTAUTH_SECRET` is set and strong
- Check Netlify function logs for errors

### Environment Variables Not Working

- Make sure variables are set for **Production** environment
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

## Updating Your App

### Via Git (Auto-deploy)

```bash
git add .
git commit -m "Update app"
git push
```

Netlify will automatically build and deploy.

### Via CLI

```bash
netlify deploy --prod
```

## Monitoring

- **Deploy logs**: Netlify dashboard → Deploys
- **Function logs**: Netlify dashboard → Functions
- **Analytics**: Netlify dashboard → Analytics (paid feature)

## Security

✅ **Your app is protected by NextAuth** - only logged-in users can access

**Additional security options:**
- **Netlify Password Protection**: Site settings → Access control (paid)
- **IP Whitelisting**: Not available on Netlify (use NextAuth only)
- **Rate Limiting**: Can be added via Netlify Edge Functions

## Quick Reference

```bash
# Deploy
netlify deploy --prod

# View logs
netlify logs:function

# Open site
netlify open:site

# View environment variables
netlify env:list

# Set environment variable
netlify env:set VARIABLE_NAME "value"
```

## Cost

- **Netlify Free Tier**: 100GB bandwidth, 300 build minutes/month
- **Supabase Free Tier**: 500MB database, 2GB bandwidth
- **Total**: $0/month for small-medium usage

---

Your app will be live at `https://seoauditpro.net` and protected by your NextAuth login! 🚀

