import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { sessionManager } from '../../src/main/modules/auth/session.manager';
import { dispatchFastify } from '../../src/main/fastify/server';
import {
  getRelativeLuminance,
  getContrastRatio,
  getAccessibleForegroundColor,
} from '../../src/renderer/src/theme/ThemeEngine';

describe('RS Inventory Solo — Branding & Runtime Theming Integration Suite', () => {
  const prisma = getPrismaClient();
  let adminToken: string;
  let cashierToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();

    // Ensure Admin User exists
    let admin = await prisma.user.findFirst({ where: { username: 'admin_theme_test' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          username: 'admin_theme_test',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash',
          fullName: 'Theme Test Administrator',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }
    adminUserId = admin.id;

    // Ensure Cashier User exists
    let cashier = await prisma.user.findFirst({ where: { username: 'cashier_theme_test' } });
    if (!cashier) {
      cashier = await prisma.user.create({
        data: {
          username: 'cashier_theme_test',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash',
          fullName: 'Theme Test Cashier',
          role: 'CASHIER',
          status: 'ACTIVE',
        },
      });
    }

    // Sessions
    const adminSession = sessionManager.createSession({
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: admin.createdAt.toISOString(),
    });
    adminToken = adminSession.token;

    const cashierSession = sessionManager.createSession({
      id: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: 'CASHIER',
      status: 'ACTIVE',
      createdAt: cashier.createdAt.toISOString(),
    });
    cashierToken = cashierSession.token;
  });

  afterAll(async () => {
    await settingsService.updateAppSettings({
      branding: {
        theme: 'DARK',
        accentColor: '#F97316',
        textColor: '#F8FAFC',
        appName: 'RS Inventory',
        footerText: 'RS Inventory Solo • Authoritative Offline-First POS & Inventory System',
      },
    }, adminUserId);
  });

  describe('1. WCAG Contrast & Accessible Foreground Computation', () => {
    it('calculates correct relative luminance for black, white, and standard colors', () => {
      expect(getRelativeLuminance('#000000')).toBeCloseTo(0, 4);
      expect(getRelativeLuminance('#FFFFFF')).toBeCloseTo(1, 4);
      // Relative luminance of pure green #00FF00 is ~0.7152
      expect(getRelativeLuminance('#00FF00')).toBeGreaterThan(0.7);
    });

    it('determines contrast ratio between colors adhering to WCAG formula', () => {
      const blackOnWhite = getContrastRatio('#000000', '#FFFFFF');
      expect(blackOnWhite).toBeCloseTo(21, 1);

      const sameColor = getContrastRatio('#F97316', '#F97316');
      expect(sameColor).toBeCloseTo(1, 1);
    });

    it('assigns white text (#FFFFFF) to dark accent colors', () => {
      // Dark Blue (#1E3A8A)
      expect(getAccessibleForegroundColor('#1E3A8A')).toBe('#FFFFFF');
      // Deep Purple (#4C1D95)
      expect(getAccessibleForegroundColor('#4C1D95')).toBe('#FFFFFF');
      // Deep Emerald (#065F46)
      expect(getAccessibleForegroundColor('#065F46')).toBe('#FFFFFF');
      // Deep Indigo (#3730A3)
      expect(getAccessibleForegroundColor('#3730A3')).toBe('#FFFFFF');
    });

    it('assigns dark text (#0F172A) to bright/light accent colors to guarantee readability', () => {
      // Bright Yellow (#FACC15)
      expect(getAccessibleForegroundColor('#FACC15')).toBe('#0F172A');
      // Bright Cyan (#22D3EE)
      expect(getAccessibleForegroundColor('#22D3EE')).toBe('#0F172A');
      // Light Green (#86EFAC)
      expect(getAccessibleForegroundColor('#86EFAC')).toBe('#0F172A');
      // Pure White (#FFFFFF)
      expect(getAccessibleForegroundColor('#FFFFFF')).toBe('#0F172A');
      // Vibrant Amber / Orange (#F97316) gives 6.03:1 contrast against dark text vs 2.95:1 on white
      expect(getAccessibleForegroundColor('#F97316')).toBe('#0F172A');
    });
  });

  describe('2. Effective Theme & Branding Asset Selection Logic', () => {
    const resolveEffectiveTheme = (mode: 'LIGHT' | 'DARK' | 'SYSTEM', systemTheme: 'light' | 'dark') => {
      return mode === 'SYSTEM' ? systemTheme : mode === 'LIGHT' ? 'light' : 'dark';
    };

    it('resolves LIGHT mode to light theme regardless of system preference', () => {
      expect(resolveEffectiveTheme('LIGHT', 'dark')).toBe('light');
    });

    it('resolves DARK mode to dark theme regardless of system preference', () => {
      expect(resolveEffectiveTheme('DARK', 'light')).toBe('dark');
    });

    it('resolves SYSTEM mode dynamically to system preference', () => {
      expect(resolveEffectiveTheme('SYSTEM', 'light')).toBe('light');
      expect(resolveEffectiveTheme('SYSTEM', 'dark')).toBe('dark');
    });

    it('selects the appropriate logo based on the effective theme', () => {
      const branding = {
        logoUrl: 'assets/logo-light.svg',
        logoDarkUrl: 'assets/logo-dark.svg',
      };

      const selectLogo = (effectiveTheme: 'light' | 'dark') => {
        if (effectiveTheme === 'dark' && branding.logoDarkUrl) return branding.logoDarkUrl;
        return branding.logoUrl;
      };

      expect(selectLogo('light')).toBe('assets/logo-light.svg');
      expect(selectLogo('dark')).toBe('assets/logo-dark.svg');
    });
  });

  describe('3. Database Settings Persistence (Theme, Accent, Text, Branding)', () => {
    it('persists and retrieves Dark theme mode with custom accent and text color', async () => {
      const updatePayload = {
        branding: {
          theme: 'DARK' as const,
          accentColor: '#3B82F6',
          textColor: '#F1F5F9',
          appName: 'RS Pro Retailer',
          footerText: 'Powered by RS Solo Engine',
          logoUrl: '/custom/logo-light.png',
          logoDarkUrl: '/custom/logo-dark.png',
        },
      };

      const saved = await settingsService.updateAppSettings(updatePayload, adminUserId);
      expect(saved.branding.theme).toBe('DARK');
      expect(saved.branding.accentColor).toBe('#3B82F6');
      expect(saved.branding.textColor).toBe('#F1F5F9');
      expect(saved.branding.appName).toBe('RS Pro Retailer');
      expect(saved.branding.footerText).toBe('Powered by RS Solo Engine');

      // Verify direct retrieval from DB survives
      const retrieved = await settingsService.getAppSettings();
      expect(retrieved.branding.theme).toBe('DARK');
      expect(retrieved.branding.accentColor).toBe('#3B82F6');
      expect(retrieved.branding.textColor).toBe('#F1F5F9');
      expect(retrieved.branding.appName).toBe('RS Pro Retailer');
    });

    it('persists and retrieves Light theme mode with custom Emerald accent', async () => {
      const updatePayload = {
        branding: {
          theme: 'LIGHT' as const,
          accentColor: '#10B981',
          textColor: '#0F172A',
          appName: 'Supermarket Solo',
          footerText: 'Licensed to Store #1',
        },
      };

      const saved = await settingsService.updateAppSettings(updatePayload, adminUserId);
      expect(saved.branding.theme).toBe('LIGHT');
      expect(saved.branding.accentColor).toBe('#10B981');
      expect(saved.branding.textColor).toBe('#0F172A');
      expect(saved.branding.appName).toBe('Supermarket Solo');
    });

    it('persists SYSTEM mode and preserves custom branding assets', async () => {
      const updatePayload = {
        branding: {
          theme: 'SYSTEM' as const,
          accentColor: '#8B5CF6',
          textColor: '#E2E8F0',
          appName: 'Apex Retail OS',
          footerText: 'Offline First Terminal',
          collapsedLogoUrl: '/custom/icon-light.png',
          collapsedLogoDarkUrl: '/custom/icon-dark.png',
        },
      };

      const saved = await settingsService.updateAppSettings(updatePayload, adminUserId);
      expect(saved.branding.theme).toBe('SYSTEM');
      expect(saved.branding.accentColor).toBe('#8B5CF6');
      expect(saved.branding.collapsedLogoUrl).toBe('/custom/icon-light.png');
      expect(saved.branding.collapsedLogoDarkUrl).toBe('/custom/icon-dark.png');
    });
  });

  describe('4. Security & RBAC Enforcement via Fastify IPC Bridge', () => {
    it('allows ADMIN to update branding settings via dispatchFastify', async () => {
      const res = await dispatchFastify(
        'PUT',
        '/api/settings',
        {
          settings: {
            branding: {
              theme: 'DARK',
              accentColor: '#EC4899',
              textColor: '#FFFFFF',
              appName: 'Secure POS',
            },
          },
        },
        { authorization: adminToken }
      );

      expect(res.success).toBe(true);
      expect(res.settings.branding.accentColor).toBe('#EC4899');
    });

    it('rejects unauthenticated requests to modify branding settings', async () => {
      const res = await dispatchFastify(
        'PUT',
        '/api/settings',
        {
          settings: {
            branding: {
              accentColor: '#EF4444',
            },
          },
        },
        {} // No token
      );

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('rejects CASHIER role from modifying branding settings (RBAC permission check)', async () => {
      const res = await dispatchFastify(
        'PUT',
        '/api/settings',
        {
          settings: {
            branding: {
              accentColor: '#EF4444',
            },
          },
        },
        { authorization: cashierToken }
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Unauthorized');
    });
  });
});
