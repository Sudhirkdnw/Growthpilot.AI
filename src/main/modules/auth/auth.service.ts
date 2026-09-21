import { getPrismaClient } from '../../database/client';
import { PasswordHasher } from '../../security/password.hasher';
import { sessionManager, ActiveSession } from './session.manager';
import { auditService } from '../audit/audit.service';
import { settingsService } from '../settings/settings.service';
import { UserDTO, Role, Status } from '../../../shared/types';
import { LoginSchema } from '../../../shared/schemas';
import { z } from 'zod';

export type LoginInput = z.infer<typeof LoginSchema>;

export class AuthService {
  /**
   * Authenticates a user with username and password, returning an active session.
   */
  async login(input: LoginInput): Promise<{ success: boolean; session?: ActiveSession; error?: string }> {
    const validated = LoginSchema.parse(input);
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (!user) {
      await auditService.log({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        reason: `Unknown username: ${validated.username}`,
      });
      return { success: false, error: 'Invalid username or password' };
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, error: 'User account is inactive. Contact store owner.' };
    }

    const isValidPassword = await PasswordHasher.verify(validated.password, user.passwordHash);
    if (!isValidPassword) {
      await auditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        reason: 'Incorrect password entered',
      });
      return { success: false, error: 'Invalid username or password' };
    }

    const userDTO: UserDTO = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as Role,
      status: user.status as Status,
      createdAt: user.createdAt.toISOString(),
    };

    const session = sessionManager.createSession(userDTO);

    try {
      const settings = await settingsService.getAppSettings();
      if (settings.security?.singleSessionPerAccount) {
        sessionManager.terminateOtherSessionsForUser(user.id, session.token);
      }
    } catch {
      // safe fallback
    }

    await auditService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
    });

    return { success: true, session };
  }

  /**
   * Logs out the user and invalidates the session token.
   */
  async logout(token: string): Promise<void> {
    const session = sessionManager.getSession(token);
    if (session) {
      await auditService.log({
        userId: session.user.id,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: session.user.id,
      });
      sessionManager.invalidateSession(token);
    }
  }

  /**
   * Validates a session token and touches expiration.
   */
  async getSession(token: string): Promise<ActiveSession | null> {
    const session = sessionManager.getSession(token);
    if (session && !session.isLocked) {
      sessionManager.touchSession(token);
    }
    return session;
  }

  /**
   * Manually or automatically locks the session.
   */
  lockSession(token: string): boolean {
    return sessionManager.lockSession(token);
  }

  /**
   * Unlocks the session by validating the user's password.
   */
  async unlockSession(token: string, password: string): Promise<{ success: boolean; error?: string }> {
    const session = sessionManager.getSession(token);
    if (!session) {
      return { success: false, error: 'Session has expired. Please log in again.' };
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return { success: false, error: 'User no longer exists' };
    }

    const isValid = await PasswordHasher.verify(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Incorrect password' };
    }

    sessionManager.unlockSession(token);
    await auditService.log({
      userId: user.id,
      action: 'SESSION_UNLOCKED',
      entityType: 'User',
      entityId: user.id,
    });

    return { success: true };
  }
}

export const authService = new AuthService();
