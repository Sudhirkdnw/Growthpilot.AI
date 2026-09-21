import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { invoiceDataService } from '../../modules/invoice/invoice-data.service';
import { AuthGuard } from '../plugins/authGuard';
import { InvoiceDocumentType } from '../../../shared/types';

export const invoiceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET INVOICE DOCUMENT
  // --------------------------------------------------------------------------
  fastify.get('/api/invoices/document', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const query = request.query as any;

    try {
      AuthGuard.verifySession(token);

      const documentType = (query?.type || query?.documentType || 'SALE') as InvoiceDocumentType;
      const id = query?.id as string;

      if (!id) {
        reply.status(400);
        return { error: 'Transaction ID is required to generate invoice document' };
      }

      const validTypes: InvoiceDocumentType[] = [
        'SALE',
        'SALES_RETURN',
        'PURCHASE',
        'PURCHASE_RETURN',
      ];

      if (!validTypes.includes(documentType)) {
        reply.status(400);
        return { error: `Invalid document type: ${documentType}` };
      }

      const document = await invoiceDataService.getDocument(documentType, id);
      return { success: true, document };
    } catch (err: any) {
      if (err?.message?.includes('not found')) {
        reply.status(404);
        return { error: err.message };
      }
      reply.status(401);
      return { error: err?.message || 'Authentication required' };
    }
  });
};
