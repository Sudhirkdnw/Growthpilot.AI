import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import {
  RecordCustomerPaymentSchema,
  CustomerLedgerQuerySchema,
  CustomerStatementQuerySchema,
  ReverseCustomerPaymentSchema,
} from '../../../shared/schemas';
import {
  CustomerDTO,
  CustomerLedgerDTO,
  CustomerPaymentDTO,
  CustomerStatementDTO,
  CustomerReconciliationDTO,
  PaginatedResult,
} from '../../../shared/types';
import { customerService } from './customer.service';

export class CustomerAccountService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Retrieves paginated, chronological customer ledger audit trail.
   */
  async getCustomerLedger(
    customerId: string,
    params: z.input<typeof CustomerLedgerQuerySchema>
  ): Promise<PaginatedResult<CustomerLedgerDTO>> {
    const validated = CustomerLedgerQuerySchema.parse(params);

    if (customerId === 'cash-customer') {
      return {
        data: [],
        total: 0,
        page: validated.page,
        pageSize: validated.pageSize,
        totalPages: 0,
      };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });

    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }

    const where: any = { customerId };

    if (validated.type) {
      where.type = validated.type;
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

    const skip = (validated.page - 1) * validated.pageSize;

    const [entries, total] = await Promise.all([
      this.prisma.customerLedger.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerLedger.count({ where }),
    ]);

    const data: CustomerLedgerDTO[] = entries.map((e) => ({
      id: e.id,
      customerId: e.customerId,
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
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: Math.ceil(total / validated.pageSize),
    };
  }

  /**
   * Records an atomic payment received from a customer.
   * Credits the customer ledger, reduces customer receivable balance,
   * updates the balance cache atomically, and generates an audit record.
   */
  async recordCustomerPayment(
    input: z.input<typeof RecordCustomerPaymentSchema>,
    userId?: string
  ): Promise<{ payment: CustomerPaymentDTO; previousBalance: number; newBalance: number }> {
    const validated = RecordCustomerPaymentSchema.parse(input);

    if (validated.customerId === 'cash-customer') {
      throw new Error('Customer payments cannot be recorded against walk-in Cash Customer.');
    }

    // Pre-flight validation
    const customer = await this.prisma.customer.findUnique({
      where: { id: validated.customerId },
    });

    if (!customer) {
      throw new Error(`Customer with ID ${validated.customerId} not found.`);
    }

    if (customer.status === 'INACTIVE') {
      throw new Error(`Cannot record payment for inactive customer "${customer.name}".`);
    }

    const currentBalance = Number(customer.currentBalance);
    const amount = Math.round(validated.amount * 100) / 100;

    // Reject overpayment if amount > outstanding receivable
    if (amount > currentBalance) {
      throw new Error(
        `PAYMENT_EXCEEDS_OUTSTANDING: Payment amount (₹${amount.toFixed(2)}) exceeds outstanding receivable balance (₹${currentBalance.toFixed(2)}). Overpayment is not permitted.`
      );
    }

    return await executeWriteTransaction(async (tx) => {
      // Re-fetch customer inside serialized write queue to prevent concurrent race conditions
      const lockedCustomer = await tx.customer.findUnique({
        where: { id: validated.customerId },
      });

      if (!lockedCustomer) {
        throw new Error(`Customer with ID ${validated.customerId} not found.`);
      }

      if (lockedCustomer.status === 'INACTIVE') {
        throw new Error(`Cannot record payment for inactive customer "${lockedCustomer.name}".`);
      }

      const txCurrentBalance = Number(lockedCustomer.currentBalance);
      if (amount > txCurrentBalance) {
        throw new Error(
          `PAYMENT_EXCEEDS_OUTSTANDING: Concurrent update: Payment amount (₹${amount.toFixed(2)}) exceeds current outstanding balance (₹${txCurrentBalance.toFixed(2)}).`
        );
      }

      const newBalance = Math.round((txCurrentBalance - amount) * 100) / 100;
      const paymentDate = validated.paymentDate ? new Date(validated.paymentDate) : new Date();

      // 1. Create CustomerPayment record
      const payment = await tx.customerPayment.create({
        data: {
          customerId: lockedCustomer.id,
          amount,
          paymentMethod: validated.paymentMethod,
          reference: validated.reference?.trim() || null,
          notes: validated.notes?.trim() || null,
          paymentDate,
        },
      });

      // 2. Insert into authoritative customer_ledger (Credit reduces customer debt)
      await tx.customerLedger.create({
        data: {
          customerId: lockedCustomer.id,
          type: 'PAYMENT_RECEIVED',
          referenceId: payment.id,
          debit: 0,
          credit: amount,
          balance: newBalance,
          notes: validated.notes
            ? `Customer Payment (${validated.paymentMethod}): ${validated.notes}`
            : `Payment received via ${validated.paymentMethod}${validated.reference ? ` [Ref: ${validated.reference}]` : ''}`,
          createdAt: paymentDate,
        },
      });

      // 3. Atomically update cached customer currentBalance
      await tx.customer.update({
        where: { id: lockedCustomer.id },
        data: { currentBalance: newBalance },
      });

      // 4. Audit Log
      await auditService.log(
        {
          userId,
          action: 'CUSTOMER_PAYMENT_CREATED',
          entityType: 'Customer',
          entityId: lockedCustomer.id,
          oldValue: { currentBalance: txCurrentBalance },
          newValue: {
            currentBalance: newBalance,
            paymentAmount: amount,
            paymentMethod: validated.paymentMethod,
            paymentId: payment.id,
          },
          reason: `Recorded payment of ₹${amount.toFixed(2)} from customer ${lockedCustomer.name}`,
        },
        tx
      );

      const paymentDTO: CustomerPaymentDTO = {
        id: payment.id,
        customerId: payment.customerId,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod as any,
        reference: payment.reference,
        notes: payment.notes,
        paymentDate: payment.paymentDate.toISOString(),
        createdAt: payment.createdAt.toISOString(),
      };

      return {
        payment: paymentDTO,
        previousBalance: txCurrentBalance,
        newBalance,
      };
    });
  }

  /**
   * Reverses a previously recorded customer payment as an immutable transaction.
   * Debits the customer ledger, restores the receivable balance, and logs audit record.
   */
  async reverseCustomerPayment(
    input: z.input<typeof ReverseCustomerPaymentSchema>,
    userId?: string
  ): Promise<{ ledgerEntry: CustomerLedgerDTO; newBalance: number }> {
    const validated = ReverseCustomerPaymentSchema.parse(input);

    const payment = await this.prisma.customerPayment.findUnique({
      where: { id: validated.paymentId },
      include: { customer: true },
    });

    if (!payment) {
      throw new Error(`Customer payment with ID ${validated.paymentId} not found.`);
    }

    // Check if already reversed
    const existingReversal = await this.prisma.customerLedger.findFirst({
      where: {
        referenceId: payment.id,
        type: 'PAYMENT_REVERSED',
      },
    });

    if (existingReversal) {
      throw new Error(`PAYMENT_ALREADY_REVERSED: Payment ${validated.paymentId} has already been reversed.`);
    }

    return await executeWriteTransaction(async (tx) => {
      const lockedCustomer = await tx.customer.findUnique({
        where: { id: payment.customerId },
      });

      if (!lockedCustomer) {
        throw new Error(`Customer with ID ${payment.customerId} not found.`);
      }

      const amount = Number(payment.amount);
      const currentBalance = Number(lockedCustomer.currentBalance);
      const newBalance = Math.round((currentBalance + amount) * 100) / 100;

      // Create reversing ledger entry (debit increases customer debt back)
      const ledgerEntry = await tx.customerLedger.create({
        data: {
          customerId: lockedCustomer.id,
          type: 'PAYMENT_REVERSED',
          referenceId: payment.id,
          debit: amount,
          credit: 0,
          balance: newBalance,
          notes: `Reversal of Payment #${payment.id}: ${validated.reason}`,
        },
      });

      // Update cached balance
      await tx.customer.update({
        where: { id: lockedCustomer.id },
        data: { currentBalance: newBalance },
      });

      // Audit log
      await auditService.log(
        {
          userId,
          action: 'CUSTOMER_PAYMENT_REVERSED',
          entityType: 'Customer',
          entityId: lockedCustomer.id,
          oldValue: { currentBalance },
          newValue: {
            currentBalance: newBalance,
            reversedPaymentId: payment.id,
            reversalAmount: amount,
          },
          reason: `Reversed payment of ₹${amount.toFixed(2)} for customer ${lockedCustomer.name}. Reason: ${validated.reason}`,
        },
        tx
      );

      return {
        ledgerEntry: {
          id: ledgerEntry.id,
          customerId: ledgerEntry.customerId,
          type: ledgerEntry.type,
          referenceId: ledgerEntry.referenceId,
          debit: Number(ledgerEntry.debit),
          credit: Number(ledgerEntry.credit),
          balance: Number(ledgerEntry.balance),
          notes: ledgerEntry.notes,
          createdAt: ledgerEntry.createdAt.toISOString(),
        },
        newBalance,
      };
    });
  }

  /**
   * Generates a formal customer account statement over a specified date range.
   * Computes opening balance before start date, chronological movements, and ending balance.
   */
  async getCustomerStatement(
    customerId: string,
    params: z.input<typeof CustomerStatementQuerySchema>
  ): Promise<CustomerStatementDTO> {
    const validated = CustomerStatementQuerySchema.parse(params);

    if (customerId === 'cash-customer') {
      const cashCustomer = customerService.getDefaultCashCustomer();
      return {
        customer: cashCustomer,
        periodStart: validated.startDate || null,
        periodEnd: validated.endDate || null,
        openingBalance: 0,
        closingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        entries: [],
      };
    }

    const customer = await customerService.getCustomerById(customerId);

    let openingBalance = 0;

    // 1. Calculate opening balance prior to startDate if provided
    if (validated.startDate) {
      const priorEntries = await this.prisma.customerLedger.findMany({
        where: {
          customerId,
          createdAt: { lt: new Date(validated.startDate) },
        },
      });

      openingBalance = priorEntries.reduce(
        (acc, curr) => acc + Number(curr.debit) - Number(curr.credit),
        0
      );
      openingBalance = Math.round(openingBalance * 100) / 100;
    }

    // 2. Fetch statement entries within period
    const where: any = { customerId };
    if (validated.startDate || validated.endDate) {
      where.createdAt = {};
      if (validated.startDate) {
        where.createdAt.gte = new Date(validated.startDate);
      }
      if (validated.endDate) {
        where.createdAt.lte = new Date(validated.endDate);
      }
    }

    const entries = await this.prisma.customerLedger.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    let runningBalance = openingBalance;

    const statementEntries: CustomerLedgerDTO[] = entries.map((e) => {
      const debit = Number(e.debit);
      const credit = Number(e.credit);
      runningBalance = Math.round((runningBalance + debit - credit) * 100) / 100;
      totalDebit += debit;
      totalCredit += credit;

      return {
        id: e.id,
        customerId: e.customerId,
        type: e.type,
        referenceId: e.referenceId,
        debit,
        credit,
        balance: runningBalance,
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
      };
    });

    return {
      customer,
      periodStart: validated.startDate || null,
      periodEnd: validated.endDate || null,
      openingBalance,
      closingBalance: runningBalance,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      entries: statementEntries,
    };
  }

  /**
   * Diagnostic reconciliation verifying that cached customer.currentBalance strictly
   * equals sum(debit) - sum(credit) across the authoritative customer_ledger.
   */
  async reconcileCustomerBalance(
    customerId: string,
    autoFix = false,
    userId?: string
  ): Promise<CustomerReconciliationDTO> {
    if (customerId === 'cash-customer') {
      return {
        customerId: 'cash-customer',
        customerName: 'Cash Customer',
        cachedBalance: 0,
        calculatedBalance: 0,
        isBalanced: true,
        discrepancy: 0,
      };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, currentBalance: true },
    });

    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found.`);
    }

    const ledgerEntries = await this.prisma.customerLedger.findMany({
      where: { customerId },
    });

    const calculatedBalance = ledgerEntries.reduce(
      (sum, entry) => sum + Number(entry.debit) - Number(entry.credit),
      0
    );
    const roundedCalculated = Math.round(calculatedBalance * 100) / 100;
    const cachedBalance = Number(customer.currentBalance);
    const discrepancy = Math.abs(Math.round((roundedCalculated - cachedBalance) * 100) / 100);
    const isBalanced = discrepancy < 0.0001;

    if (!isBalanced && autoFix) {
      await executeWriteTransaction(async (tx) => {
        await tx.customer.update({
          where: { id: customerId },
          data: { currentBalance: roundedCalculated },
        });

        await auditService.log(
          {
            userId,
            action: 'AUTO_RECONCILE_CUSTOMER',
            entityType: 'Customer',
            entityId: customerId,
            oldValue: { currentBalance: cachedBalance },
            newValue: { currentBalance: roundedCalculated },
            reason: `Repaired cached customer receivable balance from ${cachedBalance} to match authoritative ledger sum ${roundedCalculated}`,
          },
          tx
        );
      });

      return {
        customerId: customer.id,
        customerName: customer.name,
        cachedBalance: roundedCalculated,
        calculatedBalance: roundedCalculated,
        isBalanced: true,
        discrepancy: 0,
      };
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      cachedBalance,
      calculatedBalance: roundedCalculated,
      isBalanced,
      discrepancy,
    };
  }
}

export const customerAccountService = new CustomerAccountService();
