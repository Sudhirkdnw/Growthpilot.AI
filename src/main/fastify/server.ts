import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes } from './routes/auth.routes';
import { settingsRoutes } from './routes/settings.routes';
import { masterDataRoutes } from './routes/masterData.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { supplierRoutes } from './routes/supplier.routes';
import { purchaseRoutes } from './routes/purchase.routes';
import { customerRoutes } from './routes/customer.routes';
import { saleRoutes } from './routes/sale.routes';
import { returnsRoutes } from './routes/returns.routes';
import { expenseRoutes } from './routes/expense.routes';
import { reportRoutes } from './routes/reports.routes';
import { invoiceRoutes } from './routes/invoice.routes';
import { maintenanceRoutes } from './routes/maintenance.routes';
import { roleRoutes } from './routes/role.routes';
import { gatewayRoutes } from './routes/gateway.routes';

let fastifyApp: FastifyInstance | null = null;

export async function getFastifyServer(): Promise<FastifyInstance> {
  if (!fastifyApp) {
    fastifyApp = Fastify({
      logger: false, // Desktop uses structured file logger
    });

    // Register routes
    await fastifyApp.register(authRoutes);
    await fastifyApp.register(settingsRoutes);
    await fastifyApp.register(masterDataRoutes);
    await fastifyApp.register(inventoryRoutes);
    await fastifyApp.register(supplierRoutes);
    await fastifyApp.register(purchaseRoutes);
    await fastifyApp.register(customerRoutes);
    await fastifyApp.register(saleRoutes);
    await fastifyApp.register(returnsRoutes);
    await fastifyApp.register(expenseRoutes);
    await fastifyApp.register(reportRoutes);
    await fastifyApp.register(invoiceRoutes);
    await fastifyApp.register(maintenanceRoutes);
    await fastifyApp.register(roleRoutes);
    await fastifyApp.register(gatewayRoutes);


    await fastifyApp.ready();
    console.log('[Fastify] Application framework initialized successfully.');
  }
  return fastifyApp;
}

/**
 * Executes an in-memory Fastify request directly from an IPC call without network socket overhead.
 */
export async function dispatchFastify<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  payload?: any,
  headers?: Record<string, string>
): Promise<T> {
  const app = await getFastifyServer();
  const response = await app.inject({
    method,
    url,
    payload,
    headers: headers || {},
  });

  try {
    return JSON.parse(response.body) as T;
  } catch {
    return response.body as unknown as T;
  }
}
