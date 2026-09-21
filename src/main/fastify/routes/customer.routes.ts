import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { customerService } from '../../modules/customers/customer.service';
import { customerAccountService } from '../../modules/customers/customer-account.service';
import { AuthGuard } from '../plugins/authGuard';

export const customerRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // LIST CUSTOMERS
  // --------------------------------------------------------------------------
  fastify.get('/api/customers', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      await AuthGuard.requirePermission(token, 'customers.view');
      const q = request.query as any;
      return await customerService.listCustomers({
        search: q?.search || undefined,
        status: q?.status || 'ALL',
        hasOutstanding: q?.hasOutstanding === 'true' || q?.hasOutstanding === true ? true : undefined,
        page: q?.page ? Number(q.page) : 1,
        pageSize: q?.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // RECEIVABLES SUMMARY OVERVIEW
  // --------------------------------------------------------------------------
  fastify.get('/api/customers/receivables/summary', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      await AuthGuard.requirePermission(token, 'customers.view');
      return await customerService.getReceivablesSummary();
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // GET CUSTOMER BY ID
  // --------------------------------------------------------------------------
  fastify.get('/api/customers/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      await AuthGuard.requirePermission(token, 'customers.view');
      if (id === 'cash-customer') {
        return customerService.getDefaultCashCustomer();
      }
      return await customerService.getCustomerById(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 403);
      return { error: err?.message || 'Failed to fetch customer' };
    }
  });

  // --------------------------------------------------------------------------
  // CREATE CUSTOMER
  // --------------------------------------------------------------------------
  fastify.post('/api/customers', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = await AuthGuard.requirePermission(token, 'customers.create');
      return await customerService.createCustomer(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to create customer' };
    }
  });

  // --------------------------------------------------------------------------
  // UPDATE CUSTOMER
  // --------------------------------------------------------------------------
  fastify.put('/api/customers/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = await AuthGuard.requirePermission(token, 'customers.update');
      return await customerService.updateCustomer(id, request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to update customer' };
    }
  });

  // --------------------------------------------------------------------------
  // DELETE CUSTOMER (ADMIN / CUSTOMERS.DELETE, WITH FINANCIAL HISTORY GUARD)
  // --------------------------------------------------------------------------
  fastify.delete('/api/customers/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = await AuthGuard.requirePermission(token, 'customers.delete');
      return await customerService.deleteCustomer(id, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: 'Forbidden', message: err?.message || 'Failed to delete customer' };
    }
  });



  // --------------------------------------------------------------------------
  // CUSTOMER LEDGER
  // --------------------------------------------------------------------------
  fastify.get('/api/customers/:id/ledger', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    const q = request.query as any;
    try {
      AuthGuard.verifySession(token);
      return await customerAccountService.getCustomerLedger(id, {
        type: q?.type || undefined,
        startDate: q?.startDate || undefined,
        endDate: q?.endDate || undefined,
        page: q?.page ? Number(q.page) : 1,
        pageSize: q?.pageSize ? Number(q.pageSize) : 50,
      });
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // RECORD CUSTOMER PAYMENT
  // --------------------------------------------------------------------------
  fastify.post('/api/customers/:id/payments', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      const payload = { ...(request.body as any), customerId: id };
      return await customerAccountService.recordCustomerPayment(payload, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to record customer payment' };
    }
  });

  // --------------------------------------------------------------------------
  // REVERSE CUSTOMER PAYMENT (ADMIN ONLY)
  // --------------------------------------------------------------------------
  fastify.post('/api/customers/payments/:paymentId/reverse', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { paymentId } = request.params as { paymentId: string };
    try {
      const session = AuthGuard.requireAdmin(token);
      const payload = { ...(request.body as any), paymentId };
      return await customerAccountService.reverseCustomerPayment(payload, session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('requires Administrator')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to reverse customer payment' };
    }
  });

  // --------------------------------------------------------------------------
  // CUSTOMER ACCOUNT STATEMENT
  // --------------------------------------------------------------------------
  fastify.get('/api/customers/:id/statement', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    const q = request.query as any;
    try {
      AuthGuard.verifySession(token);
      return await customerAccountService.getCustomerStatement(id, {
        startDate: q?.startDate || undefined,
        endDate: q?.endDate || undefined,
      });
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // --------------------------------------------------------------------------
  // RECONCILE CUSTOMER BALANCE (DIAGNOSTIC / REPAIR)
  // --------------------------------------------------------------------------
  fastify.get('/api/customers/:id/reconcile', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await customerAccountService.reconcileCustomerBalance(id, false);
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  fastify.post('/api/customers/:id/reconcile', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    const { autoFix } = (request.body as any) || {};
    try {
      const session = AuthGuard.requireAdmin(token);
      return await customerAccountService.reconcileCustomerBalance(id, Boolean(autoFix), session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('requires Administrator')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to reconcile customer balance' };
    }
  });
};
