import { getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateSubcategorySchema,
  UpdateSubcategorySchema,
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
        _count: { select: { products: true, subcategories: true } },
        subcategories: {
          orderBy: { name: 'asc' },
          where: includeInactive ? {} : { status: 'ACTIVE' },
          include: {
            _count: { select: { products: true } },
          },
        },
      },
    });
    return categories.map((c) => ({
      ...c,
      productCount: c._count?.products ?? 0,
      subcategoryCount: c._count?.subcategories ?? 0,
      subcategories: (c.subcategories || []).map((sub) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId,
        categoryName: c.name,
        description: sub.description,
        status: sub.status as any,
        productCount: (sub as any)._count?.products ?? 0,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
      })),
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

    // Check if any products or subcategories reference this category
    const [productCount, subcategoryCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: id } }),
      prisma.subcategory.count({ where: { categoryId: id } }),
    ]);

    if (productCount > 0) {
      throw new Error(
        `Cannot delete category: ${productCount} product(s) are currently assigned to this category. Please reassign products or deactivate the category instead.`
      );
    }

    if (subcategoryCount > 0) {
      throw new Error(
        `Cannot delete category: ${subcategoryCount} subcategory(ies) are currently assigned to this category. Please remove or reassign subcategories first.`
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
  // SUBCATEGORIES
  // --------------------------------------------------------------------------

  async listSubcategories(categoryId?: string, includeInactive = false) {
    const prisma = getPrismaClient();
    const where: any = {};
    if (!includeInactive) where.status = 'ACTIVE';
    if (categoryId) where.categoryId = categoryId;

    const subcategories = await prisma.subcategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
    });

    return subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      categoryId: sub.categoryId,
      categoryName: sub.category?.name || null,
      description: sub.description,
      status: sub.status as any,
      productCount: sub._count?.products ?? 0,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    }));
  }

  async createSubcategory(input: z.infer<typeof CreateSubcategorySchema>, userId?: string) {
    const validated = CreateSubcategorySchema.parse(input);
    const prisma = getPrismaClient();

    // Verify parent category exists
    const category = await prisma.category.findUnique({
      where: { id: validated.categoryId },
    });
    if (!category) {
      throw new Error(`Category with ID ${validated.categoryId} does not exist`);
    }

    // Check duplicate name within the same category
    const existing = await prisma.subcategory.findFirst({
      where: {
        categoryId: validated.categoryId,
        name: validated.name,
      },
    });
    if (existing) {
      throw new Error(`Subcategory "${validated.name}" already exists under category "${category.name}"`);
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        name: validated.name,
        categoryId: validated.categoryId,
        description: validated.description || null,
        status: 'ACTIVE',
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await auditService.log({
      userId,
      action: 'SUBCATEGORY_CREATE',
      entityType: 'Subcategory',
      entityId: subcategory.id,
      newValue: subcategory,
    });

    return {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      categoryName: subcategory.category.name,
      description: subcategory.description,
      status: subcategory.status as any,
      createdAt: subcategory.createdAt.toISOString(),
      updatedAt: subcategory.updatedAt.toISOString(),
    };
  }

  async updateSubcategory(id: string, input: z.infer<typeof UpdateSubcategorySchema>, userId?: string) {
    const validated = UpdateSubcategorySchema.parse(input);
    const prisma = getPrismaClient();

    const existing = await prisma.subcategory.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing) {
      throw new Error(`Subcategory with ID ${id} not found`);
    }

    const targetCategoryId = validated.categoryId || existing.categoryId;
    if (validated.name || validated.categoryId) {
      const targetName = validated.name || existing.name;
      const duplicate = await prisma.subcategory.findFirst({
        where: {
          id: { not: id },
          categoryId: targetCategoryId,
          name: targetName,
        },
      });
      if (duplicate) {
        throw new Error(`Subcategory "${targetName}" already exists under the selected category`);
      }
    }

    const updated = await prisma.subcategory.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(validated.categoryId ? { categoryId: validated.categoryId } : {}),
        ...(validated.description !== undefined ? { description: validated.description } : {}),
        ...(validated.status ? { status: validated.status } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await auditService.log({
      userId,
      action: 'SUBCATEGORY_UPDATE',
      entityType: 'Subcategory',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return {
      id: updated.id,
      name: updated.name,
      categoryId: updated.categoryId,
      categoryName: updated.category.name,
      description: updated.description,
      status: updated.status as any,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteSubcategory(id: string, userId?: string) {
    const prisma = getPrismaClient();

    // Check if any products reference this subcategory
    const productCount = await prisma.product.count({
      where: { subcategoryId: id },
    });

    if (productCount > 0) {
      throw new Error(
        `Cannot delete subcategory: ${productCount} product(s) are currently assigned to this subcategory. Please reassign products or deactivate the subcategory instead.`
      );
    }

    const deleted = await prisma.subcategory.delete({ where: { id } });

    await auditService.log({
      userId,
      action: 'SUBCATEGORY_DELETE',
      entityType: 'Subcategory',
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
