import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { inventoryService } from '../../modules/inventory/inventory.service';
import { AuthGuard } from '../plugins/authGuard';

export const inventoryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // INVENTORY SUMMARY & VALUATION
  // --------------------------------------------------------------------------
  fastify.get('/api/inventory/summary', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      return await inventoryService.getInventorySummary();
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // STOCK LEDGER AUDIT TRAIL
  // --------------------------------------------------------------------------
  fastify.get('/api/inventory/ledger', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await inventoryService.getStockLedger({
        productId: q?.productId || undefined,
        transactionType: q?.transactionType || 'ALL',
        search: q?.search || undefined,
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
  // LOW STOCK & OUT OF STOCK ALERTS
  // --------------------------------------------------------------------------
  fastify.get('/api/inventory/low-stock', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      const page = q?.page ? Number(q.page) : 1;
      const pageSize = q?.pageSize ? Number(q.pageSize) : 50;
      return await inventoryService.getLowStockProducts(page, pageSize);
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // STOCK ADJUSTMENT (SENSITIVE - REQUIRES AUTHORIZATION)
  // --------------------------------------------------------------------------
  const handleAdjustment = async (request: any, reply: any) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await inventoryService.createStockAdjustment(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create stock adjustment' };
    }
  };

  fastify.post('/api/inventory/adjust', handleAdjustment);
  fastify.post('/api/inventory/adjustments', handleAdjustment);

  // --------------------------------------------------------------------------
  // STOCK RECONCILIATION DIAGNOSTICS & ADMIN FIX
  // --------------------------------------------------------------------------
  fastify.get('/api/inventory/reconcile/:productId', async (request, reply) => {
    const { productId } = request.params as { productId: string };
    try {
      return await inventoryService.reconcileProductStock(productId);
    } catch (err: any) {
      reply.status(404);
      return { error: err?.message || 'Product not found' };
    }
  });

  fastify.post('/api/inventory/reconcile/:productId', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { productId } = request.params as { productId: string };
    const { autoFix } = (request.body as any) || {};
    try {
      const session = AuthGuard.requireAdmin(token);
      return await inventoryService.reconcileProductStock(productId, autoFix, session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('Unauthorized: This action requires Administrator permissions.')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to reconcile product stock' };
    }
  });

  fastify.get('/api/inventory/reconcile', async () => {
    return await inventoryService.reconcileAllProducts();
  });
};
