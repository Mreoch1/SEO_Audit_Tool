/**
 * Platform-Specific Instructions Module
 * 
 * Provides platform-specific fix instructions for common SEO issues
 * Replaces generic "consult your web server documentation" messages
 * 
 * Supported platforms:
 * - Wix
 * - WordPress
 * - Squarespace
 * - Shopify
 * - Custom (fallback to generic)
 */

export type Platform = 'wix' | 'wordpress' | 'squarespace' | 'shopify' | 'custom'

export interface PlatformInstructions {
  platform: Platform
  instructions: string
  additionalNotes?: string
}

/**
 * Get platform-specific instructions for a given issue
 */
export function getPlatformInstructions(
  platform: Platform,
  issueType: string,
  issueDetails?: Record<string, any>
): PlatformInstructions {
  switch (platform) {
    case 'wix':
      return getWixInstructions(issueType, issueDetails)
    case 'wordpress':
      return getWordPressInstructions(issueType, issueDetails)
    case 'squarespace':
      return getSquarespaceInstructions(issueType, issueDetails)
    case 'shopify':
      return getShopifyInstructions(issueType, issueDetails)
    default:
      return getGenericInstructions(issueType, issueDetails)
  }
}

/**
 * Wix-specific instructions
 */
function getWixInstructions(issueType: string, details?: Record<string, any>): PlatformInstructions {
  const instructions: string[] = []
  let additionalNotes: string | undefined

  switch (issueType) {
    case 'missing-meta-description':
    case 'meta-description-too-short':
    case 'meta-description-too-long':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to your site editor')
      instructions.push('3. Click on the page you want to edit')
      instructions.push('4. Click "Settings" (gear icon) in the top menu')
      instructions.push('5. Click "SEO" → "Edit Page SEO"')
      instructions.push('6. Fill in the "Description" field (150-160 characters recommended)')
      instructions.push('7. Click "Done" to save')
      additionalNotes = 'Tip: You can also set default meta descriptions in Settings → SEO → SEO Settings'
      break

    case 'missing-page-title':
    case 'title-too-short':
    case 'title-too-long':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to your site editor')
      instructions.push('3. Click on the page you want to edit')
      instructions.push('4. Click "Settings" (gear icon) in the top menu')
      instructions.push('5. Click "SEO" → "Edit Page SEO"')
      instructions.push('6. Fill in the "Title" field (50-60 characters recommended)')
      instructions.push('7. Click "Done" to save')
      additionalNotes = 'Tip: Include your primary keyword near the beginning of the title'
      break

    case 'missing-h1':
    case 'multiple-h1':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to your site editor')
      instructions.push('3. Click on the page you want to edit')
      instructions.push('4. Add a heading element (H1) to your page')
      instructions.push('5. Make sure there is exactly ONE H1 per page')
      instructions.push('6. The H1 should be at the top of your main content')
      instructions.push('7. Click "Publish" to save changes')
      additionalNotes = 'Tip: Your H1 should match or be similar to your page title'
      break

    case 'missing-canonical':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to Settings → SEO → SEO Settings')
      instructions.push('3. Scroll to "Canonical URL" section')
      instructions.push('4. Wix automatically sets canonical URLs, but you can verify in:')
      instructions.push('   • Settings → SEO → Advanced SEO → Custom Meta Tags')
      instructions.push('5. If needed, add: <link rel="canonical" href="[YOUR-URL]">')
      additionalNotes = 'Note: Wix usually handles canonical URLs automatically'
      break

    case 'missing-cache-control':
    case 'missing-security-headers':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to Settings → Advanced → Headers & Code')
      instructions.push('3. Add custom headers in the "Custom Headers" section')
      instructions.push('4. For Cache-Control, add:')
      instructions.push('   Header Name: Cache-Control')
      instructions.push('   Header Value: public, max-age=31536000')
      instructions.push('5. For security headers, add each header separately')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Note: Wix has limited header customization. Some headers may require Wix Premium plan'
      break

    case 'missing-schema':
    case 'incomplete-schema':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to Settings → SEO → Advanced SEO')
      instructions.push('3. Scroll to "Structured Data" section')
      instructions.push('4. Click "Add Structured Data"')
      instructions.push('5. Select your business type (LocalBusiness, Organization, etc.)')
      instructions.push('6. Fill in all required fields (name, address, phone, etc.)')
      instructions.push('7. Click "Save"')
      additionalNotes = 'Tip: Use Google\'s Structured Data Testing Tool to validate your schema'
      break

    case 'missing-open-graph':
    case 'missing-twitter-cards':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to your site editor')
      instructions.push('3. Click on the page you want to edit')
      instructions.push('4. Click "Settings" → "SEO" → "Edit Page SEO"')
      instructions.push('5. Scroll to "Social Share" section')
      instructions.push('6. Upload an image (1200x630px recommended)')
      instructions.push('7. Add a custom title and description for social sharing')
      instructions.push('8. Click "Done" to save')
      additionalNotes = 'Tip: Wix automatically generates Open Graph and Twitter Card tags from these settings'
      break

    case 'missing-viewport':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to Settings → Mobile')
      instructions.push('3. Ensure "Mobile Optimized" is enabled')
      instructions.push('4. Wix automatically adds viewport meta tags')
      instructions.push('5. If missing, check Settings → Advanced → Custom Code')
      additionalNotes = 'Note: Wix should handle viewport tags automatically. If missing, contact Wix support'
      break

    case 'mixed-content':
      instructions.push('1. Log into your Wix dashboard')
      instructions.push('2. Go to Settings → Advanced → Headers & Code')
      instructions.push('3. Check your custom code for any "http://" links')
      instructions.push('4. Update all links to use "https://"')
      instructions.push('5. Check images, CSS, and JavaScript files')
      instructions.push('6. Wix automatically uses HTTPS, but custom code may override this')
      instructions.push('7. Click "Save" after making changes')
      additionalNotes = 'Tip: Use protocol-relative URLs (//example.com) or relative URLs when possible'
      break

    default:
      return getGenericInstructions(issueType, details)
  }

  return {
    platform: 'wix',
    instructions: instructions.join('\n'),
    additionalNotes
  }
}

