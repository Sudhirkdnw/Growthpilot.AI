import { getPrismaClient } from '../../database/client';
import { reportService } from './report.service';
import {
  InventoryCurrentStockDTO,
  LowStockProductDTO,
  StockMovementReportDTO,
} from '../../../shared/types';

function n(v: any): number {
  return Math.round(Number(v || 0) * 100) / 100;
}

/**
 * Inventory Report Service — Phase 11
 *
 * Stock value = currentStock × purchasePrice (current-price valuation, per spec).
 * Stock movement reads directly from the authoritative StockLedger.
 * No stock mutations from reporting.
 */
export class InventoryReportService {
  private get prisma() {
    return getPrismaClient();
  }

  async getCurrentStockReport(query: {
    search?: string;
    categoryId?: string;
    stockStatus?: string;
    page?: number;
    pageSize?: number;
  }): Promise<InventoryCurrentStockDTO> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { sku: { contains: query.search } },
        { barcode: { contains: query.search } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;

    // Apply stockStatus filter after fetching (computed field)
    const allProducts = await this.prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        unit: { select: { shortCode: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Compute stock status for each product
    const withStatus = allProducts.map((p) => {
      const stock = Number(p.currentStock);
      const reorder = Number(p.reorderLevel);
      const price = Number(p.purchasePrice);
      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
      if (stock <= 0) stockStatus = 'OUT_OF_STOCK';
      else if (stock <= reorder) stockStatus = 'LOW_STOCK';
      else stockStatus = 'IN_STOCK';
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryName: p.category?.name || null,
        brandName: p.brand?.name || null,
        unitCode: p.unit.shortCode,
        purchasePrice: n(p.purchasePrice),
        salePrice: n(p.salePrice),
        currentStock: Math.round(stock * 1000) / 1000,
        reorderLevel: Math.round(reorder * 1000) / 1000,
        stockValue: Math.round(stock * price * 100) / 100,
        stockStatus,
        status: p.status,
      };
    });

    // Filter by stockStatus if specified
    const filtered =
      !query.stockStatus || query.stockStatus === 'ALL'
        ? withStatus
        : withStatus.filter((p) => p.stockStatus === query.stockStatus);

    // Compute totals from ALL products (not just paginated)
    let totalStockValue = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const p of filtered) {
      totalStockValue = Math.round((totalStockValue + p.stockValue) * 100) / 100;
      if (p.stockStatus === 'IN_STOCK') inStockCount++;
      else if (p.stockStatus === 'LOW_STOCK') lowStockCount++;
      else outOfStockCount++;
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + pageSize);

    return {
      data: paginated,
      totalStockValue,
      totalProducts: total,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getLowStockReport(): Promise<LowStockProductDTO[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        // SQLite: currentStock <= reorderLevel
        // We fetch all active and filter in memory for correctness with Decimal comparisons
      },
      include: {
        category: { select: { name: true } },
        unit: { select: { shortCode: true } },
      },
      orderBy: { name: 'asc' },
    });

    return products
      .filter((p) => Number(p.currentStock) <= Number(p.reorderLevel))
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryName: p.category?.name || null,
        currentStock: Math.round(Number(p.currentStock) * 1000) / 1000,
        reorderLevel: Math.round(Number(p.reorderLevel) * 1000) / 1000,
        unitCode: p.unit.shortCode,
        difference: Math.round((Number(p.reorderLevel) - Number(p.currentStock)) * 1000) / 1000,
        purchasePrice: n(p.purchasePrice),
        stockStatus: Number(p.currentStock) <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      }));
  }

  async getStockMovementReport(query: {
    period?: string;
    startDate?: string;
    endDate?: string;
    productId?: string;
    transactionType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<StockMovementReportDTO> {
    const { startDate, endDate } = reportService.resolveDateRange({
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const where: any = {
      createdAt: { gte: startDate, lte: endDate },
    };
    if (query.productId) where.productId = query.productId;
    if (query.transactionType && query.transactionType !== 'ALL') {
      where.transactionType = query.transactionType;
    }

    const [movements, total, inAgg, outAgg] = await Promise.all([
      this.prisma.stockLedger.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.stockLedger.count({ where }),
      this.prisma.stockLedger.aggregate({
        where: { ...where, quantityChange: { gt: 0 } },
        _sum: { quantityChange: true },
      }),
      this.prisma.stockLedger.aggregate({
        where: { ...where, quantityChange: { lt: 0 } },
        _sum: { quantityChange: true },
      }),
    ]);

    const totalIn = Math.round(Number(inAgg._sum.quantityChange || 0) * 1000) / 1000;
    const totalOut = Math.abs(Math.round(Number(outAgg._sum.quantityChange || 0) * 1000) / 1000);

    return {
      data: movements.map((m) => {
        const change = Number(m.quantityChange);
        return {
          id: m.id,
          date: m.createdAt.toISOString(),
          productId: m.productId,
          productName: m.product.name,
          sku: m.product.sku,
          transactionType: m.transactionType,
          quantityIn: change > 0 ? Math.round(change * 1000) / 1000 : 0,
          quantityOut: change < 0 ? Math.round(Math.abs(change) * 1000) / 1000 : 0,
          balanceAfter: Math.round(Number(m.balanceAfter) * 1000) / 1000,
          referenceId: m.referenceId,
          notes: m.notes,
        };
      }),
      totalIn,
      totalOut,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStockLedgerForProduct(
    productId: string,
    query: { page?: number; pageSize?: number }
  ): Promise<StockMovementReportDTO> {
    return this.getStockMovementReport({ productId, page: query.page, pageSize: query.pageSize });
  }
}

export const inventoryReportService = new InventoryReportService();
