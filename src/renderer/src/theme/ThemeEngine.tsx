import React, { useEffect, createContext, useContext, useState, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';

/**
 * Calculates WCAG relative luminance (ITU-R BT.709)
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getRelativeLuminance(hex: string): number {
  const clean = hex.replace(/^#/, '');
  const fullHex = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(fullHex, 16);
  if (isNaN(num)) return 0.5;

  const r8 = (num >> 16) & 255;
  const g8 = (num >> 8) & 255;
  const b8 = num & 255;

  const toLinear = (c8: number) => {
    const s = c8 / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * toLinear(r8) + 0.7152 * toLinear(g8) + 0.0722 * toLinear(b8);
}

/**
 * Calculates WCAG contrast ratio between two relative luminances or hex color strings.
 */
export function getContrastRatio(lum1: number | string, lum2: number | string): number {
  const l1 = typeof lum1 === 'string' ? getRelativeLuminance(lum1) : lum1;
  const l2 = typeof lum2 === 'string' ? getRelativeLuminance(lum2) : lum2;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Automatically computes high-contrast readable text color (#ffffff or #0f172a)
 * for any given background hex code.
 */
export function getAccessibleForegroundColor(bgHex: string): string {
  const bgLum = getRelativeLuminance(bgHex);
  const whiteLum = 1.0;
  const darkLum = getRelativeLuminance('#0F172A');

  const contrastWhite = getContrastRatio(bgLum, whiteLum);
  const contrastDark = getContrastRatio(bgLum, darkLum);

  return contrastWhite >= contrastDark ? '#FFFFFF' : '#0F172A';
}

/**
 * Computes a slightly darker or lighter shade for hover and active states.
 */
export function adjustBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace(/^#/, '');
  let num = parseInt(cleanHex.length === 3 ? cleanHex.split('').map((c) => c + c).join('') : cleanHex, 16);
  if (isNaN(num)) return hex;

  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Converts hex to rgba.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace(/^#/, '');
  let num = parseInt(cleanHex.length === 3 ? cleanHex.split('').map((c) => c + c).join('') : cleanHex, 16);
  if (isNaN(num)) return `rgba(249, 115, 22, ${alpha})`;

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ThemeContextValue {
  effectiveTheme: 'light' | 'dark';
  themeSetting: 'light' | 'dark' | 'system' | 'LIGHT' | 'DARK' | 'SYSTEM';
  accentColor: string;
  accentForeground: string;
  textColor?: string;
  appName: string;
  footerText: string;
  logoUrl?: string;
}

const ThemeContext = createContext<ThemeContextValue>({
  effectiveTheme: 'dark',
  themeSetting: 'dark',
  accentColor: '#F97316',
  accentForeground: '#FFFFFF',
  appName: 'RS Inventory',
  footerText: 'RS Inventory – Solo Station',
});

export const useTheme = () => useContext(ThemeContext);

/**
 * Centralized Production ThemeProvider & Runtime Synchronization Engine
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useAuthStore((state) => state.settings);
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // 1. Listen for live OS system theme preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const themeSetting = settings?.branding?.theme || 'dark';

  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    if (themeSetting === 'light') return 'light';
    if (themeSetting === 'dark') return 'dark';
    return systemIsDark ? 'dark' : 'light';
  }, [themeSetting, systemIsDark]);

  const accentColor = settings?.branding?.accentColor || '#F97316';
  const customTextColor = settings?.branding?.accentTextColor; // can be configured
  const appName = settings?.branding?.appName || settings?.company?.shopName || 'RS Inventory';
  const footerText = settings?.branding?.footerText || 'RS Inventory – Solo Station';

  const accentForeground = useMemo(() => {
    return getAccessibleForegroundColor(accentColor);
  }, [accentColor]);

  // 2. Synchronize DOM classes, data-theme, and CSS custom properties on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // A. Apply theme class and data-theme attribute
    root.setAttribute('data-theme', effectiveTheme);
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // B. Calculate and inject Primary/Accent variables
    const hoverColor = adjustBrightness(accentColor, -12);
    const activeColor = adjustBrightness(accentColor, -18);
    const mutedColor = hexToRgba(accentColor, 0.15);
    const ringColor = hexToRgba(accentColor, 0.35);

    root.style.setProperty('--color-primary', accentColor);
    root.style.setProperty('--color-primary-hover', hoverColor);
    root.style.setProperty('--color-primary-active', activeColor);
    root.style.setProperty('--color-primary-foreground', accentForeground);
    root.style.setProperty('--color-primary-muted', mutedColor);
    root.style.setProperty('--color-primary-ring', ringColor);

    // Compatibility variables
    root.style.setProperty('--color-accent', accentColor);
    root.style.setProperty('--color-accent-hover', hoverColor);
    root.style.setProperty('--color-accent-text', accentForeground);
    root.style.setProperty('--color-accent-muted', mutedColor);
    root.style.setProperty('--color-accent-shadow', ringColor);

    // C. Configured Text Color (if explicitly provided)
    if (customTextColor && customTextColor.trim()) {
      root.style.setProperty('--color-text', customTextColor.trim());
      // Derive muted hierarchy from custom text color
      root.style.setProperty('--color-text-secondary', hexToRgba(customTextColor.trim(), 0.85));
      root.style.setProperty('--color-text-muted', hexToRgba(customTextColor.trim(), 0.65));
      root.style.setProperty('--color-text-subtle', hexToRgba(customTextColor.trim(), 0.45));
    } else {
      root.style.removeProperty('--color-text');
      root.style.removeProperty('--color-text-secondary');
      root.style.removeProperty('--color-text-muted');
      root.style.removeProperty('--color-text-subtle');
    }
  }, [effectiveTheme, accentColor, accentForeground, customTextColor]);

  const logoUrl = useMemo(() => {
    if (effectiveTheme === 'dark') {
      return settings?.branding?.darkLogoUrl || settings?.branding?.lightLogoUrl;
    }
    return settings?.branding?.lightLogoUrl || settings?.branding?.darkLogoUrl;
  }, [effectiveTheme, settings?.branding]);

  const value = {
    effectiveTheme,
    themeSetting,
    accentColor,
    accentForeground,
    textColor: customTextColor,
    appName,
    footerText,
    logoUrl,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Legacy ThemeEngine export for backwards-compatibility
 */
export function ThemeEngine() {
  return null;
}
