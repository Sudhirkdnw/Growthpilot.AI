import crypto from 'crypto';
import { UserDTO } from '../../../shared/types';

export interface ActiveSession {
  token: string;
  user: UserDTO;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  isLocked: boolean;
}

export class SessionManager {
  private sessions = new Map<string, ActiveSession>();
  private defaultInactivityTimeoutMs = 24 * 60 * 60 * 1000; // 24 hours

  createSession(user: UserDTO, timeoutMs?: number): ActiveSession {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const duration = timeoutMs || this.defaultInactivityTimeoutMs;
    const expiresAt = new Date(now.getTime() + duration);

    const session: ActiveSession = {
      token,
      user,
      createdAt: now,
      expiresAt,
      lastActiveAt: now,
      isLocked: false,
    };

    this.sessions.set(token, session);
    return session;
  }

  getSession(token: string): ActiveSession | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    const now = new Date();
    if (now > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    // Auto-touch: reset expiry on every active request (inactivity-based expiry)
    if (!session.isLocked) {
      session.lastActiveAt = now;
      session.expiresAt = new Date(now.getTime() + this.defaultInactivityTimeoutMs);
    }

    return session;
  }

  touchSession(token: string, timeoutMs?: number): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;

    const now = new Date();
    if (now > session.expiresAt) {
      this.sessions.delete(token);
      return false;
    }

    const duration = timeoutMs || this.defaultInactivityTimeoutMs;
    session.lastActiveAt = now;
    session.expiresAt = new Date(now.getTime() + duration);
    return true;
  }

  lockSession(token: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;
    session.isLocked = true;
    return true;
  }

  unlockSession(token: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;
    session.isLocked = false;
    session.lastActiveAt = new Date();
    session.expiresAt = new Date(Date.now() + this.defaultInactivityTimeoutMs);
    return true;
  }

  invalidateSession(token: string): void {
    this.sessions.delete(token);
  }

  cleanExpiredSessions(): void {
    const now = new Date();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }

  terminateOtherSessionsForUser(userId: string, currentToken?: string): number {
    let terminated = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.user.id === userId && token !== currentToken) {
        this.sessions.delete(token);
        terminated++;
      }
    }
    return terminated;
  }
}

export const sessionManager = new SessionManager();
