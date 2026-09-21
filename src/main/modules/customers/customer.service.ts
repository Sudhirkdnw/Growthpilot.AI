import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import { CreateCustomerSchema, UpdateCustomerSchema, CustomerQuerySchema } from '../../../shared/schemas';
import { CustomerDTO, CustomerReceivablesSummaryDTO, PaginatedResult } from '../../../shared/types';

export class CustomerService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Creates a new customer account. If an opening balance is specified,
   * automatically creates the authoritative OPENING_BALANCE ledger entry.
   */
  async createCustomer(
    input: z.input<typeof CreateCustomerSchema>,
    userId?: string
  ): Promise<CustomerDTO> {
    const validated = CreateCustomerSchema.parse(input);
    const openingBalance = Number(validated.openingBalance || 0);

    // Check unique phone if provided
    if (validated.phone && validated.phone.trim()) {
      const existing = await this.prisma.customer.findUnique({
        where: { phone: validated.phone.trim() },
      });
      if (existing) {
        throw new Error(`A customer with phone number "${validated.phone.trim()}" already exists.`);
      }
    }

    return await executeWriteTransaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: validated.name.trim(),
          phone: validated.phone?.trim() || null,
          email: validated.email?.trim() || null,
          address: validated.address?.trim() || null,
          openingBalance,
          currentBalance: openingBalance,
          status: 'ACTIVE',
        },
      });

      // If opening balance > 0, record debit ledger entry (customer owes store)
      if (openingBalance > 0) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: 'OPENING_BALANCE',
            referenceId: customer.id,
            debit: openingBalance,
            credit: 0,
            balance: openingBalance,
            notes: 'Opening Balance Initialization',
          },
        });
      }

      await auditService.log(
        {
          userId,
          action: 'CUSTOMER_CREATED',
          entityType: 'Customer',
          entityId: customer.id,
          newValue: {
            name: customer.name,
            phone: customer.phone,
            openingBalance,
          },
          reason: `Created customer ${customer.name}`,
        },
        tx
      );

      return this.mapToDTO(customer);
    });
  }

  /**
   * Updates customer profile details (name, phone, email, address, status).
   */
  async updateCustomer(
    id: string,
    input: z.input<typeof UpdateCustomerSchema>,
    userId?: string
  ): Promise<CustomerDTO> {
    const validated = UpdateCustomerSchema.parse(input);

    const existing = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Customer with ID ${id} not found.`);
    }

    // Check unique phone if modified
    if (validated.phone && validated.phone.trim() && validated.phone.trim() !== existing.phone) {
      const phoneConflict = await this.prisma.customer.findUnique({
        where: { phone: validated.phone.trim() },
      });
      if (phoneConflict && phoneConflict.id !== id) {
        throw new Error(`A customer with phone number "${validated.phone.trim()}" already exists.`);
      }
    }

    return await executeWriteTransaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name: validated.name !== undefined ? validated.name.trim() : undefined,
          phone: validated.phone !== undefined ? (validated.phone?.trim() || null) : undefined,
          email: validated.email !== undefined ? (validated.email?.trim() || null) : undefined,
          address: validated.address !== undefined ? (validated.address?.trim() || null) : undefined,
          status: validated.status !== undefined ? validated.status : undefined,
        },
      });

      await auditService.log(
        {
          userId,
          action: 'CUSTOMER_UPDATED',
          entityType: 'Customer',
          entityId: id,
          oldValue: {
            name: existing.name,
            phone: existing.phone,
            status: existing.status,
          },
          newValue: {
            name: updated.name,
            phone: updated.phone,
            status: updated.status,
          },
          reason: `Updated customer details for ${updated.name}`,
        },
        tx
      );

      return this.mapToDTO(updated);
    });
  }

  /**
   * Deactivates a customer.
   */
  async deactivateCustomer(id: string, userId?: string): Promise<CustomerDTO> {
    return this.updateCustomer(id, { status: 'INACTIVE' }, userId);
  }

  /**
   * Safely deletes a customer only if they have NO financial history (sales, payments, ledger).
   * Otherwise strictly rejects deletion to protect audit integrity.
   */
  async deleteCustomer(id: string, userId?: string): Promise<{ success: boolean; message: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!customer) {
      throw new Error(`Customer with ID ${id} not found.`);
    }

    return await executeWriteTransaction(async (tx) => {
      const [salesCount, paymentsCount, ledgerCount, salesReturnsCount] = await Promise.all([
        tx.sale.count({ where: { customerId: id } }),
        tx.customerPayment.count({ where: { customerId: id } }),
        tx.customerLedger.count({ where: { customerId: id } }),
        tx.salesReturn.count({ where: { sale: { customerId: id } } }),
      ]);

      if (salesCount > 0 || paymentsCount > 0 || ledgerCount > 0 || salesReturnsCount > 0) {
        throw new Error(
          `CUSTOMER_HAS_FINANCIAL_HISTORY: Cannot delete customer "${customer.name}" because they have existing financial history (${salesCount} sales, ${paymentsCount} payments, ${ledgerCount} ledger entries, ${salesReturnsCount} sales returns). Please deactivate instead.`
        );
      }

      await tx.customer.delete({ where: { id } });

      await auditService.log(
        {
          userId,
          action: 'CUSTOMER_DELETED',
          entityType: 'Customer',
          entityId: id,
          oldValue: { name: customer.name },
          reason: `Deleted customer ${customer.name} (no financial history existed)`,
        },
        tx
      );

      return {
        success: true,
        message: `Customer "${customer.name}" deleted successfully.`,
      };
    });
  }

  /**
   * Retrieves customer by ID.
   */
  async getCustomerById(id: string): Promise<CustomerDTO> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new Error(`Customer with ID ${id} not found.`);
    }

    return this.mapToDTO(customer);
  }

  /**
   * Lists customers with search (name, phone, email) and pagination.
   */
  async listCustomers(
    params: z.input<typeof CustomerQuerySchema>
  ): Promise<PaginatedResult<CustomerDTO>> {
    const validated = CustomerQuerySchema.parse(params);
    const where: any = {};

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.hasOutstanding === true) {
      where.currentBalance = { gt: 0 };
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const skip = (validated.page - 1) * validated.pageSize;

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers.map(this.mapToDTO),
      total,
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: Math.ceil(total / validated.pageSize),
    };
  }

  /**
   * Calculates aggregated accounts receivable overview metrics.
   */
  async getReceivablesSummary(): Promise<CustomerReceivablesSummaryDTO> {
    const customers = await this.prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        phone: true,
        currentBalance: true,
      },
    });

    let totalReceivables = 0;
    let customersWithOutstanding = 0;
    let fullyPaidCustomers = 0;
    const topDebtors: Array<{ id: string; name: string; phone?: string | null; outstanding: number }> = [];

    for (const c of customers) {
      const bal = Number(c.currentBalance);
      if (bal > 0) {
        totalReceivables += bal;
        customersWithOutstanding++;
        topDebtors.push({
          id: c.id,
          name: c.name,
          phone: c.phone,
          outstanding: bal,
        });
      } else {
        fullyPaidCustomers++;
      }
    }

    totalReceivables = Math.round(totalReceivables * 100) / 100;
    topDebtors.sort((a, b) => b.outstanding - a.outstanding);

    return {
      totalReceivables,
      totalCustomers: customers.length,
      customersWithOutstanding,
      fullyPaidCustomers,
      topDebtors: topDebtors.slice(0, 10),
    };
  }

  /**
   * Returns a virtual Cash Customer descriptor for walk-in transactions.
   */
  getDefaultCashCustomer(): CustomerDTO {
    return {
      id: 'cash-customer',
      name: 'Cash Customer',
      phone: null,
      email: null,
      address: null,
      openingBalance: 0,
      currentBalance: 0,
      status: 'ACTIVE',
      createdAt: new Date(0).toISOString(),
    };
  }

  private mapToDTO(c: any): CustomerDTO {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      openingBalance: Number(c.openingBalance),
      currentBalance: Number(c.currentBalance),
      status: c.status as any,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    };
  }
}

export const customerService = new CustomerService();

