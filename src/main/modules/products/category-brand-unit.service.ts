import { getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateBrandSchema,
  UpdateBrandSchema,
  CreateUnitSchema,
  UpdateUnitSchema,
} from '../../../shared/schemas';
import { getUnitMetadata } from '../../../shared/utils/quantity';
import { z } from 'zod';

export class CategoryBrandUnitService {
  // --------------------------------------------------------------------------
  // CATEGORIES
  // --------------------------------------------------------------------------

  async listCategories(includeInactive = false) {
    const prisma = getPrismaClient();
    const categories = await prisma.category.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
    return categories.map((c) => ({
      ...c,
      productCount: c._count?.products ?? 0,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async createCategory(input: z.infer<typeof CreateCategorySchema>, userId?: string) {
    const validated = CreateCategorySchema.parse(input);
    const prisma = getPrismaClient();

    // Check duplicate name
    const existing = await prisma.category.findUnique({
      where: { name: validated.name },
    });
    if (existing) {
      throw new Error(`Category "${validated.name}" already exists`);
    }

    const category = await prisma.category.create({
      data: {
        name: validated.name,
        description: validated.description || null,
        status: 'ACTIVE',
      },
    });

    await auditService.log({
      userId,
      action: 'CATEGORY_CREATE',
      entityType: 'Category',
      entityId: category.id,
      newValue: category,
    });

    return category;
  }

  async updateCategory(id: string, input: z.infer<typeof UpdateCategorySchema>, userId?: string) {
    const validated = UpdateCategorySchema.parse(input);
    const prisma = getPrismaClient();

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Category with ID ${id} not found`);
    }

    if (validated.name && validated.name !== existing.name) {
      const duplicate = await prisma.category.findUnique({ where: { name: validated.name } });
      if (duplicate) {
        throw new Error(`Category "${validated.name}" already exists`);
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(validated.description !== undefined ? { description: validated.description } : {}),
        ...(validated.status ? { status: validated.status } : {}),
      },
    });

    await auditService.log({
      userId,
      action: 'CATEGORY_UPDATE',
      entityType: 'Category',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async deleteCategory(id: string, userId?: string) {
    const prisma = getPrismaClient();

    // Check if any products reference this category
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new Error(
        `Cannot delete category: ${productCount} product(s) are currently assigned to this category. Please reassign products or deactivate the category instead.`
      );
    }

    const deleted = await prisma.category.delete({ where: { id } });

    await auditService.log({
      userId,
      action: 'CATEGORY_DELETE',
      entityType: 'Category',
      entityId: id,
      oldValue: deleted,
    });

    return { success: true };
  }

  // --------------------------------------------------------------------------
  // BRANDS
  // --------------------------------------------------------------------------

  async listBrands(includeInactive = false) {
    const prisma = getPrismaClient();
    const brands = await prisma.brand.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
    return brands.map((b) => ({
      ...b,
      productCount: b._count?.products ?? 0,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async createBrand(input: z.infer<typeof CreateBrandSchema>, userId?: string) {
    const validated = CreateBrandSchema.parse(input);
    const prisma = getPrismaClient();

    const existing = await prisma.brand.findUnique({
      where: { name: validated.name },
    });
    if (existing) {
      throw new Error(`Brand "${validated.name}" already exists`);
    }

    const brand = await prisma.brand.create({
      data: {
        name: validated.name,
        status: 'ACTIVE',
      },
    });

    await auditService.log({
      userId,
      action: 'BRAND_CREATE',
      entityType: 'Brand',
      entityId: brand.id,
      newValue: brand,
    });

    return brand;
  }

  async updateBrand(id: string, input: z.infer<typeof UpdateBrandSchema>, userId?: string) {
    const validated = UpdateBrandSchema.parse(input);
    const prisma = getPrismaClient();

    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Brand with ID ${id} not found`);
    }

    if (validated.name && validated.name !== existing.name) {
      const duplicate = await prisma.brand.findUnique({ where: { name: validated.name } });
      if (duplicate) {
        throw new Error(`Brand "${validated.name}" already exists`);
      }
    }

    const updated = await prisma.brand.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(validated.status ? { status: validated.status } : {}),
      },
    });

