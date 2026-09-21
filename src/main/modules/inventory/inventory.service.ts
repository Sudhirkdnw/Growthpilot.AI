import { PrismaClient } from '@prisma/client';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import { settingsService } from '../settings/settings.service';
import { StockAdjustmentSchema, StockLedgerQuerySchema } from '../../../shared/schemas';
import {
  StockLedgerDTO,
  StockAdjustmentDTO,
  StockSummaryDTO,
  LowStockProductDTO,
  StockReconciliationDTO,
  PaginatedResult,
} from '../../../shared/types';
import { z } from 'zod';

export class InventoryService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  /**
   * Authoritative stock movement recorder.
   * Updates cached product.currentStock and creates an immutable StockLedger entry atomically.
   */
  async recordStockMovement(
    tx: any,
    params: {
      productId: string;
      transactionType: 'OPENING' | 'PURCHASE' | 'SALE' | 'RETURN_IN' | 'RETURN_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
      referenceId: string;
      quantityChange: number;
      notes?: string | null;
    }
  ) {
    const product = await tx.product.findUnique({
      where: { id: params.productId },
      select: { id: true, currentStock: true, name: true, sku: true },
    });

    if (!product) {
      throw new Error(`Product with ID ${params.productId} not found`);
    }

    const currentStockNum = Number(product.currentStock);
    const newBalance = currentStockNum + params.quantityChange;

    // Update cached product stock
    await tx.product.update({
      where: { id: params.productId },
      data: { currentStock: newBalance },
    });

    // Create immutable stock ledger entry
    const ledgerEntry = await tx.stockLedger.create({
      data: {
        productId: params.productId,
        transactionType: params.transactionType,
        referenceId: params.referenceId,
        quantityChange: params.quantityChange,
        balanceAfter: newBalance,
        notes: params.notes || null,
      },
    });

    return { product, previousBalance: currentStockNum, newBalance, ledgerEntry };
  }

  /**
   * Creates an atomic stock adjustment with full audit logging and negative-stock policy validation.
   */
  async createStockAdjustment(
    input: z.input<typeof StockAdjustmentSchema>,
    userId?: string
  ): Promise<StockAdjustmentDTO> {
    const validated = StockAdjustmentSchema.parse(input);
    const prisma = this.prisma;

    // 1. Validate Product
    const product = await prisma.product.findUnique({
      where: { id: validated.productId },
      select: { id: true, name: true, sku: true, currentStock: true, status: true },
    });

    if (!product) {
      throw new Error(`Product with ID ${validated.productId} does not exist.`);
    }

    const currentStock = Number(product.currentStock);
    const delta = validated.type === 'ADJUSTMENT_IN' ? validated.quantity : -validated.quantity;
    const resultingStock = currentStock + delta;

    // 2. Enforce Negative Stock Policy for reductions
    if (resultingStock < 0) {
      const settings = await settingsService.getAppSettings();
      const policy = settings.pos?.negativeStockPolicy || 'BLOCK';

      if (policy === 'BLOCK') {
        throw new Error(
          `Negative Stock Policy Violation: Adjustment would result in negative stock (${resultingStock} units) for product "${product.name}". Store policy blocks negative stock.`
        );
      } else if (policy === 'ALLOW_WITH_WARNING' && !validated.allowNegativeStockOverride) {
        throw new Error(
          `Negative Stock Warning: Adjustment will reduce stock for "${product.name}" below zero to ${resultingStock} units. Please confirm override to proceed.`
        );
      }
    }

    // 3. Atomic Database Transaction
    return await executeWriteTransaction(async (tx) => {
      // Create StockAdjustment record
      const adjustment = await tx.stockAdjustment.create({
        data: {
          productId: validated.productId,
          type: validated.type,
          quantity: validated.quantity,
          reason: validated.reason,
        },
      });

      // Format notes combining reason and optional remarks
      const formattedNotes = validated.notes
        ? `Manual Adjustment: ${validated.reason} — ${validated.notes}`
        : `Manual Adjustment: ${validated.reason}`;

      // Record movement in authoritative stock ledger & update current stock
      await this.recordStockMovement(tx, {
        productId: validated.productId,
        transactionType: validated.type,
        referenceId: adjustment.id,
        quantityChange: delta,
        notes: formattedNotes,
      });

      // Immutable audit log
      await auditService.log(
        {
          userId,
          action: 'STOCK_ADJUSTMENT',
          entityType: 'Product',
          entityId: product.id,
          oldValue: { currentStock },
          newValue: {
            currentStock: resultingStock,
            type: validated.type,
            quantity: validated.quantity,
            reason: validated.reason,
          },
          reason: validated.reason,
        },
        tx
      );

      return {
        id: adjustment.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: validated.type,
        quantity: validated.quantity,
        reason: validated.reason,
        previousBalance: currentStock,
        newBalance: resultingStock,
        createdAt: adjustment.createdAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves paginated, filtered stock ledger records.
   * Pure audit trail query — completely immutable.
   */
  async getStockLedger(
    params: z.infer<typeof StockLedgerQuerySchema>
  ): Promise<PaginatedResult<StockLedgerDTO>> {
    const validated = StockLedgerQuerySchema.parse(params);
    const prisma = this.prisma;

    const where: any = {};

    if (validated.productId) {
      where.productId = validated.productId;
    }

    if (validated.transactionType && validated.transactionType !== 'ALL') {
      where.transactionType = validated.transactionType;
    }

    if (validated.startDate || validated.endDate) {
      where.createdAt = {};
      if (validated.startDate) {
        where.createdAt.gte = new Date(validated.startDate);
      }
      if (validated.endDate) {
        where.createdAt.lte = new Date(validated.endDate);
      }
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { product: { name: { contains: q } } },
        { product: { sku: { contains: q } } },
        { referenceId: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const skip = (validated.page - 1) * validated.pageSize;

    const [entries, total] = await Promise.all([
      prisma.stockLedger.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      }),
      prisma.stockLedger.count({ where }),
    ]);

    const data: StockLedgerDTO[] = entries.map((e) => ({
      id: e.id,
      productId: e.productId,
      productName: e.product?.name || 'Unknown Product',
      sku: e.product?.sku || 'UNKNOWN',
      transactionType: e.transactionType as any,
      referenceId: e.referenceId,
      quantityChange: Number(e.quantityChange),
      balanceAfter: Number(e.balanceAfter),
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
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
   * Aggregates comprehensive stock metrics and estimated valuation.
   */
  async getInventorySummary(): Promise<StockSummaryDTO> {
    const prisma = this.prisma;

    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: {
        currentStock: true,
        reorderLevel: true,
        purchasePrice: true,
      },
    });

    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const stock = Number(p.currentStock);
      const reorder = Number(p.reorderLevel);
      const cost = Number(p.purchasePrice);

      if (stock > 0) {
        totalStockValue += stock * cost;
      }

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= reorder) {
        lowStockCount++;
      }
    }

    return {
      totalProducts: products.length,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      lowStockCount,
      outOfStockCount,
    };
  }

  /**
   * Retrieves products that are at or below their configured reorder level.
   */
  async getLowStockProducts(page = 1, pageSize = 50): Promise<PaginatedResult<LowStockProductDTO>> {
    const prisma = this.prisma;

    const allActive = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: {
        category: { select: { name: true } },
        unit: { select: { shortCode: true } },
      },
      orderBy: { currentStock: 'asc' },
    });

    // Filter in memory where currentStock <= reorderLevel
    const depleted = allActive.filter(
      (p) => Number(p.currentStock) <= Number(p.reorderLevel)
    );

    const total = depleted.length;
    const skip = (page - 1) * pageSize;
    const paginated = depleted.slice(skip, skip + pageSize);

    const data: LowStockProductDTO[] = paginated.map((p) => {
      const stock = Number(p.currentStock);
      const reorder = Number(p.reorderLevel);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryName: p.category?.name || null,
        currentStock: stock,
        reorderLevel: reorder,
        unitCode: p.unit?.shortCode || 'PCS',
        difference: Math.max(0, reorder - stock),
        purchasePrice: Number(p.purchasePrice),
        stockStatus: stock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Reconciles cached current_stock against all historical stock_ledger entries for a single product.
   * Invariant: product.currentStock == sum(stock_ledger.quantityChange)
   */
  async reconcileProductStock(
    productId: string,
    autoFix = false,
    userId?: string
  ): Promise<StockReconciliationDTO> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, sku: true, currentStock: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const ledgerEntries = await this.prisma.stockLedger.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    const calculatedBalance = ledgerEntries.reduce(
      (sum, entry) => sum + Number(entry.quantityChange),
      0
    );

    const cachedBalance = Number(product.currentStock);
    const discrepancy = Math.abs(calculatedBalance - cachedBalance);
    const isBalanced = discrepancy < 0.0001;

    if (!isBalanced && autoFix) {
      await executeWriteTransaction(async (tx) => {
        await tx.product.update({
          where: { id: productId },
          data: { currentStock: calculatedBalance },
        });

        await auditService.log(
          {
            userId,
            action: 'AUTO_RECONCILE_STOCK',
            entityType: 'STOCK_RECONCILIATION',
            entityId: productId,
            oldValue: { currentStock: cachedBalance },
            newValue: { currentStock: calculatedBalance },
            reason: `Reconciliation auto-fix: repaired cached stock from ${cachedBalance} to match authoritative ledger sum ${calculatedBalance}`,
          },
          tx
        );
      });

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        cachedBalance: calculatedBalance,
        calculatedBalance,
        isBalanced: true,
        discrepancy: 0,
        totalMovements: ledgerEntries.length,
      };
    }

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      cachedBalance,
      calculatedBalance,
      isBalanced,
      discrepancy,
      totalMovements: ledgerEntries.length,
    };
  }

  /**
   * Diagnostic reconciliation scanner across all products.
   * Detects discrepancies without silently mutating data.
   */
  async reconcileAllProducts(): Promise<{
    results: StockReconciliationDTO[];
    totalChecked: number;
    totalBalanced: number;
    discrepanciesCount: number;
  }> {
    const products = await this.prisma.product.findMany({
      select: { id: true },
      orderBy: { name: 'asc' },
    });

    const results: StockReconciliationDTO[] = [];
    let totalBalanced = 0;
    let discrepanciesCount = 0;

    for (const p of products) {
      const rec = await this.reconcileProductStock(p.id);
      results.push(rec);
      if (rec.isBalanced) {
        totalBalanced++;
      } else {
        discrepanciesCount++;
      }
    }

    return {
      results,
      totalChecked: products.length,
      totalBalanced,
      discrepanciesCount,
    };
  }
}

export const inventoryService = new InventoryService();
