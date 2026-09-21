import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authService } from '../../modules/auth/auth.service';
import { settingsService } from '../../modules/settings/settings.service';
import { bruteForceProtector } from '../../security/bruteForceProtector';
import { auditService } from '../../modules/audit/audit.service';
import { LoginSchema } from '../../../shared/schemas';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Check if store is in first-run state
  fastify.get('/api/auth/first-run', async () => {
    const isFirstRun = await settingsService.isFirstRun();
    return { isFirstRun };
  });

  // Complete atomic first-run wizard
  fastify.post('/api/auth/first-run/setup', async (request, reply) => {
    try {
      const result = await settingsService.completeFirstRunWizard(request.body as any);
      return result;
    } catch (err: any) {
      reply.status(400);
      return { success: false, error: err?.message || 'First-run setup failed' };
    }
  });

  // User login with brute force defense
  fastify.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { success: false, error: 'Invalid username or password format' };
    }

    const { username, password } = parsed.data;

    // 1. Brute-force check
    const lockout = bruteForceProtector.checkStatus(username);
    if (lockout.isLocked) {
      await auditService.log({
        action: 'LOGIN_BLOCKED_BRUTE_FORCE',
        entityType: 'User',
        reason: `Too many failed attempts for ${username}. Locked for ${lockout.remainingMinutes} minutes.`,
      });
      reply.status(429);
      return {
        success: false,
        error: `Account temporarily locked due to 5 failed attempts. Please retry in ${lockout.remainingMinutes} minutes.`,
      };
    }

    // 2. Perform authentication
    const result = await authService.login({ username, password });
    if (!result.success) {
      const updatedLockout = bruteForceProtector.recordFailedAttempt(username);
      if (updatedLockout.isLocked) {
        reply.status(429);
        return {
          success: false,
          error: `Maximum failed attempts reached. Account locked for ${updatedLockout.remainingMinutes} minutes.`,
        };
      }
      reply.status(401);
      return {
        success: false,
        error: `Invalid username or password. (${5 - updatedLockout.attempts} attempts remaining)`,
      };
    }

    // 3. Reset failed attempts on success
    bruteForceProtector.recordSuccess(username);
    return result;
  });

  // Logout
  fastify.post('/api/auth/logout', async (request) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    if (token) {
      await authService.logout(token);
    }
    return { success: true };
  });

  // Verify and retrieve session
  fastify.get('/api/auth/session', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    if (!token) {
      reply.status(401);
      return { session: null };
    }

    const session = await authService.getSession(token);
    if (!session) {
      reply.status(401);
      return { session: null };
    }

    return { session };
  });

  // Lock station
  fastify.post('/api/auth/lock', async (request) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    if (token) {
      authService.lockSession(token);
    }
    return { success: true };
  });

  // Unlock station
  fastify.post('/api/auth/unlock', async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string };
    if (!token || !password) {
      reply.status(400);
      return { success: false, error: 'Token and password required' };
    }

    const result = await authService.unlockSession(token, password);
    if (!result.success) {
      reply.status(401);
    }
    return result;
  });
};
