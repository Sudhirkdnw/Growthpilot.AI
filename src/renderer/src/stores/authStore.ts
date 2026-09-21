import { create } from 'zustand';
import { UserDTO, AppSettingsDTO } from '../../../shared/types';

export interface ActiveSession {
  token: string;
  user: UserDTO;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  isLocked: boolean;
}

interface AuthState {
  isFirstRun: boolean | null;
  session: ActiveSession | null;
  isLocked: boolean;
  isLoading: boolean;
  settings: AppSettingsDTO | null;

  checkStatus: () => Promise<void>;
  updateSettings: (settings: AppSettingsDTO) => void;
  login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  lock: () => Promise<void>;
  unlock: (password: string) => Promise<{ success: boolean; error?: string }>;
  completeFirstRun: (wizardData: any) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isFirstRun: null,
  session: null,
  isLocked: false,
  isLoading: true,
  settings: null,

  updateSettings: (settings: AppSettingsDTO) => set({ settings }),

  checkStatus: async () => {
    set({ isLoading: true });
    try {
      // Check if Electron API is available (window.electronAPI)
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        const firstRun = await electronAPI.invoke('auth:isFirstRun');
        if (firstRun) {
          set({ isFirstRun: true, session: null, isLoading: false });
          return;
        }

        const settings = await electronAPI.invoke('settings:get');
        const token = localStorage.getItem('rs_session_token');
        if (token) {
          const session = await electronAPI.invoke('auth:getSession', token);
          if (session) {
            set({
              isFirstRun: false,
              session,
              isLocked: session.isLocked,
              settings,
              isLoading: false,
            });
            return;
          }
        }

        set({ isFirstRun: false, session: null, settings, isLoading: false });
      } else {
        // Fallback for browser testing
        set({ isFirstRun: false, isLoading: false });
      }
    } catch (err) {
      console.error('[AuthStore] Check status failed:', err);
      set({ isFirstRun: false, isLoading: false });
    }
  },

  login: async (credentials) => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) {
        return { success: false, error: 'Electron API unavailable' };
      }

      const res = await electronAPI.invoke('auth:login', credentials);
      if (res.success && res.session) {
        localStorage.setItem('rs_session_token', res.session.token);
        set({ session: res.session, isLocked: false });
        return { success: true };
      }
      return { success: false, error: res.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Login failed' };
    }
  },

  logout: async () => {
    const session = get().session;
    if (session) {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        await electronAPI.invoke('auth:logout', session.token);
      }
      localStorage.removeItem('rs_session_token');
      set({ session: null, isLocked: false });
    }
  },

  lock: async () => {
    const session = get().session;
    if (session) {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        await electronAPI.invoke('auth:lockSession', session.token);
      }
      set({ isLocked: true });
    }
  },

  unlock: async (password: string) => {
    const session = get().session;
    if (!session) return { success: false, error: 'No active session' };

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        const res = await electronAPI.invoke('auth:unlockSession', {
          token: session.token,
          password,
        });
        if (res.success) {
          set({ isLocked: false });
          return { success: true };
        }
        return { success: false, error: res.error || 'Incorrect password' };
      }
      return { success: false, error: 'Electron API unavailable' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unlock failed' };
    }
  },

  completeFirstRun: async (wizardData) => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return { success: false, error: 'Electron API unavailable' };

      const res = await electronAPI.invoke('auth:setupFirstRun', wizardData);
      if (res.success && res.session) {
        localStorage.setItem('rs_session_token', res.session.token);
        set({
          isFirstRun: false,
          session: res.session,
          settings: res.settings,
          isLocked: false,
        });
        return { success: true };
      }
      return { success: false, error: 'Setup could not be completed' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Setup failed' };
    }
  },
}));
