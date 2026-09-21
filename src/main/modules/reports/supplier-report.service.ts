import { getPrismaClient } from '../../database/client';
import { SupplierOutstandingReportDTO, SupplierLedgerDTO, PaginatedResult } from '../../../shared/types';

function n(v: any): number {
  return Math.round(Number(v || 0) * 100) / 100;
}

/**
 * Supplier Report Service — Phase 11
 *
 * Outstanding uses Supplier.currentBalance (authoritative Phase 6 cache).
 * Ledger reads directly from SupplierLedger.
 * Phase 6 debit/credit convention: Credit = increases payable, Debit = decreases payable.
 */
export class SupplierReportService {
  private get prisma() {
    return getPrismaClient();
  }

  async getSupplierOutstandingReport(query: {
    search?: string;
    status?: string;
    sortBy?: string;
    page?: number;
    pageSize?: number;
  }): Promise<SupplierOutstandingReportDTO> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const where: any = { currentBalance: { gt: 0 } };
    if (query.status && query.status !== 'ALL') where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
        { gstin: { contains: query.search } },
      ];
    }

    const [suppliers, total, totalsAgg] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: {
          purchases: {
            orderBy: { purchaseDate: 'desc' },
            take: 1,
            select: { purchaseDate: true },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
            take: 1,
            select: { paymentDate: true },
          },
        },
        orderBy:
          query.sortBy === 'name'
            ? { name: 'asc' }
            : { currentBalance: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.aggregate({
        where: { currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
    ]);

    return {
      totalPayables: n(totalsAgg._sum.currentBalance),
      suppliersWithOutstanding: total,
      data: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        gstin: s.gstin,
        outstanding: n(s.currentBalance),
        lastPurchaseDate: s.purchases[0]?.purchaseDate?.toISOString() || null,
        lastPaymentDate: s.payments[0]?.paymentDate?.toISOString() || null,
        status: s.status,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSupplierLedgerReport(
    supplierId: string,
    query: {
      type?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<SupplierLedgerDTO>> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const where: any = { supplierId };
    if (query.type) where.type = query.type;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        const sd = new Date(query.startDate);
        sd.setHours(0, 0, 0, 0);
        where.createdAt.gte = sd;
      }
      if (query.endDate) {
        const ed = new Date(query.endDate);
        ed.setHours(23, 59, 59, 999);
        where.createdAt.lte = ed;
      }
    }

    const [entries, total] = await Promise.all([
      this.prisma.supplierLedger.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.supplierLedger.count({ where }),
    ]);

    return {
      data: entries.map((e) => ({
        id: e.id,
        supplierId: e.supplierId,
        type: e.type,
        referenceId: e.referenceId,
        debit: n(e.debit),
        credit: n(e.credit),
        balance: n(e.balance),
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const supplierReportService = new SupplierReportService();
