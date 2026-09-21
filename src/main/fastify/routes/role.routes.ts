import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { roleService } from '../../modules/auth/role.service';
import { AuthGuard } from '../plugins/authGuard';

export const roleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Helper to extract bearer token or body/query token
  const getToken = (request: any): string | undefined => {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return authHeader || request.body?.token || request.query?.token;
  };

  // List all permissions in the system catalogue
  fastify.get('/api/admin/permissions', async (request, reply) => {
    const token = getToken(request);
    try {
      AuthGuard.verifySession(token);
      const catalogue = roleService.getPermissionCatalogue();
      return { success: true, catalogue };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Unauthorized' };
    }
  });

  // List all roles with user count and permission count
  fastify.get('/api/admin/roles', async (request, reply) => {
    const token = getToken(request);
    try {
      await AuthGuard.requirePermission(token, 'roles.manage');
      const roles = await roleService.listRoles();
      return { success: true, roles };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Unauthorized' };
    }
  });

  // Get a single role by ID
  fastify.get('/api/admin/roles/:id', async (request, reply) => {
    const token = getToken(request);
    const { id } = request.params as { id: string };
    try {
      await AuthGuard.requirePermission(token, 'roles.manage');
      const role = await roleService.getRoleById(id);
      return { success: true, role };
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Unauthorized' };
    }
  });

  // Create a new role
  fastify.post('/api/admin/roles', async (request, reply) => {
    const token = getToken(request);
    try {
      const session = await AuthGuard.requirePermission(token, 'roles.manage');
      const role = await roleService.createRole(request.body as any, session.user.id);
      return { success: true, role };
    } catch (err: any) {
      reply.status(400);
      return { success: false, error: err?.message || 'Failed to create role' };
    }
  });

  // Update an existing role
  fastify.put('/api/admin/roles/:id', async (request, reply) => {
    const token = getToken(request);
    const { id } = request.params as { id: string };
    try {
      const session = await AuthGuard.requirePermission(token, 'roles.manage');
      const role = await roleService.updateRole(id, request.body as any, session.user.id);
      return { success: true, role };
    } catch (err: any) {
      reply.status(400);
      return { success: false, error: err?.message || 'Failed to update role' };
    }
  });

  // Delete a role safely
  fastify.delete('/api/admin/roles/:id', async (request, reply) => {
    const token = getToken(request);
    const { id } = request.params as { id: string };
    try {
      const session = await AuthGuard.requirePermission(token, 'roles.manage');
      const result = await roleService.deleteRole(id, session.user.id);
      return { success: true, result };
    } catch (err: any) {
      reply.status(400);
      return { success: false, error: err?.message || 'Failed to delete role' };
    }
  });
};