/**
 * WordPress-specific instructions
 */
function getWordPressInstructions(issueType: string, details?: Record<string, any>): PlatformInstructions {
  const instructions: string[] = []
  let additionalNotes: string | undefined

  switch (issueType) {
    case 'missing-meta-description':
    case 'meta-description-too-short':
    case 'meta-description-too-long':
      instructions.push('1. Install Yoast SEO plugin (free) or Rank Math plugin')
      instructions.push('2. Edit the page/post in WordPress')
      instructions.push('3. Scroll down to the "Yoast SEO" or "Rank Math" section')
      instructions.push('4. Click "Edit snippet" or "Edit Meta"')
      instructions.push('5. Fill in the "Meta description" field (150-160 characters)')
      instructions.push('6. Click "Update" to save the page')
      additionalNotes = 'Alternative: Use your theme\'s built-in SEO settings if available'
      break

    case 'missing-page-title':
    case 'title-too-short':
    case 'title-too-long':
      instructions.push('1. Install Yoast SEO plugin (free) or Rank Math plugin')
      instructions.push('2. Edit the page/post in WordPress')
      instructions.push('3. Scroll down to the "Yoast SEO" or "Rank Math" section')
      instructions.push('4. Click "Edit snippet" or "Edit Meta"')
      instructions.push('5. Fill in the "SEO title" field (50-60 characters)')
      instructions.push('6. Click "Update" to save')
      additionalNotes = 'Note: This is different from the page title shown on the page itself'
      break

    case 'missing-h1':
    case 'multiple-h1':
      instructions.push('1. Edit the page/post in WordPress')
      instructions.push('2. In the content editor, add a Heading 1 (H1) element')
      instructions.push('3. Make sure there is exactly ONE H1 per page')
      instructions.push('4. The H1 should be at the top of your main content')
      instructions.push('5. Click "Update" to save')
      additionalNotes = 'Tip: In Gutenberg, use the "Heading" block and set it to H1'
      break

    case 'missing-canonical':
      instructions.push('1. Install Yoast SEO plugin (free) or Rank Math plugin')
      instructions.push('2. Go to SEO → Search Appearance → General')
      instructions.push('3. Canonical URLs are usually set automatically')
      instructions.push('4. For individual pages: Edit page → Yoast SEO → Advanced → Canonical URL')
      instructions.push('5. Leave blank for automatic, or enter custom URL')
      instructions.push('6. Click "Update" to save')
      additionalNotes = 'Note: Most SEO plugins handle canonical URLs automatically'
      break

    case 'missing-cache-control':
      instructions.push('1. Install a caching plugin (WP Super Cache, W3 Total Cache, or WP Rocket)')
      instructions.push('2. Go to Settings → WP Super Cache (or your caching plugin)')
      instructions.push('3. Enable caching')
      instructions.push('4. The plugin will automatically set Cache-Control headers')
      instructions.push('5. For manual control, use .htaccess (if on Apache):')
      instructions.push('   Add to .htaccess:')
      instructions.push('   <FilesMatch ".(jpg|jpeg|png|gif|css|js)$">')
      instructions.push('   Header set Cache-Control "max-age=31536000, public"')
      instructions.push('   </FilesMatch>')
      additionalNotes = 'Warning: Only edit .htaccess if you know what you\'re doing. Backup first!'
      break

    case 'missing-security-headers':
      instructions.push('1. Install a security plugin (Wordfence, Sucuri, or iThemes Security)')
      instructions.push('2. Go to your security plugin settings')
      instructions.push('3. Look for "Security Headers" or "HTTP Headers" section')
      instructions.push('4. Enable recommended headers (X-Frame-Options, CSP, etc.)')
      instructions.push('5. For manual setup, add to .htaccess (Apache) or server config (Nginx)')
      instructions.push('6. Test headers using securityheaders.com')
      additionalNotes = 'Tip: Some headers can break functionality. Test thoroughly after enabling'
      break

    case 'missing-schema':
    case 'incomplete-schema':
      instructions.push('1. Install Schema Pro plugin or use Yoast SEO\'s schema features')
      instructions.push('2. Go to your plugin settings')
      instructions.push('3. Select your business type (LocalBusiness, Organization, etc.)')
      instructions.push('4. Fill in all required fields (name, address, phone, etc.)')
      instructions.push('5. For individual pages: Edit page → Schema tab → Add schema')
      instructions.push('6. Click "Update" to save')
      instructions.push('7. Validate using Google\'s Structured Data Testing Tool')
      additionalNotes = 'Alternative: Use a plugin like "Schema" or "Schema & Structured Data for WP"'
      break

    case 'missing-open-graph':
    case 'missing-twitter-cards':
      instructions.push('1. Install Yoast SEO plugin (free) or Rank Math plugin')
      instructions.push('2. Go to SEO → Social → Facebook (or Twitter)')
      instructions.push('3. Upload a default image (1200x630px)')
      instructions.push('4. For individual pages: Edit page → Yoast SEO → Social tab')
      instructions.push('5. Upload a custom image and set title/description for social sharing')
      instructions.push('6. Click "Update" to save')
      additionalNotes = 'Tip: Yoast SEO automatically generates Open Graph and Twitter Card tags'
      break

    case 'missing-viewport':
      instructions.push('1. Edit your theme\'s header.php file (Appearance → Theme Editor)')
      instructions.push('2. Find the <head> section')
      instructions.push('3. Add: <meta name="viewport" content="width=device-width, initial-scale=1">')
      instructions.push('4. Click "Update File" to save')
      instructions.push('5. OR use a plugin like "Insert Headers and Footers"')
      additionalNotes = 'Warning: Editing theme files directly can break your site. Use a child theme!'
      break

    case 'mixed-content':
      instructions.push('1. Install "SSL Insecure Content Fixer" plugin')
      instructions.push('2. Go to Settings → SSL Insecure Content')
      instructions.push('3. Enable "Fix insecure content"')
      instructions.push('4. Check "Fix all content" option')
      instructions.push('5. Click "Save Changes"')
      instructions.push('6. OR manually update all "http://" links to "https://" in your content')
      additionalNotes = 'Tip: Use "Better Search Replace" plugin to find and replace http:// with https://'
      break

    default:
      return getGenericInstructions(issueType, details)
  }

  return {
    platform: 'wordpress',
    instructions: instructions.join('\n'),
    additionalNotes
  }
}

