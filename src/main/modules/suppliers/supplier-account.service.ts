import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import { RecordSupplierPaymentSchema } from '../../../shared/schemas';
import { SupplierLedgerDTO, SupplierPaymentDTO, PaginatedResult } from '../../../shared/types';

export class SupplierAccountService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Retrieves the paginated, chronologically ordered supplier ledger audit trail.
   */
  async getSupplierLedger(
    supplierId: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResult<SupplierLedgerDTO>> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });

    if (!supplier) {
      throw new Error(`Supplier with ID ${supplierId} not found.`);
    }

    const skip = (page - 1) * pageSize;

    const [entries, total] = await Promise.all([
      this.prisma.supplierLedger.findMany({
        where: { supplierId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplierLedger.count({ where: { supplierId } }),
    ]);

    const data: SupplierLedgerDTO[] = entries.map((e) => ({
      id: e.id,
      supplierId: e.supplierId,
      type: e.type,
      referenceId: e.referenceId,
      debit: Number(e.debit),
      credit: Number(e.credit),
      balance: Number(e.balance),
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Records an atomic payment made to a supplier.
   * Debits the supplier ledger, reduces supplier payable balance, and generates an audit record.
   */
  async recordSupplierPayment(
    input: z.input<typeof RecordSupplierPaymentSchema>,
    userId?: string
  ): Promise<{ payment: SupplierPaymentDTO; previousBalance: number; newBalance: number }> {
    const validated = RecordSupplierPaymentSchema.parse(input);

    return await executeWriteTransaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: validated.supplierId },
      });

      if (!supplier) {
        throw new Error(`Supplier with ID ${validated.supplierId} not found.`);
      }

      if (supplier.status === 'INACTIVE') {
        throw new Error(`Cannot record payment to inactive supplier "${supplier.name}".`);
      }

      const currentBalance = Number(supplier.currentBalance);
      const amount = validated.amount;
      const newBalance = Math.round((currentBalance - amount) * 100) / 100;

      // 1. Create SupplierPayment record
      const paymentDate = validated.paymentDate ? new Date(validated.paymentDate) : new Date();
      const payment = await tx.supplierPayment.create({
        data: {
          supplierId: supplier.id,
          amount,
          paymentMethod: validated.paymentMethod,
          reference: validated.reference?.trim() || null,
          notes: validated.notes?.trim() || null,
          paymentDate,
        },
      });

      // 2. Insert into authoritative supplier_ledger (Debit reduces payable)
      await tx.supplierLedger.create({
        data: {
          supplierId: supplier.id,
          type: 'PAYMENT',
          referenceId: payment.id,
          debit: amount,
          credit: 0,
          balance: newBalance,
          notes: validated.notes
            ? `Supplier Payment (${validated.paymentMethod}): ${validated.notes}`
            : `Supplier Payment via ${validated.paymentMethod}${validated.reference ? ` [Ref: ${validated.reference}]` : ''}`,
          createdAt: paymentDate,
        },
      });

      // 3. Update cached currentBalance on supplier
      await tx.supplier.update({
        where: { id: supplier.id },
        data: { currentBalance: newBalance },
      });

      // 4. Record audit log
      await auditService.log(
        {
          userId,
          action: 'SUPPLIER_PAYMENT_RECORDED',
          entityType: 'Supplier',
          entityId: supplier.id,
          oldValue: { currentBalance },
          newValue: {
            currentBalance: newBalance,
            paymentAmount: amount,
            paymentMethod: validated.paymentMethod,
            paymentId: payment.id,
          },
          reason: `Recorded payment of ₹${amount.toFixed(2)} to ${supplier.name}`,
        },
        tx
      );

      const paymentDTO: SupplierPaymentDTO = {
        id: payment.id,
        supplierId: payment.supplierId,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod as any,
        reference: payment.reference,
        notes: payment.notes,
        paymentDate: payment.paymentDate.toISOString(),
        createdAt: payment.createdAt.toISOString(),
      };

      return {
        payment: paymentDTO,
        previousBalance: currentBalance,
        newBalance,
      };
    });
  }

  /**
   * Diagnostic reconciliation verifying that cached supplier.currentBalance strictly
   * equals sum(credit) - sum(debit) across the authoritative supplier_ledger.
   */
  async reconcileSupplierBalance(
    supplierId: string,
    autoFix = false,
    userId?: string
  ): Promise<{
    supplierId: string;
    supplierName: string;
    cachedBalance: number;
    calculatedBalance: number;
    isBalanced: boolean;
    discrepancy: number;
  }> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, currentBalance: true },
    });

    if (!supplier) {
      throw new Error(`Supplier with ID ${supplierId} not found.`);
    }

    const ledgerEntries = await this.prisma.supplierLedger.findMany({
      where: { supplierId },
    });

    const calculatedBalance = ledgerEntries.reduce(
      (sum, entry) => sum + Number(entry.credit) - Number(entry.debit),
      0
    );

    const cachedBalance = Number(supplier.currentBalance);
    const discrepancy = Math.abs(calculatedBalance - cachedBalance);
    const isBalanced = discrepancy < 0.0001;

    if (!isBalanced && autoFix) {
      await executeWriteTransaction(async (tx) => {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: calculatedBalance },
        });

        await auditService.log(
          {
            userId,
            action: 'AUTO_RECONCILE_SUPPLIER',
            entityType: 'Supplier',
            entityId: supplierId,
            oldValue: { currentBalance: cachedBalance },
            newValue: { currentBalance: calculatedBalance },
            reason: `Repaired cached payable balance from ${cachedBalance} to match ledger sum ${calculatedBalance}`,
          },
          tx
        );
      });

      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        cachedBalance: calculatedBalance,
        calculatedBalance,
        isBalanced: true,
        discrepancy: 0,
      };
    }

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      cachedBalance,
      calculatedBalance,
      isBalanced,
      discrepancy,
    };
  }
}

export const supplierAccountService = new SupplierAccountService();
