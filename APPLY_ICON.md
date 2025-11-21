# Apply SEO Branding to Launcher Icon

## Quick Method (2 minutes)

### Step 1: Generate the Icon

**Option A: Use the HTML Generator (Easiest)**
1. Double-click `generate-icon.html` (opens in browser)
2. Click "Download Icon (PNG)"
3. Save as `seo-audit-icon.png` in your project folder

**Option B: Use Online Tool**
1. Go to [IconKitchen](https://icon.kitchen/)
2. Create icon with:
   - Text: "SEO" or "SA"  
   - Background: Blue (#3b82f6)
   - Size: 512x512
3. Download as PNG
4. Save in project folder

**Option C: Use Your Logo**
- If you have a logo, resize to 512x512 PNG
- Save in project folder

### Step 2: Apply the Icon

1. **Right-click** `Launch SEO Audit App.command`
2. **Select "Get Info"** (or press `Cmd+I`)
3. **Click the small icon** in the top-left corner of the Get Info window (it will highlight)
4. **Drag your `seo-audit-icon.png`** file onto the highlighted icon
5. **Done!** The icon is now applied

### Step 3: Add to Dock (Optional)

1. Drag `Launch SEO Audit App.command` to your Dock
2. Right-click → Options → Keep in Dock
3. Your branded launcher is now in the Dock!

## Icon Specifications

- **Format**: PNG
- **Size**: 512x512 pixels (recommended)
- **Background**: Transparent or solid color
- **Design**: "SEO AUDIT" text on blue background (#3b82f6)

## Troubleshooting

**Icon won't apply?**
- Make sure the icon file is PNG format
- Try a smaller size (256x256)
- Restart Finder: `killall Finder` in Terminal

**Want a different design?**
- Edit `generate-icon.html` to change colors/text
- Or use any image editor to create your own

## Quick Commands

```bash
# Open icon generator
open generate-icon.html

# After downloading, apply icon manually via Get Info
# Or use this to open Get Info:
open -R "Launch SEO Audit App.command"
```

---

**That's it!** Your launcher now has SEO branding! 🎨