/**
 * Squarespace-specific instructions
 */
function getSquarespaceInstructions(issueType: string, details?: Record<string, any>): PlatformInstructions {
  const instructions: string[] = []
  let additionalNotes: string | undefined

  switch (issueType) {
    case 'missing-meta-description':
    case 'meta-description-too-short':
    case 'meta-description-too-long':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Pages → Select the page you want to edit')
      instructions.push('3. Click the gear icon (⚙️) next to the page name')
      instructions.push('4. Click "SEO" tab')
      instructions.push('5. Fill in the "Description" field (150-160 characters)')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Tip: You can set default meta descriptions in Settings → SEO'
      break

    case 'missing-page-title':
    case 'title-too-short':
    case 'title-too-long':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Pages → Select the page you want to edit')
      instructions.push('3. Click the gear icon (⚙️) next to the page name')
      instructions.push('4. Click "SEO" tab')
      instructions.push('5. Fill in the "Page Title" field (50-60 characters)')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Note: This is different from the page name shown in navigation'
      break

    case 'missing-h1':
    case 'multiple-h1':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Pages → Select the page you want to edit')
      instructions.push('3. Click "Edit" to open the page editor')
      instructions.push('4. Add a heading block and set it to H1')
      instructions.push('5. Make sure there is exactly ONE H1 per page')
      instructions.push('6. Click "Save" to publish')
      additionalNotes = 'Tip: Your page title can be set as H1 in the page settings'
      break

    case 'missing-canonical':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Settings → SEO')
      instructions.push('3. Squarespace automatically sets canonical URLs')
      instructions.push('4. To verify, check Settings → Advanced → Code Injection')
      instructions.push('5. Canonical tags are added automatically - no action needed')
      additionalNotes = 'Note: Squarespace handles canonical URLs automatically'
      break

    case 'missing-cache-control':
    case 'missing-security-headers':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Settings → Advanced → Code Injection')
      instructions.push('3. Squarespace manages headers automatically')
      instructions.push('4. For custom headers, contact Squarespace support')
      instructions.push('5. Some headers may require Business plan or higher')
      additionalNotes = 'Note: Squarespace has limited header customization options'
      break

    case 'missing-schema':
    case 'incomplete-schema':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Settings → Advanced → Code Injection')
      instructions.push('3. Add your JSON-LD schema in the "Header" section')
      instructions.push('4. Use Google\'s Structured Data Markup Helper to generate schema')
      instructions.push('5. Paste the JSON-LD code into the header injection')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Tip: Validate your schema using Google\'s Structured Data Testing Tool'
      break

    case 'missing-open-graph':
    case 'missing-twitter-cards':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Pages → Select the page you want to edit')
      instructions.push('3. Click the gear icon (⚙️) → "SEO" tab')
      instructions.push('4. Upload a "Social Sharing Image" (1200x630px)')
      instructions.push('5. Add a custom "Social Sharing Title" and "Description"')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Tip: Squarespace automatically generates Open Graph and Twitter Card tags'
      break

    case 'missing-viewport':
      instructions.push('1. Squarespace automatically adds viewport meta tags')
      instructions.push('2. If missing, check Settings → Advanced → Code Injection')
      instructions.push('3. Add to Header: <meta name="viewport" content="width=device-width, initial-scale=1">')
      instructions.push('4. Click "Save"')
      additionalNotes = 'Note: This should not be necessary - Squarespace handles this automatically'
      break

    case 'mixed-content':
      instructions.push('1. Log into your Squarespace dashboard')
      instructions.push('2. Go to Settings → Advanced → Code Injection')
      instructions.push('3. Check your custom code for any "http://" links')
      instructions.push('4. Update all links to use "https://"')
      instructions.push('5. Squarespace automatically uses HTTPS for all assets')
      instructions.push('6. Custom code may override this - update manually')
      additionalNotes = 'Tip: Use protocol-relative URLs (//example.com) in custom code'
      break

    default:
      return getGenericInstructions(issueType, details)
  }

  return {
    platform: 'squarespace',
    instructions: instructions.join('\n'),
    additionalNotes
  }
}

