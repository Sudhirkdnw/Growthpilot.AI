import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { inventoryService } from '../inventory/inventory.service';
import { auditService } from '../audit/audit.service';
import { invoiceSequenceService } from '../sales/invoice-sequence.service';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductQuerySchema,
} from '../../../shared/schemas';
import { ProductDTO, PaginatedResult } from '../../../shared/types';
import { z } from 'zod';

export class ProductService {
  /**
   * Retrieves paginated list of products with search (name, sku, barcode) and stock value.
   */
  async listProducts(
    params: z.input<typeof ProductQuerySchema>
  ): Promise<PaginatedResult<ProductDTO>> {
    const validated = ProductQuerySchema.parse(params);
    const prisma = getPrismaClient();

    const where: any = {};

    // Status filter
    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    // Category & Brand filters
    if (validated.categoryId) where.categoryId = validated.categoryId;
    if (validated.brandId) where.brandId = validated.brandId;

    // Search by Name, SKU, or Barcode
    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { name: { contains: q } },
        { sku: { contains: q } },
        { barcode: { contains: q } },
      ];
    }

    const skip = (validated.page - 1) * validated.pageSize;
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, shortCode: true, allowDecimal: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const data: ProductDTO[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      categoryName: p.category?.name || null,
      brandId: p.brandId,
      brandName: p.brand?.name || null,
      unitId: p.unitId,
      unitCode: p.unit?.shortCode,
      allowDecimal: p.unit?.allowDecimal ?? false,
      purchasePrice: Number(p.purchasePrice),
      salePrice: Number(p.salePrice),
      taxRate: Number(p.taxRate),
      openingStock: Number(p.openingStock),
      reorderLevel: Number(p.reorderLevel),
      currentStock: Number(p.currentStock),
      status: p.status as any,
      imageUrl: p.imageUrl ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return {
      data,
      total,
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: Math.ceil(total / validated.pageSize),
    };
  }

  /**
   * Retrieves single product details by ID.
   */
  async getProductById(id: string): Promise<ProductDTO | null> {
    const prisma = getPrismaClient();
    const p = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      categoryName: p.category?.name || null,
      brandId: p.brandId,
      brandName: p.brand?.name || null,
      unitId: p.unitId,
      unitCode: p.unit?.shortCode,
      allowDecimal: p.unit?.allowDecimal ?? false,
      purchasePrice: Number(p.purchasePrice),
      salePrice: Number(p.salePrice),
      taxRate: Number(p.taxRate),
      openingStock: Number(p.openingStock),
      reorderLevel: Number(p.reorderLevel),
      currentStock: Number(p.currentStock),
      status: p.status as any,
      imageUrl: p.imageUrl ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /**
   * Fast offline lookup by barcode for POS scanner.
   */
  async getProductByBarcode(barcode: string): Promise<ProductDTO | null> {
    if (!barcode || !barcode.trim()) return null;
    const prisma = getPrismaClient();

    const p = await prisma.product.findFirst({
      where: {
        barcode: barcode.trim(),
        status: 'ACTIVE',
      },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      categoryName: p.category?.name || null,
      brandId: p.brandId,
      brandName: p.brand?.name || null,
      unitId: p.unitId,
      unitCode: p.unit?.shortCode,
      allowDecimal: p.unit?.allowDecimal ?? false,
      purchasePrice: Number(p.purchasePrice),
      salePrice: Number(p.salePrice),
      taxRate: Number(p.taxRate),
      openingStock: Number(p.openingStock),
      reorderLevel: Number(p.reorderLevel),
      currentStock: Number(p.currentStock),
      status: p.status as any,
      imageUrl: p.imageUrl ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /**
   * Checks for duplicate product names to produce a friendly warning without blocking.
   */
  async checkDuplicateName(name: string, excludeId?: string): Promise<{ hasDuplicate: boolean; similarName?: string }> {
    const prisma = getPrismaClient();
    const existing = await prisma.product.findFirst({
      where: {
        name: { equals: name.trim() },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { name: true },
    });

    if (existing) {
      return { hasDuplicate: true, similarName: existing.name };
    }
    return { hasDuplicate: false };
  }

  /**
   * Generates a preview SKU for the next product sequence.
   */
  async getNextSku(): Promise<string> {
    const prisma = getPrismaClient();
    const seq = await prisma.invoiceSequence.findUnique({ where: { type: 'PRODUCT_SKU' } });
    const nextNum = seq ? seq.nextNumber : 1;
    const prefix = seq ? seq.prefix : 'SKU-';
    const pad = seq ? seq.padLength : 5;
    return `${prefix}${String(nextNum).padStart(pad, '0')}`;
  }

  /**
   * Generates an in-store barcode (13 digits with standard prefix).
   */
  generateInStoreBarcode(prefix = '21'): string {
    const timestamp = Date.now().toString().slice(-8);
    const rand = Math.floor(10 + Math.random() * 90).toString();
    const base = `${prefix}${timestamp}${rand}`.slice(0, 12);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return `${base}${checkDigit}`;
  }

  /**
   * Creates a new product.
   * Atomically records opening stock in the stock_ledger if openingStock > 0.
   * Handles database unique constraint collisions (P2002) for SKU and Barcode gracefully.
   */
  async createProduct(
    input: z.input<typeof CreateProductSchema>,
    userId?: string
  ): Promise<{ product: ProductDTO; duplicateNameWarning?: string }> {
    const validated = CreateProductSchema.parse(input);
    const prisma = getPrismaClient();

    // 1. Verify Unit existence
    const unit = await prisma.unit.findUnique({ where: { id: validated.unitId } });
    if (!unit) {
      throw new Error(`Unit with ID ${validated.unitId} does not exist`);
    }

    // 2. Verify Category & Brand if provided
    if (validated.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: validated.categoryId } });
      if (!cat) throw new Error(`Category with ID ${validated.categoryId} does not exist`);
    }
    if (validated.brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: validated.brandId } });
      if (!brand) throw new Error(`Brand with ID ${validated.brandId} does not exist`);
    }

    // 3. Check duplicate name warning
    const duplicateCheck = await this.checkDuplicateName(validated.name);
    const duplicateNameWarning = duplicateCheck.hasDuplicate
      ? `A product with the name "${validated.name}" already exists.`
      : undefined;

    try {
      return await executeWriteTransaction(async (tx) => {
        // Auto-generate SKU if omitted, empty, or 'AUTO'
        let finalSku = validated.sku;
        if (!finalSku || finalSku.trim() === '' || finalSku.toUpperCase() === 'AUTO') {
          finalSku = await invoiceSequenceService.getNextInvoiceNumber(tx, 'PRODUCT_SKU');
        }

        // Create product record
        const product = await tx.product.create({
          data: {
            name: validated.name,
            sku: finalSku,
            barcode: validated.barcode || null,
            categoryId: validated.categoryId || null,
            brandId: validated.brandId || null,
            unitId: validated.unitId,
            purchasePrice: validated.purchasePrice,
            salePrice: validated.salePrice,
            taxRate: validated.taxRate,
            openingStock: validated.openingStock,
            reorderLevel: validated.reorderLevel,
            currentStock: validated.openingStock, // Initial cached stock
            status: 'ACTIVE',
            imageUrl: validated.imageUrl || null,
          },
          include: {
            category: true,
            brand: true,
            unit: true,
          },
        });

        // If opening stock > 0, record OPENING ledger entry atomically
        if (validated.openingStock > 0) {
          await tx.stockLedger.create({
            data: {
              productId: product.id,
              transactionType: 'OPENING',
              referenceId: product.id,
              quantityChange: validated.openingStock,
              balanceAfter: validated.openingStock,
              notes: 'Initial opening stock during product creation',
            },
          });
        }

        await auditService.log(
          {
            userId,
            action: 'PRODUCT_CREATE',
            entityType: 'Product',
            entityId: product.id,
            newValue: {
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              purchasePrice: validated.purchasePrice,
              salePrice: validated.salePrice,
              openingStock: validated.openingStock,
            },
          },
          tx
        );

        const dto: ProductDTO = {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          categoryId: product.categoryId,
          categoryName: product.category?.name || null,
          brandId: product.brandId,
          brandName: product.brand?.name || null,
          unitId: product.unitId,
          unitCode: product.unit?.shortCode,
          allowDecimal: product.unit?.allowDecimal ?? false,
          purchasePrice: Number(product.purchasePrice),
          salePrice: Number(product.salePrice),
          taxRate: Number(product.taxRate),
          openingStock: Number(product.openingStock),
          reorderLevel: Number(product.reorderLevel),
          currentStock: Number(product.currentStock),
          status: product.status as any,
          imageUrl: product.imageUrl ?? null,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
        };

        return { product: dto, duplicateNameWarning };
      });
    } catch (err: any) {
      // Catch SQLite unique constraint violation (P2002)
      if (err?.code === 'P2002') {
        const target = (err?.meta?.target as string[]) || [];
        if (target.includes('sku') || err?.message?.includes('sku')) {
          throw new Error(`A product with SKU "${validated.sku}" already exists. SKU must be unique.`);
        }
        if (target.includes('barcode') || err?.message?.includes('barcode')) {
          throw new Error(`A product with Barcode "${validated.barcode}" already exists. Barcode must be unique.`);
        }
      }
      throw err;
    }
  }

  /**
   * Updates product master data.
   * Explicitly disallows direct editing of currentStock (stock only changes via ledger).
   */
  async updateProduct(
    id: string,
    input: z.input<typeof UpdateProductSchema>,
    userId?: string
  ): Promise<ProductDTO> {
    const validated = UpdateProductSchema.parse(input);
    const prisma = getPrismaClient();

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Product with ID ${id} not found`);
    }

    // Verify relations if modified
    if (validated.unitId) {
      const unit = await prisma.unit.findUnique({ where: { id: validated.unitId } });
      if (!unit) throw new Error(`Unit with ID ${validated.unitId} does not exist`);
    }
    if (validated.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: validated.categoryId } });
      if (!cat) throw new Error(`Category with ID ${validated.categoryId} does not exist`);
    }
    if (validated.brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: validated.brandId } });
      if (!brand) throw new Error(`Brand with ID ${validated.brandId} does not exist`);
    }

    try {
      return await executeWriteTransaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data: {
            ...(validated.name ? { name: validated.name } : {}),
            ...(validated.sku ? { sku: validated.sku } : {}),
            ...(validated.barcode !== undefined ? { barcode: validated.barcode || null } : {}),
            ...(validated.categoryId !== undefined ? { categoryId: validated.categoryId } : {}),
            ...(validated.brandId !== undefined ? { brandId: validated.brandId } : {}),
            ...(validated.unitId ? { unitId: validated.unitId } : {}),
            ...(validated.purchasePrice !== undefined ? { purchasePrice: validated.purchasePrice } : {}),
            ...(validated.salePrice !== undefined ? { salePrice: validated.salePrice } : {}),
            ...(validated.taxRate !== undefined ? { taxRate: validated.taxRate } : {}),
            ...(validated.reorderLevel !== undefined ? { reorderLevel: validated.reorderLevel } : {}),
            ...(validated.status ? { status: validated.status } : {}),
            ...(validated.imageUrl !== undefined ? { imageUrl: validated.imageUrl || null } : {}),
          },
          include: {
            category: true,
            brand: true,
            unit: true,
          },
        });

        await auditService.log(
          {
            userId,
            action: 'PRODUCT_UPDATE',
            entityType: 'Product',
            entityId: id,
            oldValue: {
              name: existing.name,
              sku: existing.sku,
              purchasePrice: Number(existing.purchasePrice),
              salePrice: Number(existing.salePrice),
              status: existing.status,
            },
            newValue: {
              name: updated.name,
              sku: updated.sku,
              purchasePrice: Number(updated.purchasePrice),
              salePrice: Number(updated.salePrice),
              status: updated.status,
            },
          },
          tx
        );

        return {
          id: updated.id,
          name: updated.name,
          sku: updated.sku,
          barcode: updated.barcode,
          categoryId: updated.categoryId,
          categoryName: updated.category?.name || null,
          brandId: updated.brandId,
          brandName: updated.brand?.name || null,
          unitId: updated.unitId,
          unitCode: updated.unit?.shortCode,
          allowDecimal: updated.unit?.allowDecimal ?? false,
          purchasePrice: Number(updated.purchasePrice),
          salePrice: Number(updated.salePrice),
          taxRate: Number(updated.taxRate),
          openingStock: Number(updated.openingStock),
          reorderLevel: Number(updated.reorderLevel),
          currentStock: Number(updated.currentStock),
          status: updated.status as any,
          imageUrl: updated.imageUrl ?? null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = (err?.meta?.target as string[]) || [];
        if (target.includes('sku') || err?.message?.includes('sku')) {
          throw new Error(`A product with SKU "${validated.sku}" already exists. SKU must be unique.`);
        }
        if (target.includes('barcode') || err?.message?.includes('barcode')) {
          throw new Error(`A product with Barcode "${validated.barcode}" already exists. Barcode must be unique.`);
        }
      }
      throw err;
    }
  }

  /**
   * Deletes a product or soft-deactivates it if transaction history exists.
   * Guarantees that historical financial and stock movement records are never corrupted.
   */
  async deleteOrDeactivateProduct(
    id: string,
    userId?: string
  ): Promise<{ action: 'DELETED' | 'DEACTIVATED'; message: string }> {
    const prisma = getPrismaClient();

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new Error(`Product with ID ${id} not found`);
    }

    // Check transaction history in stock_ledger, sales, and purchases
    const [ledgerCount, saleCount, purchaseCount] = await Promise.all([
      prisma.stockLedger.count({ where: { productId: id } }),
      prisma.saleItem.count({ where: { productId: id } }),
      prisma.purchaseItem.count({ where: { productId: id } }),
    ]);

    const hasHistory = ledgerCount > 0 || saleCount > 0 || purchaseCount > 0;

    if (hasHistory) {
      // Enforce PRD Rule: Cannot delete products with transaction history -> Soft Deactivate
      await prisma.product.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });

      await auditService.log({
        userId,
        action: 'PRODUCT_DEACTIVATE',
        entityType: 'Product',
        entityId: id,
        reason: `Product has transaction history (${ledgerCount} stock movements, ${saleCount} sales, ${purchaseCount} purchases). Soft deactivated instead of deleted.`,
      });

      return {
        action: 'DEACTIVATED',
        message: `Product "${product.name}" has historical transaction records and cannot be permanently deleted. It has been deactivated instead.`,
      };
    } else {
      // Zero history -> safe to hard delete
      await prisma.product.delete({ where: { id } });

      await auditService.log({
        userId,
        action: 'PRODUCT_DELETE',
        entityType: 'Product',
        entityId: id,
        oldValue: { name: product.name, sku: product.sku },
      });

      return {
        action: 'DELETED',
        message: `Product "${product.name}" had no transaction history and was permanently deleted.`,
      };
    }
  }
}

export const productService = new ProductService();
