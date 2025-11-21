# Netlify Quick Start Guide

Quick checklist to get your app live on `seoauditpro.net` via Netlify.

## ⚡ Quick Deploy (5 minutes)

### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

### 2. Login
```bash
netlify login
```

### 3. Initialize Site
```bash
cd /Users/michaelreoch/seo-audit-app
netlify init
```
- Create new site
- Use default build settings

### 4. Set Up Database (Supabase - Free)

1. Go to [supabase.com](https://supabase.com) → Create account → New project
2. Get connection string: Settings → Database → Connection string (URI)
3. Copy the PostgreSQL URL

### 5. Set Environment Variables

**In Netlify Dashboard:**
- Site settings → Environment variables → Add variable

**Required variables:**
```
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
NEXTAUTH_URL=https://seoauditpro.net
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

### 6. Run Database Migrations

**Option A: Local with production DB**
```bash
# Temporarily set DATABASE_URL to your Supabase URL
export DATABASE_URL="postgresql://..."
npm run db:generate
npm run db:migrate
```

**Option B: Supabase SQL Editor**
- Copy SQL from `prisma/migrations/` files
- Paste in Supabase SQL Editor → Run

### 7. Deploy
```bash
netlify deploy --prod
```

### 8. Add Custom Domain

1. Netlify Dashboard → Site settings → Domain management
2. Add custom domain: `seoauditpro.net`
3. Add DNS records (Netlify will show you):
   - A record: `@` → Netlify IP
   - CNAME: `www` → your-site.netlify.app
4. Wait 5-60 minutes for DNS propagation
5. SSL certificate auto-provisions

### 9. Create Admin User

```bash
# Use production database URL
DATABASE_URL="your-supabase-url" npm run create-user -- --email=admin@example.com --password=yourpassword
```

### 10. Test

Visit `https://seoauditpro.net` and log in!

---

## 🚨 Important Notes

### SQLite → PostgreSQL
- **SQLite won't work on Netlify** (serverless)
- **Use Supabase** (free PostgreSQL hosting)
- Update `DATABASE_URL` to PostgreSQL format

### Puppeteer
- May need adjustments for serverless
- Consider using a headless browser service if issues occur

### Build Script
- Added `postinstall` script to generate Prisma client
- Build command includes `prisma generate`

---

## 📝 Files Created

✅ `netlify.toml` - Netlify configuration
✅ `NETLIFY_DEPLOYMENT.md` - Full detailed guide
✅ `deploy-to-netlify.sh` - Quick deploy script
✅ `package.json` - Updated with Netlify plugin

---

## 🔄 Updating Your App

**Auto-deploy (recommended):**
1. Push to Git
2. Netlify auto-deploys

**Manual deploy:**
```bash
netlify deploy --prod
```

---

## 🆘 Troubleshooting

**Build fails?**
- Check Netlify build logs
- Ensure all dependencies in `package.json`
- Verify `DATABASE_URL` is set

**Database connection?**
- Use Supabase connection pooler URL
- Check database allows external connections

**NextAuth not working?**
- Verify `NEXTAUTH_URL` is exactly `https://seoauditpro.net`
- Check `NEXTAUTH_SECRET` is set

---

## ✅ You're Done!

Your app is live at `https://seoauditpro.net` and protected by NextAuth login! 🎉

