import { z } from 'zod';
import { executeWriteTransaction, getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import {
  CreateExpenseCategorySchema,
  UpdateExpenseCategorySchema,
  ExpenseCategoryQuerySchema,
} from '../../../shared/schemas';
import { ExpenseCategoryDTO } from '../../../shared/types';

export class ExpenseCategoryService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Creates a new configurable expense category.
   */
  async createCategory(
    input: z.input<typeof CreateExpenseCategorySchema>,
    userId?: string
  ): Promise<ExpenseCategoryDTO> {
    const validated = CreateExpenseCategorySchema.parse(input);
    const trimmedName = validated.name.trim();

    const existing = await this.prisma.expenseCategory.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      throw new Error(`An expense category named "${trimmedName}" already exists.`);
    }

    return await executeWriteTransaction(async (tx) => {
      const category = await tx.expenseCategory.create({
        data: {
          name: trimmedName,
          description: validated.description?.trim() || null,
          status: 'ACTIVE',
        },
      });

      await auditService.log(
        {
          userId,
          action: 'EXPENSE_CATEGORY_CREATED',
          entityType: 'ExpenseCategory',
          entityId: category.id,
          newValue: { name: category.name },
          reason: `Created expense category "${category.name}"`,
        },
        tx
      );

      return this.mapToDTO(category);
    });
  }

  /**
   * Updates an expense category.
   */
  async updateCategory(
    id: string,
    input: z.input<typeof UpdateExpenseCategorySchema>,
    userId?: string
  ): Promise<ExpenseCategoryDTO> {
    const validated = UpdateExpenseCategorySchema.parse(input);

    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new Error(`Expense category with ID "${id}" not found.`);
    }

    if (validated.name && validated.name.trim() !== category.name) {
      const trimmedName = validated.name.trim();
      const existing = await this.prisma.expenseCategory.findUnique({
        where: { name: trimmedName },
      });
      if (existing && existing.id !== id) {
        throw new Error(`An expense category named "${trimmedName}" already exists.`);
      }
    }

    return await executeWriteTransaction(async (tx) => {
      const updated = await tx.expenseCategory.update({
        where: { id },
        data: {
          name: validated.name !== undefined ? validated.name.trim() : undefined,
          description: validated.description !== undefined ? (validated.description?.trim() || null) : undefined,
          status: validated.status !== undefined ? validated.status : undefined,
        },
      });

      await auditService.log(
        {
          userId,
          action: 'EXPENSE_CATEGORY_UPDATED',
          entityType: 'ExpenseCategory',
          entityId: id,
          oldValue: { name: category.name, status: category.status },
          newValue: { name: updated.name, status: updated.status },
          reason: `Updated expense category "${updated.name}"`,
        },
        tx
      );

      return this.mapToDTO(updated);
    });
  }

  /**
   * Deactivates an expense category.
   */
  async deactivateCategory(id: string, userId?: string): Promise<ExpenseCategoryDTO> {
    return this.updateCategory(id, { status: 'INACTIVE' }, userId);
  }

  /**
   * Safely deletes an expense category only if it has NO historical expense records.
   * Rejects deletion if any expense references it.
   */
  async deleteCategory(id: string, userId?: string): Promise<{ success: boolean; message: string }> {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new Error(`Expense category with ID "${id}" not found.`);
    }

    return await executeWriteTransaction(async (tx) => {
      const expenseCount = await tx.expense.count({
        where: { categoryId: id },
      });

      if (expenseCount > 0) {
        throw new Error(
          `CATEGORY_HAS_EXPENSES: Cannot delete expense category "${category.name}" because it has ${expenseCount} historical expense records. Please deactivate instead.`
        );
      }

      await tx.expenseCategory.delete({ where: { id } });

      await auditService.log(
        {
          userId,
          action: 'EXPENSE_CATEGORY_DELETED',
          entityType: 'ExpenseCategory',
          entityId: id,
          oldValue: { name: category.name },
          reason: `Deleted expense category "${category.name}" (no expenses existed)`,
        },
        tx
      );

      return {
        success: true,
        message: `Expense category "${category.name}" deleted successfully.`,
      };
    });
  }

  /**
   * Lists expense categories with expense count.
   */
  async listCategories(
    params?: z.input<typeof ExpenseCategoryQuerySchema>
  ): Promise<ExpenseCategoryDTO[]> {
    const validated = ExpenseCategoryQuerySchema.parse(params || {});
    const where: any = {};

    if (validated.status && validated.status !== 'ALL') {
      where.status = validated.status;
    }

    if (validated.search && validated.search.trim()) {
      where.name = { contains: validated.search.trim() };
    }

    const categories = await this.prisma.expenseCategory.findMany({
      where,
      include: {
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status as any,
      createdAt: c.createdAt.toISOString(),
      expenseCount: c._count.expenses,
    }));
  }

  private mapToDTO(c: any): ExpenseCategoryDTO {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      expenseCount: c._count?.expenses || 0,
    };
  }
}

export const expenseCategoryService = new ExpenseCategoryService();
