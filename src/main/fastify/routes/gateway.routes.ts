import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { paymentGatewayService } from '../../modules/gateways/payment-gateway.service';
import { AuthGuard } from '../plugins/authGuard';

export const gatewayRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Test gateway credentials - Settings admin / dangerous permission access
  fastify.post('/api/gateways/test', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = AuthGuard.verifySession(token);
      if (session.user.role !== 'ADMIN') {
        await AuthGuard.requirePermission(token, 'settings.update');
      }
      const { gateway, config } = request.body as any;
      const result = await paymentGatewayService.testGateway({ gateway, config }, session.user.id);
      return result;
    } catch (err: any) {
      reply.status(403);
      return {
        success: false,
        provider: (request.body as any)?.gateway,
        mode: (request.body as any)?.config?.mode || 'TEST',
        errorCode: 'UNAUTHORIZED',
        message: err?.message || 'Unauthorized gateway test',
        userMessage: err?.message || 'Unauthorized gateway test',
      };
    }
  });

  // Create payment attempt & order for POS
  fastify.post('/api/gateways/create-order', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = AuthGuard.verifySession(token);
      const body = request.body as any;
      const result = await paymentGatewayService.createPaymentAttempt(body, session.user.id);
      return result;
    } catch (err: any) {
      reply.status(401);
      return { success: false, error: err?.message || 'Unauthorized payment order creation' };
    }
  });

  fastify.post('/api/gateways/create-attempt', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = AuthGuard.verifySession(token);
      const body = request.body as any;
      const result = await paymentGatewayService.createPaymentAttempt(body, session.user.id);
      return result;
    } catch (err: any) {
      reply.status(401);
      return { success: false, error: err?.message || 'Unauthorized payment attempt initialization' };
    }
  });

  // Check transaction status for POS polling & authoritative verification
  fastify.post('/api/gateways/check-status', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = AuthGuard.verifySession(token);
      const { gateway, orderId, attemptId } = request.body as any;
      const result = await paymentGatewayService.checkPaymentStatus(
        { gateway, orderId, attemptId },
        session.user.id
      );
      return result;
    } catch (err: any) {
      reply.status(401);
      return { success: false, status: 'FAILED', message: err?.message || 'Unauthorized status check' };
    }
  });

  // Cancel payment attempt
  fastify.post('/api/gateways/cancel-attempt', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = AuthGuard.verifySession(token);
      const { attemptId } = request.body as any;
      const result = await paymentGatewayService.cancelPaymentAttempt(attemptId, session.user.id);
      return result;
    } catch (err: any) {
      reply.status(401);
      return { success: false, error: err?.message || 'Failed to cancel payment attempt' };
    }
  });

  // Manual payment override (Cashier/Manager override)
  fastify.post('/api/gateways/manual-override', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = AuthGuard.verifySession(token);
      const result = await paymentGatewayService.manualPaymentOverride(request.body as any, session);
      return result;
    } catch (err: any) {
      reply.status(403);
      return { success: false, error: err?.message || 'Manual payment override failed' };
    }
  });

  // Reconciliation: get unreconciled payments
  fastify.get('/api/gateways/unreconciled', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;

    try {
      AuthGuard.verifySession(token);
      const results = await paymentGatewayService.getUnreconciledPayments();
      return { success: true, items: results };
    } catch (err: any) {
      reply.status(401);
      return { success: false, error: err?.message || 'Unauthorized reconciliation access' };
    }
  });

  // Crash recovery: recover payment
  fastify.post('/api/gateways/recover-payment', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;

    try {
      const session = AuthGuard.verifySession(token);
      const { attemptId } = request.body as any;
      const result = await paymentGatewayService.recoverPayment(attemptId, session.user.id);
      return result;
    } catch (err: any) {
      reply.status(400);
      return { success: false, error: err?.message || 'Crash recovery failed' };
    }
  });
};
