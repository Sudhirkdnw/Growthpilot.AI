import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { purchaseService } from '../../modules/purchases/purchase.service';
import { AuthGuard } from '../plugins/authGuard';

export const purchaseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // LIST PURCHASES
  // --------------------------------------------------------------------------
  fastify.get('/api/purchases', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await purchaseService.listPurchases({
        search: q?.search || undefined,
        supplierId: q?.supplierId || undefined,
        status: q?.status || 'ALL',
        startDate: q?.startDate || undefined,
        endDate: q?.endDate || undefined,
        page: q?.page ? Number(q.page) : 1,
        pageSize: q?.pageSize ? Number(q.pageSize) : 25,
      });
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // GET PURCHASE BY ID
  // --------------------------------------------------------------------------
  fastify.get('/api/purchases/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await purchaseService.getPurchaseById(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 401);
      return { error: err?.message || 'Failed to fetch purchase' };
    }
  });

  // --------------------------------------------------------------------------
  // CREATE PURCHASE ORDER (ATOMIC TRANSACTION)
  // --------------------------------------------------------------------------
  fastify.post('/api/purchases', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await purchaseService.createPurchase(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create purchase' };
    }
  });

  // --------------------------------------------------------------------------
  // CANCEL PURCHASE (SAFE REVERSAL)
  // --------------------------------------------------------------------------
  fastify.post('/api/purchases/:id/cancel', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    const { reason } = (request.body as any) || {};
    try {
      const session = AuthGuard.requireAdmin(token);
      return await purchaseService.cancelPurchase(id, reason, session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('requires Administrator')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to cancel purchase' };
    }
  });
};
