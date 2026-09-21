import { sessionManager, ActiveSession } from '../../modules/auth/session.manager';
import { roleService, PermissionCheckOptions } from '../../modules/auth/role.service';

export class AuthGuard {
  /**
   * Authoritatively verifies an active session token in the main process.
   * Throws an unauthorized error if missing or expired.
   */
  static verifySession(token?: string | null): ActiveSession {
    if (!token) {
      throw new Error('Authentication required. Missing session token.');
    }

    const session = sessionManager.getSession(token);
    if (!session) {
      throw new Error('Session has expired or is invalid. Please log in again.');
    }

    if (session.isLocked) {
      throw new Error('Workstation is locked. Password unlock required.');
    }

    return session;
  }

  /**
   * Authoritatively enforces that the authenticated user possesses the ADMIN role.
   * Server-side authorization check — cannot be bypassed from renderer UI.
   */
  static requireAdmin(token?: string | null): ActiveSession {
    const session = this.verifySession(token);
    if (session.user.role !== 'ADMIN') {
      throw new Error('Unauthorized: This action requires Administrator permissions.');
    }
    return session;
  }

  /**
   * Authoritatively enforces that the authenticated user possesses the requested permission.
   * Server-side authorization check — cannot be bypassed from renderer UI or direct IPC.
   */
  static async requirePermission(
    token: string | null | undefined,
    permissionKey: string,
    options?: PermissionCheckOptions
  ): Promise<ActiveSession> {
    const session = this.verifySession(token);

    const allowed = await roleService.hasPermission(session.user.role, permissionKey, {
      ...options,
      currentUserId: session.user.id,
    });

    if (!allowed) {
      throw new Error(
        `Unauthorized: Role "${session.user.role}" does not have the required permission "${permissionKey}". This action requires Administrator permissions.`
      );
    }

    return session;
  }
}

