# Email Deliverability Tips

Your emails are going to spam? Here are the key factors that affect email deliverability:

## 1. SMTP Server Configuration

**Use a reputable email service:**
- ✅ **Recommended:** SendGrid, Mailgun, AWS SES, Postmark, Resend
- ❌ **Avoid:** Free SMTP servers (Gmail, Outlook personal accounts) - they have strict limits and poor deliverability

**Why?** Free email providers (Gmail, Outlook) are designed for personal use and have:
- Strict sending limits (500 emails/day for Gmail)
- Poor reputation for bulk/automated emails
- Higher spam scores

## 2. Email Authentication (SPF, DKIM, DMARC)

These are **critical** for deliverability. Your email provider should set these up:

**SPF (Sender Policy Framework):**
- Verifies your server is authorized to send from your domain
- Set up in your DNS: `TXT` record with SPF policy

**DKIM (DomainKeys Identified Mail):**
- Cryptographically signs your emails
- Set up in your DNS: `TXT` record with DKIM key

**DMARC (Domain-based Message Authentication):**
- Policy for handling failed authentication
- Set up in your DNS: `TXT` record with DMARC policy

**Check your setup:**
- Use [MXToolbox](https://mxtoolbox.com/) to verify SPF/DKIM/DMARC
- Your email provider should provide DNS records to add

## 3. From Address

**Best practices:**
- ✅ Use a domain you own: `noreply@seoauditpro.net`
- ✅ Use a real, monitored address: `contact@seoauditpro.net`
- ❌ Avoid: `noreply@gmail.com` or generic addresses

**Why?** Using your own domain:
- Builds sender reputation
- Looks more professional
- Better deliverability

## 4. Email Content

**Avoid spam triggers:**
- ❌ ALL CAPS in subject
- ❌ Excessive exclamation marks!!!
- ❌ Spam words: "FREE", "CLICK NOW", "LIMITED TIME"
- ❌ Too many links
- ❌ Image-only emails (no text)

**Good practices:**
- ✅ Clear, descriptive subject lines
- ✅ Balanced text-to-image ratio
- ✅ Proper HTML structure
- ✅ Plain text version included

## 5. Sender Reputation

**Build reputation over time:**
- Start with low volume
- Gradually increase sending
- Monitor bounce rates
- Remove invalid emails immediately

## 6. List Hygiene

**Keep your list clean:**
- Remove bounced emails
- Honor unsubscribe requests immediately
- Don't send to invalid addresses

## 7. Email Headers (Already Added)

The code now includes:
- ✅ Message-ID (unique per email)
- ✅ List-Unsubscribe header
- ✅ Proper Content-Type headers
- ✅ Reply-To address
- ✅ Auto-Submitted header

## Quick Fixes for Your Setup

### Option 1: Use a Professional Email Service (Recommended)

**SendGrid (Free tier: 100 emails/day):**
1. Sign up at sendgrid.com
2. Verify your domain
3. Get API key
4. Update SMTP settings:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - User: `apikey`
   - Password: `[your API key]`
   - From: `noreply@seoauditpro.net`

**Resend (Free tier: 3,000 emails/month):**
1. Sign up at resend.com
2. Verify domain
3. Use their API or SMTP

**Mailgun (Free tier: 5,000 emails/month):**
1. Sign up at mailgun.com
2. Verify domain
3. Use SMTP settings provided

### Option 2: Use Your Own Domain Email

If you have `seoauditpro.net`:
1. Set up email hosting (Google Workspace, Microsoft 365, etc.)
2. Create `noreply@seoauditpro.net` or `contact@seoauditpro.net`
3. Configure SPF/DKIM/DMARC in DNS
4. Use those SMTP credentials

### Option 3: Improve Current Setup

If using Gmail/Outlook:
1. **Enable "Less secure app access"** (if using Gmail)
2. **Use App Password** instead of regular password
3. **Set proper From address** in settings
4. **Start with low volume** to build reputation

## Testing Deliverability

**Tools to check:**
- [Mail-Tester.com](https://www.mail-tester.com/) - Send test email, get spam score
- [MXToolbox](https://mxtoolbox.com/) - Check SPF/DKIM/DMARC
- [GlockApps](https://glockapps.com/) - Test inbox placement

**What to aim for:**
- Spam score: **Under 5/10** (lower is better)
- Inbox placement: **80%+ in primary inbox**

## Current Improvements Made

✅ Added proper email headers (Message-ID, List-Unsubscribe, etc.)
✅ Improved plain text version
✅ Better subject line formatting
✅ Added unsubscribe link
✅ Proper HTML structure
✅ Escaped URLs for safety

## Next Steps

1. **Switch to a professional email service** (SendGrid, Resend, Mailgun)
2. **Set up SPF/DKIM/DMARC** for your domain
3. **Use a proper From address** (your domain, not Gmail)
4. **Test with Mail-Tester.com** to check spam score
5. **Monitor bounce rates** and remove invalid emails

The code improvements will help, but **the biggest factor is using a reputable email service with proper authentication**.

