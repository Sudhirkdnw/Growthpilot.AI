import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { supplierService } from '../../modules/suppliers/supplier.service';
import { supplierAccountService } from '../../modules/suppliers/supplier-account.service';
import { AuthGuard } from '../plugins/authGuard';

export const supplierRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // LIST SUPPLIERS
  // --------------------------------------------------------------------------
  fastify.get('/api/suppliers', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await supplierService.listSuppliers({
        search: q?.search || undefined,
        status: q?.status || 'ALL',
        page: q?.page ? Number(q.page) : 1,
        pageSize: q?.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // GET SUPPLIER BY ID
  // --------------------------------------------------------------------------
  fastify.get('/api/suppliers/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await supplierService.getSupplierById(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 401);
      return { error: err?.message || 'Failed to fetch supplier' };
    }
  });

  // --------------------------------------------------------------------------
  // CREATE SUPPLIER
  // --------------------------------------------------------------------------
  fastify.post('/api/suppliers', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await supplierService.createSupplier(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create supplier' };
    }
  });

  // --------------------------------------------------------------------------
  // UPDATE SUPPLIER
  // --------------------------------------------------------------------------
  fastify.put('/api/suppliers/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await supplierService.updateSupplier(id, request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to update supplier' };
    }
  });

  // --------------------------------------------------------------------------
  // DELETE SUPPLIER (SAFE PROTECTION)
  // --------------------------------------------------------------------------
  fastify.delete('/api/suppliers/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.requireAdmin(token);
      return await supplierService.deleteSupplier(id, session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('requires Administrator')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to delete supplier' };
    }
  });

  // --------------------------------------------------------------------------
  // SUPPLIER LEDGER
  // --------------------------------------------------------------------------
  fastify.get('/api/suppliers/:id/ledger', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    const q = request.query as any;
    try {
      AuthGuard.verifySession(token);
      const page = q?.page ? Number(q.page) : 1;
      const pageSize = q?.pageSize ? Number(q.pageSize) : 50;
      return await supplierAccountService.getSupplierLedger(id, page, pageSize);
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // RECORD SUPPLIER PAYMENT
  // --------------------------------------------------------------------------
  fastify.post('/api/suppliers/:id/payments', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      const payload = { ...(request.body as any), supplierId: id };
      return await supplierAccountService.recordSupplierPayment(payload, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to record supplier payment' };
    }
  });

  // --------------------------------------------------------------------------
  // RECONCILE SUPPLIER BALANCE
  // --------------------------------------------------------------------------
  fastify.post('/api/suppliers/:id/reconcile', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    const { autoFix } = (request.body as any) || {};
    try {
      const session = AuthGuard.requireAdmin(token);
      return await supplierAccountService.reconcileSupplierBalance(id, autoFix, session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('requires Administrator')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to reconcile supplier balance' };
    }
  });
};
