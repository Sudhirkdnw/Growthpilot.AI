import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { salesReturnService } from '../../modules/returns/sales-return.service';
import { purchaseReturnService } from '../../modules/returns/purchase-return.service';
import { AuthGuard } from '../plugins/authGuard';

export const returnsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ==========================================================================
  // SALES RETURNS
  // ==========================================================================

  // 1. GET SALE RETURNABLE DETAILS
  fastify.get('/api/sales/:id/returnable', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await salesReturnService.getSaleReturnableDetails(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 400);
      return { error: err?.message || 'Failed to fetch returnable details for sale' };
    }
  });

  // 2. CREATE SALES RETURN
  fastify.post('/api/sales-returns', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await salesReturnService.createSalesReturn(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create sales return' };
    }
  });

  // 3. LIST SALES RETURNS
  fastify.get('/api/sales-returns', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await salesReturnService.listSalesReturns({
        search: q?.search || undefined,
        customerId: q?.customerId || undefined,
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

  // 4. GET SALES RETURN BY ID
  fastify.get('/api/sales-returns/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await salesReturnService.getSalesReturnById(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 400);
      return { error: err?.message || 'Failed to fetch sales return' };
    }
  });

  // 5. CANCEL SALES RETURN
  fastify.post('/api/sales-returns/:id/cancel', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    const { reason } = (request.body as any) || {};
    try {
      const session = AuthGuard.verifySession(token);
      return await salesReturnService.cancelSalesReturn(id, reason, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to cancel sales return' };
    }
  });

  // ==========================================================================
  // PURCHASE RETURNS
  // ==========================================================================

  // 6. GET PURCHASE RETURNABLE DETAILS
  fastify.get('/api/purchases/:id/returnable', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await purchaseReturnService.getPurchaseReturnableDetails(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 400);
      return { error: err?.message || 'Failed to fetch returnable details for purchase' };
    }
  });

  // 7. CREATE PURCHASE RETURN
  fastify.post('/api/purchase-returns', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await purchaseReturnService.createPurchaseReturn(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create purchase return' };
    }
  });

  // 8. LIST PURCHASE RETURNS
  fastify.get('/api/purchase-returns', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await purchaseReturnService.listPurchaseReturns({
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

  // 9. GET PURCHASE RETURN BY ID
  fastify.get('/api/purchase-returns/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await purchaseReturnService.getPurchaseReturnById(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 400);
      return { error: err?.message || 'Failed to fetch purchase return' };
    }
  });

  // 10. CANCEL PURCHASE RETURN
  fastify.post('/api/purchase-returns/:id/cancel', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    const { reason } = (request.body as any) || {};
    try {
      const session = AuthGuard.verifySession(token);
      return await purchaseReturnService.cancelPurchaseReturn(id, reason, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to cancel purchase return' };
    }
  });
};
