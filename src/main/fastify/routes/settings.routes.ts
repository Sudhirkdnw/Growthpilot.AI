import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { settingsService } from '../../modules/settings/settings.service';
import { userManagementService } from '../../modules/auth/user-management.service';
import { AuthGuard } from '../plugins/authGuard';

export const settingsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get App Settings (sanitized / masked for renderer)
  fastify.get('/api/settings', async () => {
    return await settingsService.getAppSettings();
  });

  // Update App Settings - REQUIRE settings.update / settings.update_dangerous
  fastify.put('/api/settings', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = await AuthGuard.requirePermission(token, 'settings.update');

      const { settings } = request.body as any;
      // If updating dangerous sections, require settings.update_dangerous
      if (settings?.security || settings?.fiscalYear) {
        await AuthGuard.requirePermission(token, 'settings.update_dangerous');
      }

      const updated = await settingsService.updateAppSettings(settings, session.user.id);
      return { success: true, settings: updated };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Unauthorized settings update' };
    }
  });

  // Test SMTP connection - ADMIN ONLY
  fastify.post('/api/settings/test-smtp', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      await AuthGuard.requirePermission(token, 'settings.update');
      const { config } = request.body as any;
      const result = await settingsService.testSmtpConnection(config || {});
      return result;
    } catch (err: any) {
      reply.status(403);
      return { success: false, message: err?.message || 'Unauthorized SMTP test' };
    }
  });

  // System Health - ADMIN ONLY
  fastify.get('/api/admin/system-health', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;

    try {
      AuthGuard.requireAdmin(token);
      const health = await settingsService.getSystemHealth();
      return { success: true, health };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Unauthorized system health access' };
    }
  });

  // Users Management - List Users (REQUIRE users.view)
  fastify.get('/api/admin/users', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;

    try {
      await AuthGuard.requirePermission(token, 'users.view');
      const users = await userManagementService.listUsers();
      return { success: true, users };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Unauthorized user management access' };
    }
  });

  // Users Management - Create User (REQUIRE users.create & users.create_super_admin if role is ADMIN)
  fastify.post('/api/admin/users', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = await AuthGuard.requirePermission(token, 'users.create');
      const body = request.body as any;
      if (body?.role === 'ADMIN') {
        await AuthGuard.requirePermission(token, 'users.create_super_admin');
      }

      const user = await userManagementService.createUser(body, session.user.id);
      return { success: true, user };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Failed to create user' };
    }
  });

  // Users Management - Update User (REQUIRE users.update & users.create_super_admin if role changed to ADMIN)
  fastify.put('/api/admin/users/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };

    try {
      const session = await AuthGuard.requirePermission(token, 'users.update');
      const body = request.body as any;
      if (body?.role === 'ADMIN') {
        await AuthGuard.requirePermission(token, 'users.create_super_admin');
      }

      const user = await userManagementService.updateUser(id, body, session.user.id);
      return { success: true, user };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Failed to update user' };
    }
  });
};

