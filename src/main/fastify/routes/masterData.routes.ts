import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { categoryBrandUnitService } from '../../modules/products/category-brand-unit.service';
import { productService } from '../../modules/products/product.service';
import { AuthGuard } from '../plugins/authGuard';

export const masterDataRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // CATEGORIES
  // --------------------------------------------------------------------------
  fastify.get('/api/categories', async (request) => {
    const includeInactive = (request.query as any)?.includeInactive === 'true';
    return await categoryBrandUnitService.listCategories(includeInactive);
  });

  fastify.post('/api/categories', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.createCategory(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create category' };
    }
  });

  fastify.put('/api/categories/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.updateCategory(id, request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to update category' };
    }
  });

  fastify.delete('/api/categories/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.deleteCategory(id, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to delete category' };
    }
  });

  // --------------------------------------------------------------------------
  // BRANDS
  // --------------------------------------------------------------------------
  fastify.get('/api/brands', async (request) => {
    const includeInactive = (request.query as any)?.includeInactive === 'true';
    return await categoryBrandUnitService.listBrands(includeInactive);
  });

  fastify.post('/api/brands', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.createBrand(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create brand' };
    }
  });

  fastify.put('/api/brands/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.updateBrand(id, request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to update brand' };
    }
  });

  fastify.delete('/api/brands/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.deleteBrand(id, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to delete brand' };
    }
  });

  // --------------------------------------------------------------------------
  // UNITS
  // --------------------------------------------------------------------------
  fastify.get('/api/units', async (request) => {
    const includeInactive = (request.query as any)?.includeInactive === 'true';
    return await categoryBrandUnitService.listUnits(includeInactive);
  });

  fastify.post('/api/units', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.createUnit(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to create unit' };
    }
  });

  fastify.put('/api/units/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.updateUnit(id, request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to update unit' };
    }
  });

  fastify.delete('/api/units/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = AuthGuard.verifySession(token);
      return await categoryBrandUnitService.deleteUnit(id, session.user.id);
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to delete unit' };
    }
  });

  // --------------------------------------------------------------------------
  // PRODUCTS
  // --------------------------------------------------------------------------
  fastify.get('/api/products', async (request, reply) => {
    const q = request.query as any;
    try {
      return await productService.listProducts({
        search: q?.search,
        categoryId: q?.categoryId,
        brandId: q?.brandId,
        status: q?.status || 'ACTIVE',
        page: q?.page ? Number(q.page) : 1,
        pageSize: q?.pageSize ? Number(q.pageSize) : 25,
      });
    } catch (err: any) {
      reply.status(400);
      return { error: err?.message || 'Failed to list products', data: [], total: 0, page: 1, pageSize: 25, totalPages: 1 };
    }
  });

  fastify.get('/api/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await productService.getProductById(id);
    if (!product) {
      reply.status(404);
      return { error: 'Product not found' };
    }
    return product;
  });

  fastify.get('/api/products/search/barcode', async (request, reply) => {
    const barcode = (request.query as any)?.barcode as string;
    const product = await productService.getProductByBarcode(barcode);
    if (!product) {
      reply.status(404);
      return { error: 'No active product found with this barcode' };
    }
    return product;
  });

  fastify.get('/api/products/check-name', async (request) => {
    const name = (request.query as any)?.name as string;
    const excludeId = (request.query as any)?.excludeId as string;
    return await productService.checkDuplicateName(name || '', excludeId);
  });

  fastify.get('/api/products/next-sku', async () => {
    const sku = await productService.getNextSku();
    return { sku };
  });

  fastify.get('/api/products/generate-barcode', async (request) => {
    const prefix = (request.query as any)?.prefix as string;
    const barcode = productService.generateInStoreBarcode(prefix || '21');
    return { barcode };
  });

  fastify.post('/api/products', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = await AuthGuard.requirePermission(token, 'products.create');
      return await productService.createProduct(request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to create product' };
    }
  });

  fastify.post('/api/products/import-csv', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    try {
      const session = await AuthGuard.requirePermission(token, 'products.import');
      const { products, options } = request.body as any;
      return await productService.importProducts(products || [], options || {}, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to import products' };
    }
  });

  fastify.put('/api/products/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.body as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = await AuthGuard.requirePermission(token, 'products.update');
      return await productService.updateProduct(id, request.body as any, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to update product' };
    }
  });

  fastify.delete('/api/products/:id', async (request, reply) => {
    const token = (request.headers['authorization'] || (request.query as any)?.token) as string;
    const { id } = request.params as { id: string };
    try {
      const session = await AuthGuard.requirePermission(token, 'products.delete');
      return await productService.deleteOrDeactivateProduct(id, session.user.id);
    } catch (err: any) {
      reply.status(403);
      return { error: err?.message || 'Failed to delete product' };
    }
  });
};