/**
 * Shopify-specific instructions
 */
function getShopifyInstructions(issueType: string, details?: Record<string, any>): PlatformInstructions {
  const instructions: string[] = []
  let additionalNotes: string | undefined

  switch (issueType) {
    case 'missing-meta-description':
    case 'meta-description-too-short':
    case 'meta-description-too-long':
      instructions.push('1. Log into your Shopify admin')
      instructions.push('2. Go to Online Store → Themes → Customize')
      instructions.push('3. Select the page you want to edit')
      instructions.push('4. In the page settings, find "Search engine listing"')
      instructions.push('5. Fill in the "Description" field (150-160 characters)')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Tip: You can also edit this in Products/Pages → Select item → Search engine listing'
      break

    case 'missing-page-title':
    case 'title-too-short':
    case 'title-too-long':
      instructions.push('1. Log into your Shopify admin')
      instructions.push('2. Go to Online Store → Themes → Customize')
      instructions.push('3. Select the page you want to edit')
      instructions.push('4. In the page settings, find "Search engine listing"')
      instructions.push('5. Fill in the "Page title" field (50-60 characters)')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Note: This is different from the page title shown on the page'
      break

    case 'missing-h1':
    case 'multiple-h1':
      instructions.push('1. Log into your Shopify admin')
      instructions.push('2. Go to Online Store → Themes → Customize')
      instructions.push('3. Select the page you want to edit')
      instructions.push('4. Add a heading element and set it to H1')
      instructions.push('5. Make sure there is exactly ONE H1 per page')
      instructions.push('6. Click "Save"')
      additionalNotes = 'Tip: Product pages usually have H1 automatically from product title'
      break

    case 'missing-canonical':
      instructions.push('1. Shopify automatically sets canonical URLs')
      instructions.push('2. To verify, go to Online Store → Preferences → Search engine optimization')
      instructions.push('3. Canonical tags are handled automatically - no action needed')
      instructions.push('4. For custom canonical URLs, edit theme files (advanced)')
      additionalNotes = 'Note: Shopify handles canonical URLs automatically for products and pages'
      break

    case 'missing-cache-control':
      instructions.push('1. Shopify automatically sets Cache-Control headers')
      instructions.push('2. For custom cache settings, go to Online Store → Themes → Actions → Edit code')
      instructions.push('3. Edit your theme\'s .liquid files (advanced)')
      instructions.push('4. Shopify CDN handles caching automatically')
      additionalNotes = 'Note: Shopify manages caching at the CDN level - manual changes usually not needed'
      break

    case 'missing-security-headers':
      instructions.push('1. Shopify automatically sets security headers')
      instructions.push('2. For custom headers, contact Shopify support')
      instructions.push('3. Some headers may require Shopify Plus plan')
      instructions.push('4. Check your site\'s security using securityheaders.com')
      additionalNotes = 'Note: Shopify handles most security headers automatically'
      break

    case 'missing-schema':
    case 'incomplete-schema':
      instructions.push('1. Go to Online Store → Themes → Actions → Edit code')
      instructions.push('2. Edit your theme\'s product/page templates')
      instructions.push('3. Add JSON-LD schema markup')
      instructions.push('4. OR use a Shopify app like "Schema Plus" or "JSON-LD for SEO"')
      instructions.push('5. Validate using Google\'s Structured Data Testing Tool')
      additionalNotes = 'Tip: Shopify automatically adds Product schema for product pages'
      break

    case 'missing-open-graph':
    case 'missing-twitter-cards':
      instructions.push('1. Go to Online Store → Themes → Customize')
      instructions.push('2. Select a page/product')
      instructions.push('3. In settings, find "Social sharing image"')
      instructions.push('4. Upload an image (1200x630px)')
      instructions.push('5. Shopify automatically generates Open Graph tags')
      instructions.push('6. For custom tags, edit theme files (advanced)')
      additionalNotes = 'Tip: Set default social sharing image in Settings → General → Store details'
      break

    case 'missing-viewport':
      instructions.push('1. Shopify automatically adds viewport meta tags')
      instructions.push('2. If missing, edit theme files: Online Store → Themes → Actions → Edit code')
      instructions.push('3. Edit theme.liquid file')
      instructions.push('4. Add to <head>: <meta name="viewport" content="width=device-width, initial-scale=1">')
      instructions.push('5. Click "Save"')
      additionalNotes = 'Note: This should not be necessary - Shopify handles this automatically'
      break

    case 'mixed-content':
      instructions.push('1. Shopify automatically uses HTTPS for all assets')
      instructions.push('2. Check your theme code for any hardcoded "http://" links')
      instructions.push('3. Go to Online Store → Themes → Actions → Edit code')
      instructions.push('4. Search for "http://" in your theme files')
      instructions.push('5. Replace with "https://" or use protocol-relative URLs (//example.com)')
      instructions.push('6. Click "Save" after changes')
      additionalNotes = 'Tip: Use Shopify\'s built-in asset URLs instead of hardcoded links'
      break

    default:
      return getGenericInstructions(issueType, details)
  }

  return {
    platform: 'shopify',
    instructions: instructions.join('\n'),
    additionalNotes
  }
}

