import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { expenseCategoryService } from '../../modules/expenses/expense-category.service';
import { expenseService } from '../../modules/expenses/expense.service';
import { reportService } from '../../modules/reports/report.service';
import { AuthGuard } from '../plugins/authGuard';

export const expenseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // EXPENSE CATEGORIES
  // --------------------------------------------------------------------------

  // List Categories
  fastify.get('/api/expense-categories', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await expenseCategoryService.listCategories({
        search: q?.search || undefined,
        status: q?.status || 'ALL',
      });
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });

  // Create Category
  fastify.post('/api/expense-categories', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await expenseCategoryService.createCategory(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create expense category' };
    }
  });

  // Update Category
  fastify.put('/api/expense-categories/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await expenseCategoryService.updateCategory(id, request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to update expense category' };
    }
  });

  // Delete Category (Admin Only)
  fastify.delete('/api/expense-categories/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.requireAdmin(token);
      return await expenseCategoryService.deleteCategory(id, session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('requires Administrator')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to delete expense category' };
    }
  });

  // --------------------------------------------------------------------------
  // EXPENSES
  // --------------------------------------------------------------------------

  // List Expenses
  fastify.get('/api/expenses', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await expenseService.listExpenses({
        categoryId: q?.categoryId || undefined,
        paymentMethod: q?.paymentMethod || 'ALL',
        status: q?.status || 'ALL',
        search: q?.search || undefined,
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

  // Get Expense By ID
  fastify.get('/api/expenses/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      AuthGuard.verifySession(token);
      return await expenseService.getExpenseById(id);
    } catch (err: any) {
      reply.status(err?.message?.includes('not found') ? 404 : 401);
      return { error: err?.message || 'Failed to fetch expense' };
    }
  });

  // Create Expense
  fastify.post('/api/expenses', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await expenseService.createExpense(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to record expense' };
    }
  });

  // Cancel Expense (Admin Only)
  fastify.post('/api/expenses/:id/cancel', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.requireAdmin(token);
      const reason = (request.body as any)?.reason;
      return await expenseService.cancelExpense({ expenseId: id, reason }, session.user.id);
    } catch (err: any) {
      if (err?.message?.includes('requires Administrator')) {
        reply.status(403);
        return { error: 'Forbidden', message: err.message };
      }
      reply.status(400);
      return { error: err?.message || 'Failed to cancel expense' };
    }
  });

  // --------------------------------------------------------------------------
  // HISTORICAL PROFIT & LOSS SUMMARY
  // --------------------------------------------------------------------------
  fastify.get('/api/reports/profit-summary', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    try {
      AuthGuard.verifySession(token);
      const q = request.query as any;
      return await reportService.getProfitSummary({
        period: q?.period || 'THIS_MONTH',
        startDate: q?.startDate || undefined,
        endDate: q?.endDate || undefined,
      });
    } catch (err: any) {
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });
};
