-- SEO Audit App - AppleScript Launcher
-- Alternative launcher if .command file doesn't work
-- Save this as an Application in Script Editor

tell application "Terminal"
	activate
	do script "cd '/Users/michaelreoch/seo-audit-app' && './Launch SEO Audit App.command'"
end tell

