import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import { invoiceSequenceService } from '../sales/invoice-sequence.service';
import {
  CreateExpenseSchema,
  CancelExpenseSchema,
  ExpenseQuerySchema,
} from '../../../shared/schemas';
import { ExpenseDTO, PaginatedResult } from '../../../shared/types';

export class ExpenseService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Atomically records a business operating expense with a sequential number (EXP-000001).
   */
  async createExpense(
    input: z.input<typeof CreateExpenseSchema>,
    userId?: string
  ): Promise<ExpenseDTO> {
    const validated = CreateExpenseSchema.parse(input);
    const amount = Math.round(validated.amount * 100) / 100;

    if (amount <= 0) {
      throw new Error('EXPENSE_AMOUNT_INVALID: Expense amount must be greater than zero.');
    }

    // Verify category exists and is active
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: validated.categoryId },
    });

    if (!category) {
      throw new Error(`EXPENSE_CATEGORY_NOT_FOUND: Expense category with ID "${validated.categoryId}" not found.`);
    }

    if (category.status === 'INACTIVE') {
      throw new Error(`EXPENSE_CATEGORY_INACTIVE: Cannot record expense against inactive category "${category.name}".`);
    }

    // Parse business date
    let expenseDate = new Date();
    if (validated.date) {
      expenseDate = new Date(validated.date);
      if (isNaN(expenseDate.getTime())) {
        throw new Error('EXPENSE_DATE_INVALID: Invalid expense date provided.');
      }
    }

    return await executeWriteTransaction(async (tx) => {
      const expenseNumber = await invoiceSequenceService.getNextInvoiceNumber(tx, 'EXPENSE');

      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          categoryId: category.id,
          amount,
          paymentMethod: validated.paymentMethod,
          date: expenseDate,
          description: validated.description.trim(),
          reference: validated.reference?.trim() || null,
          status: 'POSTED',
          createdBy: userId || null,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      await auditService.log(
        {
          userId,
          action: 'EXPENSE_CREATED',
          entityType: 'Expense',
          entityId: expense.id,
          newValue: {
            expenseNumber,
            categoryName: category.name,
            amount,
            paymentMethod: validated.paymentMethod,
            date: expenseDate.toISOString(),
          },
          reason: `Recorded expense ${expenseNumber} (₹${amount.toFixed(2)}) for ${category.name}`,
        },
        tx
      );

      return this.mapToDTO(expense);
    });
  }

  /**
   * Controlled cancellation of a posted expense (Admin only).
   * Preserves historical record while marking status CANCELLED.
   */
  async cancelExpense(
    input: z.input<typeof CancelExpenseSchema>,
    userId?: string
  ): Promise<ExpenseDTO> {
    const validated = CancelExpenseSchema.parse(input);
    const reason = validated.reason.trim();

    if (!reason) {
      throw new Error('EXPENSE_CANCELLATION_REASON_REQUIRED: A valid cancellation reason is required.');
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: validated.expenseId },
      include: { category: true },
    });

    if (!expense) {
      throw new Error(`EXPENSE_NOT_FOUND: Expense with ID "${validated.expenseId}" not found.`);
    }

    if (expense.status === 'CANCELLED') {
      throw new Error(`EXPENSE_ALREADY_CANCELLED: Expense "${expense.expenseNumber || expense.id}" has already been cancelled.`);
    }

    return await executeWriteTransaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: validated.expenseId },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      await auditService.log(
        {
          userId,
          action: 'EXPENSE_CANCELLED',
          entityType: 'Expense',
          entityId: expense.id,
          oldValue: { status: 'POSTED' },
          newValue: {
            status: 'CANCELLED',
            expenseNumber: expense.expenseNumber,
            cancellationReason: reason,
          },
          reason: `Cancelled expense ${expense.expenseNumber || expense.id}. Reason: ${reason}`,
        },
        tx
      );

      return this.mapToDTO(updated);
    });
  }

  /**
   * Retrieves single expense by ID.
   */
  async getExpenseById(id: string): Promise<ExpenseDTO> {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      throw new Error(`EXPENSE_NOT_FOUND: Expense with ID "${id}" not found.`);
    }

    return this.mapToDTO(expense);
  }

  /**
   * Lists expenses with search, category, status, and date range filters.
   */
  async listExpenses(
    params: z.input<typeof ExpenseQuerySchema>
  ): Promise<PaginatedResult<ExpenseDTO>> {
    const validated = ExpenseQuerySchema.parse(params);
    const where: any = {};

    if (validated.categoryId) {
      where.categoryId = validated.categoryId;
    }

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.paymentMethod && validated.paymentMethod !== 'ALL') {
      where.paymentMethod = validated.paymentMethod;
    }

    if (validated.startDate || validated.endDate) {
      where.date = {};
      if (validated.startDate) {
        where.date.gte = new Date(validated.startDate);
      }
      if (validated.endDate) {
        where.date.lte = new Date(validated.endDate);
      }
    }

    if (validated.search && validated.search.trim()) {
      const q = validated.search.trim();
      where.OR = [
        { expenseNumber: { contains: q } },
        { description: { contains: q } },
        { reference: { contains: q } },
        { category: { name: { contains: q } } },
      ];
    }

    const skip = (validated.page - 1) * validated.pageSize;

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: validated.pageSize,
        orderBy: { date: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: expenses.map(this.mapToDTO),
      total,
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: Math.ceil(total / validated.pageSize),
    };
  }

  /**
   * Summary calculation of posted expenses within a date range.
   */
  async getExpenseSummary(startDate?: Date, endDate?: Date) {
    const where: any = { status: 'POSTED' };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    let totalAmount = 0;
    const categoryTotals = new Map<string, { categoryId: string; categoryName: string; amount: number; count: number }>();
    const paymentMethodTotals = new Map<string, number>();

    for (const exp of expenses) {
      const amt = Number(exp.amount);
      totalAmount += amt;

      // Category breakdown
      const catId = exp.categoryId;
      const catName = exp.category.name;
      const currentCat = categoryTotals.get(catId) || { categoryId: catId, categoryName: catName, amount: 0, count: 0 };
      currentCat.amount += amt;
      currentCat.count += 1;
      categoryTotals.set(catId, currentCat);

      // Payment method breakdown
      const method = exp.paymentMethod;
      paymentMethodTotals.set(method, (paymentMethodTotals.get(method) || 0) + amt);
    }

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalCount: expenses.length,
      byCategory: Array.from(categoryTotals.values()).map((c) => ({
        ...c,
        amount: Math.round(c.amount * 100) / 100,
      })),
      byPaymentMethod: Object.fromEntries(
        Array.from(paymentMethodTotals.entries()).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
    };
  }

  private mapToDTO(e: any): ExpenseDTO {
    return {
      id: e.id,
      expenseNumber: e.expenseNumber || 'EXP-LEGACY',
      categoryId: e.categoryId,
      categoryName: e.category?.name,
      amount: Number(e.amount),
      paymentMethod: e.paymentMethod,
      date: e.date instanceof Date ? e.date.toISOString() : e.date,
      description: e.description,
      reference: e.reference,
      status: e.status as any,
      cancellationReason: e.cancellationReason,
      createdBy: e.createdBy,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    };
  }
}

export const expenseService = new ExpenseService();
