#!/bin/bash

# Quick deployment script for Netlify
# This will deploy your app to seoauditpro.net

echo "🚀 Deploying SEO Audit App to Netlify..."
echo ""

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
    echo ""
fi

# Navigate to project directory
cd "$(dirname "$0")"

echo "📁 Project directory: $(pwd)"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "   You'll need to set environment variables in Netlify dashboard"
    echo ""
fi

# Check if netlify.toml exists
if [ ! -f "netlify.toml" ]; then
    echo "❌ Error: netlify.toml not found!"
    echo "   Please create netlify.toml first"
    exit 1
fi

echo "🔐 Checking Netlify login status..."
if ! netlify status &> /dev/null; then
    echo "   Not logged in. Opening browser..."
    netlify login
else
    echo "   ✅ Already logged in"
fi
echo ""

echo "📤 Deploying to Netlify..."
echo "   This will deploy to production"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

netlify deploy --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Add custom domain in Netlify dashboard:"
echo "      Site settings → Domain management → Add custom domain"
echo "   2. Set environment variables:"
echo "      Site settings → Environment variables"
echo "      Required: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, SMTP_*"
echo "   3. Update NEXTAUTH_URL to: https://seoauditpro.net"
echo "   4. Run database migrations with production database"
echo "   5. Create admin user"
echo ""
echo "📖 See NETLIFY_DEPLOYMENT.md for detailed instructions"
echo ""