    await auditService.log({
      userId,
      action: 'BRAND_UPDATE',
      entityType: 'Brand',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async deleteBrand(id: string, userId?: string) {
    const prisma = getPrismaClient();

    const productCount = await prisma.product.count({
      where: { brandId: id },
    });

    if (productCount > 0) {
      throw new Error(
        `Cannot delete brand: ${productCount} product(s) are currently assigned to this brand. Please reassign products or deactivate the brand instead.`
      );
    }

    const deleted = await prisma.brand.delete({ where: { id } });

    await auditService.log({
      userId,
      action: 'BRAND_DELETE',
      entityType: 'Brand',
      entityId: id,
      oldValue: deleted,
    });

    return { success: true };
  }

  // --------------------------------------------------------------------------
  // UNITS
  // --------------------------------------------------------------------------

  async listUnits(includeInactive = false) {
    const prisma = getPrismaClient();
    const units = await prisma.unit.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
    return units.map((u) => ({
      ...u,
      productCount: u._count?.products ?? 0,
    }));
  }

  async createUnit(input: z.input<typeof CreateUnitSchema>, userId?: string) {
    const validated = CreateUnitSchema.parse(input);
    const prisma = getPrismaClient();

    const existingCode = await prisma.unit.findUnique({
      where: { shortCode: validated.shortCode },
    });
    if (existingCode) {
      throw new Error(`Unit with code "${validated.shortCode}" already exists`);
    }

    const meta = getUnitMetadata(validated.shortCode);
    const category = validated.category || meta.category;
    const allowDecimal = validated.allowDecimal !== undefined ? validated.allowDecimal : meta.allowDecimal;
    const precision = validated.precision !== undefined ? validated.precision : meta.precision;
    const conversionFactor = validated.conversionFactor !== undefined ? validated.conversionFactor : meta.conversionFactor;
    const baseUnitCode = validated.baseUnitCode !== undefined ? validated.baseUnitCode : meta.baseUnitCode;

    const unit = await prisma.unit.create({
      data: {
        name: validated.name,
        shortCode: validated.shortCode,
        category,
        allowDecimal,
        precision,
        conversionFactor,
        baseUnitCode: baseUnitCode || null,
        status: 'ACTIVE',
      },
    });

    await auditService.log({
      userId,
      action: 'UNIT_CREATE',
      entityType: 'Unit',
      entityId: unit.id,
      newValue: unit,
    });

    return unit;
  }

  async updateUnit(id: string, input: z.infer<typeof UpdateUnitSchema>, userId?: string) {
    const validated = UpdateUnitSchema.parse(input);
    const prisma = getPrismaClient();

    const existing = await prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Unit with ID ${id} not found`);
    }

    if (validated.shortCode && validated.shortCode !== existing.shortCode) {
      const duplicate = await prisma.unit.findUnique({ where: { shortCode: validated.shortCode } });
      if (duplicate) {
        throw new Error(`Unit code "${validated.shortCode}" already exists`);
      }
    }

    const updated = await prisma.unit.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(validated.shortCode ? { shortCode: validated.shortCode } : {}),
        ...(validated.category ? { category: validated.category } : {}),
        ...(validated.allowDecimal !== undefined ? { allowDecimal: validated.allowDecimal } : {}),
        ...(validated.precision !== undefined ? { precision: validated.precision } : {}),
        ...(validated.conversionFactor !== undefined ? { conversionFactor: validated.conversionFactor } : {}),
        ...(validated.baseUnitCode !== undefined ? { baseUnitCode: validated.baseUnitCode } : {}),
        ...(validated.status ? { status: validated.status } : {}),
      },
    });

    await auditService.log({
      userId,
      action: 'UNIT_UPDATE',
      entityType: 'Unit',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async deleteUnit(id: string, userId?: string) {
    const prisma = getPrismaClient();

    const productCount = await prisma.product.count({
      where: { unitId: id },
    });

    if (productCount > 0) {
      throw new Error(
        `Cannot delete unit: ${productCount} product(s) are currently assigned to this unit. Please reassign products or deactivate the unit instead.`
      );
    }

    const deleted = await prisma.unit.delete({ where: { id } });

    await auditService.log({
      userId,
      action: 'UNIT_DELETE',
      entityType: 'Unit',
      entityId: id,
      oldValue: deleted,
    });

    return { success: true };
  }
}

export const categoryBrandUnitService = new CategoryBrandUnitService();
