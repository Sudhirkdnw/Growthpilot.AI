import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  SupplierQuerySchema,
} from '../../../shared/schemas';
import { SupplierDTO, PaginatedResult } from '../../../shared/types';

export class SupplierService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Creates a new supplier. If an opening balance is configured,
   * automatically creates the authoritative OPENING_BALANCE supplier ledger entry.
   */
  async createSupplier(
    input: z.input<typeof CreateSupplierSchema>,
    userId?: string
  ): Promise<SupplierDTO> {
    const validated = CreateSupplierSchema.parse(input);
    const openingBalance = Number(validated.openingBalance || 0);

    return await executeWriteTransaction(async (tx) => {
      // Create supplier entity
      const supplier = await tx.supplier.create({
        data: {
          name: validated.name.trim(),
          phone: validated.phone?.trim() || null,
          email: validated.email?.trim() || null,
          address: validated.address?.trim() || null,
          gstin: validated.gstin?.trim() || null,
          openingBalance,
          currentBalance: openingBalance,
          status: 'ACTIVE',
        },
      });

      // If opening balance > 0, record initial credit ledger entry
      if (openingBalance > 0) {
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            type: 'OPENING_BALANCE',
            referenceId: supplier.id,
            debit: 0,
            credit: openingBalance,
            balance: openingBalance,
            notes: 'Opening Balance Initialization',
          },
        });
      }

      // Audit log
      await auditService.log(
        {
          userId,
          action: 'SUPPLIER_CREATED',
          entityType: 'Supplier',
          entityId: supplier.id,
          newValue: {
            name: supplier.name,
            phone: supplier.phone,
            gstin: supplier.gstin,
            openingBalance,
          },
          reason: `Created supplier ${supplier.name}`,
        },
        tx
      );

      return this.mapToDTO(supplier);
    });
  }

  /**
   * Updates an existing supplier's details.
   */
  async updateSupplier(
    id: string,
    input: z.input<typeof UpdateSupplierSchema>,
    userId?: string
  ): Promise<SupplierDTO> {
    const validated = UpdateSupplierSchema.parse(input);
    const existing = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Supplier with ID ${id} not found.`);
    }

    return await executeWriteTransaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name: validated.name !== undefined ? validated.name.trim() : undefined,
          phone: validated.phone !== undefined ? (validated.phone ? validated.phone.trim() : null) : undefined,
          email: validated.email !== undefined ? (validated.email ? validated.email.trim() : null) : undefined,
          address: validated.address !== undefined ? (validated.address ? validated.address.trim() : null) : undefined,
          gstin: validated.gstin !== undefined ? (validated.gstin ? validated.gstin.trim() : null) : undefined,
          status: validated.status || undefined,
        },
      });

      await auditService.log(
        {
          userId,
          action: 'SUPPLIER_UPDATED',
          entityType: 'Supplier',
          entityId: id,
          oldValue: {
            name: existing.name,
            phone: existing.phone,
            gstin: existing.gstin,
            status: existing.status,
          },
          newValue: {
            name: updated.name,
            phone: updated.phone,
            gstin: updated.gstin,
            status: updated.status,
          },
          reason: `Updated supplier profile: ${updated.name}`,
        },
        tx
      );

      return this.mapToDTO(updated);
    });
  }

  /**
   * Retrieves a single supplier by ID.
   */
  async getSupplierById(id: string): Promise<SupplierDTO> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new Error(`Supplier with ID ${id} not found.`);
    }

    return this.mapToDTO(supplier);
  }

  /**
   * Lists suppliers with search, status filtering, and pagination.
   */
  async listSuppliers(
    params: z.input<typeof SupplierQuerySchema>
  ): Promise<PaginatedResult<SupplierDTO>> {
    const validated = SupplierQuerySchema.parse(params);
    const where: any = {};

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { gstin: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const skip = (validated.page - 1) * validated.pageSize;

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers.map(this.mapToDTO),
      total,
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: Math.ceil(total / validated.pageSize),
    };
  }

  /**
   * Deactivates a supplier (status -> INACTIVE).
   */
  async deactivateSupplier(id: string, userId?: string): Promise<SupplierDTO> {
    return this.updateSupplier(id, { status: 'INACTIVE' }, userId);
  }

  /**
   * Safely deletes a supplier only if NO transaction history exists.
   * If any purchases or ledger entries are recorded, hard delete is blocked (PRD Section 18.4).
   */
  async deleteSupplier(id: string, userId?: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            purchases: true,
            ledger: true,
            payments: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error(`Supplier with ID ${id} not found.`);
    }

    const totalTransactions =
      existing._count.purchases + existing._count.ledger + existing._count.payments;

    if (totalTransactions > 0) {
      throw new Error(
        `Cannot delete supplier: ${totalTransactions} transaction(s) exist. Deactivate the supplier instead to maintain historical financial audit integrity.`
      );
    }

    return await executeWriteTransaction(async (tx) => {
      await tx.supplier.delete({
        where: { id },
      });

      await auditService.log(
        {
          userId,
          action: 'SUPPLIER_DELETED',
          entityType: 'Supplier',
          entityId: id,
          oldValue: { name: existing.name },
          reason: `Deleted supplier ${existing.name}`,
        },
        tx
      );

      return { success: true };
    });
  }

  private mapToDTO(s: any): SupplierDTO {
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      gstin: s.gstin,
      openingBalance: Number(s.openingBalance),
      currentBalance: Number(s.currentBalance),
      status: s.status as any,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    };
  }
}

export const supplierService = new SupplierService();
