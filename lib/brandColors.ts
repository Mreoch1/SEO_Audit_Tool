/**
 * SEO Audit Pro - Brand Colors & Constants
 * 
 * Centralized brand colors matching the official brand guide
 * Use these constants across all email templates and PDF reports
 */

export const BrandColors = {
  // Primary Colors (Blue)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb', // Main brand color - Primary buttons, links, CTAs
    700: '#1d4ed8', // Button hover states
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554', // Hero section background
  },
  
  // Accent Colors (Yellow/Amber)
  accent: {
    50: '#fefce8',
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15', // Hero text highlights, icons
    500: '#eab308', // Primary CTA buttons (hero)
    600: '#ca8a04', // Button hover states
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
  },
  
  // Warning/Alert Colors (Amber)
  amber: {
    100: '#fef3c7', // Warning background
    400: '#fbbf24', // Warning borders
    600: '#d97706', // Warning text/icons
    900: '#78350f', // Warning text (dark)
  },
  
  // Neutral Colors (Gray Scale)
  gray: {
    50: '#f9fafb', // Light backgrounds (forms)
    100: '#f3f4f6', // Subtle backgrounds
    200: '#e5e7eb', // Borders, dividers
    300: '#d1d5db', // Input borders
    400: '#9ca3af', // Disabled text
    500: '#6b7280', // Secondary text
    600: '#4b5563', // Body text (secondary)
    700: '#374151', // Labels, form text
    900: '#111827', // Main headings, body text
  },
  
  // Status Colors
  status: {
    success: '#10b981', // Success messages, checkmarks
    error: '#ef4444', // Error messages, required field indicators
    info: '#3b82f6', // Information messages
  },
  
  // White
  white: '#ffffff',
}

/**
 * Most commonly used colors (quick reference)
 */
export const Colors = {
  // Primary brand color (most used)
  primary: BrandColors.primary[600], // #2563eb
  primaryHover: BrandColors.primary[700], // #1d4ed8
  primaryDark: BrandColors.primary[950], // #172554
  
  // Accent colors
  accent: BrandColors.accent[400], // #facc15
  accentCTA: BrandColors.accent[500], // #eab308
  
  // Text colors
  textPrimary: BrandColors.gray[900], // #111827
  textSecondary: BrandColors.gray[700], // #374151
  textBody: BrandColors.gray[500], // #6b7280
  
  // Backgrounds
  bgLight: BrandColors.gray[50], // #f9fafb
  bgSubtle: BrandColors.gray[100], // #f3f4f6
  
  // Borders
  border: BrandColors.gray[200], // #e5e7eb
  
  // Status
  success: BrandColors.status.success,
  error: BrandColors.status.error,
  info: BrandColors.status.info,
  
  // White
  white: BrandColors.white,
}

/**
 * Font stack matching brand guide
 */
export const FontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

