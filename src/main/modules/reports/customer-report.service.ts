import { getPrismaClient } from '../../database/client';
import { CustomerOutstandingReportDTO, CustomerLedgerDTO, PaginatedResult } from '../../../shared/types';

function n(v: any): number {
  return Math.round(Number(v || 0) * 100) / 100;
}

/**
 * Customer Report Service — Phase 11
 *
 * Outstanding uses Customer.currentBalance (authoritative Phase 9 cache).
 * Ledger reads directly from CustomerLedger.
 * Phase 9 debit/credit convention preserved: Debit = increases receivable, Credit = decreases.
 */
export class CustomerReportService {
  private get prisma() {
    return getPrismaClient();
  }

  async getCustomerOutstandingReport(query: {
    search?: string;
    status?: string;
    sortBy?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CustomerOutstandingReportDTO> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const where: any = { currentBalance: { gt: 0 } }; // Only those with outstanding
    if (query.status && query.status !== 'ALL') where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }

    const [customers, total, totalsAgg] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          ledger: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
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
      this.prisma.customer.count({ where }),
      this.prisma.customer.aggregate({
        where: { currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
    ]);

    return {
      totalReceivables: n(totalsAgg._sum.currentBalance),
      customersWithOutstanding: total,
      data: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        outstanding: n(c.currentBalance),
        lastTransactionDate: c.ledger[0]?.createdAt?.toISOString() || null,
        lastPaymentDate: c.payments[0]?.paymentDate?.toISOString() || null,
        status: c.status,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getCustomerLedgerReport(
    customerId: string,
    query: {
      type?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<CustomerLedgerDTO>> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 50));
    const skip = (page - 1) * pageSize;

    const where: any = { customerId };
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
      this.prisma.customerLedger.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.customerLedger.count({ where }),
    ]);

    return {
      data: entries.map((e) => ({
        id: e.id,
        customerId: e.customerId,
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

export const customerReportService = new CustomerReportService();
