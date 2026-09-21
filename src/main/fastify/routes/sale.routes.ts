import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { saleService } from '../../modules/sales/sale.service';
import { roleService } from '../../modules/auth/role.service';
import { settingsService } from '../../modules/settings/settings.service';
import { AuthGuard } from '../plugins/authGuard';

export const saleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // LIST SALES (SCOPE AWARE: sales.view_all vs sales.view_own)
  // --------------------------------------------------------------------------
  fastify.get('/api/sales', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      const canViewAll = await roleService.hasPermission(session.user.role, 'sales.view_all');
      const canViewOwn = await roleService.hasPermission(session.user.role, 'sales.view_own');

      if (!canViewAll && !canViewOwn) {
        reply.status(403);
        return { error: 'Unauthorized: Missing sales.view_own or sales.view_all permission' };
      }

      const q = request.query as any;
      let userIdFilter: string | undefined = undefined;
      if (!canViewAll && canViewOwn) {
        userIdFilter = session.user.id;
      }

      return await saleService.listSales({
        search: q?.search || undefined,
        customerId: q?.customerId || undefined,
        paymentMethod: q?.paymentMethod || undefined,
        status: q?.status || 'ALL',
        startDate: q?.startDate || undefined,
        endDate: q?.endDate || undefined,
        page: q?.page ? Number(q.page) : 1,
        pageSize: q?.pageSize ? Number(q.pageSize) : 25,
        userId: userIdFilter,
      });
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // GET SALE BY ID
  // --------------------------------------------------------------------------
  fastify.get('/api/sales/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      const canViewAll = await roleService.hasPermission(session.user.role, 'sales.view_all');
      const canViewOwn = await roleService.hasPermission(session.user.role, 'sales.view_own');

      if (!canViewAll && !canViewOwn) {
        reply.status(403);
        return { error: 'Unauthorized: Missing sales.view permission' };
      }

      const sale = await saleService.getSaleById(id);
      return sale;
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 403);
      return { error: err?.message || 'Failed to fetch sale' };
    }
  });

  // --------------------------------------------------------------------------
  // CREATE SALE INVOICE (THRESHOLD AWARE: sales.discount vs sales.discount_above_threshold)
  // --------------------------------------------------------------------------
  fastify.post('/api/sales', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = await AuthGuard.requirePermission(token, 'sales.create');
      const body = request.body as any;
      const discount = Number(body?.discount || 0);

      if (discount > 0) {
        const appSettings = await settingsService.getAppSettings();
        const threshold = (appSettings as any)?.pos?.maxDiscountPercent || 10;
        const subtotal = body?.items?.reduce((acc: number, item: any) => acc + (item.quantity * item.sellingPrice), 0) || 1;
        const discountPercent = (discount / subtotal) * 100;

        const hasDiscountPerm = await roleService.hasPermission(session.user.role, 'sales.discount', {
          discountPercent,
          discountThreshold: threshold,
        });

        if (!hasDiscountPerm) {
          reply.status(403);
          return {
            error: `Unauthorized: Discount of ${discountPercent.toFixed(1)}% exceeds permission threshold (${threshold}%). Requires "sales.discount_above_threshold".`,
          };
        }
      }

      return await saleService.createSale(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to create sale' };
    }
  });

  // --------------------------------------------------------------------------
  // CANCEL SALE (SAFE REVERSAL: sales.void)
  // --------------------------------------------------------------------------
  fastify.post('/api/sales/:id/cancel', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = await AuthGuard.requirePermission(token, 'sales.void');
      const reason = (request.body as any)?.reason || 'Cancelled via POS';
      return await saleService.cancelSale(id, reason, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to cancel sale' };
    }
  });
};