/**
 * Generic instructions (fallback for custom platforms)
 */
function getGenericInstructions(issueType: string, details?: Record<string, any>): PlatformInstructions {
  const instructions: string[] = []
  
  // Provide generic but helpful instructions
  switch (issueType) {
    case 'missing-meta-description':
    case 'meta-description-too-short':
    case 'meta-description-too-long':
      instructions.push('1. Locate your page\'s HTML <head> section')
      instructions.push('2. Add or update: <meta name="description" content="Your description here (150-160 characters)">')
      instructions.push('3. If using a CMS, check your SEO settings or page editor')
      instructions.push('4. Save and publish your changes')
      break

    case 'missing-page-title':
    case 'title-too-short':
    case 'title-too-long':
      instructions.push('1. Locate your page\'s HTML <head> section')
      instructions.push('2. Update the <title> tag: <title>Your Page Title (50-60 characters)</title>')
      instructions.push('3. If using a CMS, check your SEO settings or page editor')
      instructions.push('4. Save and publish your changes')
      break

    case 'missing-h1':
    case 'multiple-h1':
      instructions.push('1. Edit your page content')
      instructions.push('2. Add exactly ONE <h1> heading at the top of your main content')
      instructions.push('3. Example: <h1>Your Main Heading</h1>')
      instructions.push('4. Remove any duplicate H1 tags')
      instructions.push('5. Save and publish your changes')
      break

    case 'missing-canonical':
      instructions.push('1. Locate your page\'s HTML <head> section')
      instructions.push('2. Add: <link rel="canonical" href="https://yourdomain.com/page-url">')
      instructions.push('3. Use the preferred URL (usually the HTTPS version)')
      instructions.push('4. Save and publish your changes')
      break

    case 'missing-cache-control':
      instructions.push('1. Access your web server configuration (Apache .htaccess or Nginx config)')
      instructions.push('2. For Apache, add to .htaccess:')
      instructions.push('   <FilesMatch ".(jpg|jpeg|png|gif|css|js)$">')
      instructions.push('   Header set Cache-Control "max-age=31536000, public"')
      instructions.push('   </FilesMatch>')
      instructions.push('3. For Nginx, add to server block:')
      instructions.push('   location ~* \\.(jpg|jpeg|png|gif|css|js)$ {')
      instructions.push('     expires 1y;')
      instructions.push('     add_header Cache-Control "public, immutable";')
      instructions.push('   }')
      instructions.push('4. Restart your web server')
      break

    case 'missing-security-headers':
      instructions.push('1. Access your web server configuration')
      instructions.push('2. Add security headers (X-Frame-Options, CSP, etc.)')
      instructions.push('3. For Apache, add to .htaccess:')
      instructions.push('   Header always set X-Frame-Options "SAMEORIGIN"')
      instructions.push('   Header always set Content-Security-Policy "default-src \'self\'"')
      instructions.push('4. For Nginx, add to server block:')
      instructions.push('   add_header X-Frame-Options "SAMEORIGIN" always;')
      instructions.push('5. Test using securityheaders.com')
      break

    case 'missing-schema':
    case 'incomplete-schema':
      instructions.push('1. Use Google\'s Structured Data Markup Helper to generate schema')
      instructions.push('2. Add the JSON-LD code to your page\'s <head> section')
      instructions.push('3. Example: <script type="application/ld+json">{...}</script>')
      instructions.push('4. Validate using Google\'s Structured Data Testing Tool')
      instructions.push('5. Save and publish your changes')
      break

    case 'missing-open-graph':
    case 'missing-twitter-cards':
      instructions.push('1. Locate your page\'s HTML <head> section')
      instructions.push('2. Add Open Graph tags:')
      instructions.push('   <meta property="og:title" content="Your Title">')
      instructions.push('   <meta property="og:description" content="Your Description">')
      instructions.push('   <meta property="og:image" content="https://yourdomain.com/image.jpg">')
      instructions.push('3. Add Twitter Card tags:')
      instructions.push('   <meta name="twitter:card" content="summary_large_image">')
      instructions.push('4. Save and publish your changes')
      break

    case 'missing-viewport':
      instructions.push('1. Locate your page\'s HTML <head> section')
      instructions.push('2. Add: <meta name="viewport" content="width=device-width, initial-scale=1">')
      instructions.push('3. Save and publish your changes')
      break

    case 'mixed-content':
      instructions.push('1. Search your HTML/CSS/JS files for "http://" links')
      instructions.push('2. Update all absolute URLs to use "https://"')
      instructions.push('3. Use protocol-relative URLs (//example.com) or relative URLs where possible')
      instructions.push('4. Check browser console for mixed content warnings')
      instructions.push('5. Save and publish your changes')
      break

    default:
      instructions.push('1. Review the issue details in your audit report')
      instructions.push('2. Consult your CMS or web server documentation')
      instructions.push('3. If using a platform (Wix, WordPress, etc.), check their SEO guides')
      instructions.push('4. Consider hiring a developer for complex technical issues')
  }

  return {
    platform: 'custom',
    instructions: instructions.join('\n'),
    additionalNotes: 'For platform-specific instructions, we recommend identifying your CMS/platform and checking their documentation'
  }
}

