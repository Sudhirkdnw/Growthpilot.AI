import { getPrismaClient } from '../../database/client';
import { auditService } from '../audit/audit.service';
import {
  PERMISSION_CATALOGUE,
  DEFAULT_ROLE_PERMISSIONS,
  PermissionDefinition,
} from '../../../shared/constants/permissions';
import { RoleDTO, RoleDetailDTO, CreateRoleDTO, UpdateRoleDTO, Status } from '../../../shared/types';
import { CreateRoleSchema, UpdateRoleSchema } from '../../../shared/schemas';

export interface PermissionCheckOptions {
  currentUserId?: string;
  recordUserId?: string;
  discountPercent?: number;
  discountThreshold?: number;
  returnAmount?: number;
  returnThreshold?: number;
}

interface CachedRolePermissions {
  status: string;
  permissions: Set<string>;
  cachedAt: number;
}

export function isSystemRole(roleName: string): boolean {
  return ['ADMIN', 'MANAGER', 'CASHIER'].includes(roleName.toUpperCase());
}

export class RoleService {
  private cache = new Map<string, CachedRolePermissions>();
  private CACHE_TTL_MS = 30_000; // 30 seconds cache

  private clearCache(roleName?: string) {
    if (roleName) {
      this.cache.delete(roleName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Seeds default system roles (ADMIN, MANAGER, CASHIER) if the roles table is empty.
   */
  async seedDefaultRolesIfEmpty(): Promise<void> {
    const prisma = getPrismaClient();
    const count = await prisma.role.count();
    if (count > 0) {
      return;
    }

    console.log('[RoleService] Seeding default roles & permissions...');
    const allPermissions = PERMISSION_CATALOGUE.map((p) => p.key);

    const defaultRoles = [
      {
        name: 'ADMIN',
        description: 'Full unrestricted system administrator with access to all modules and configurations.',
        permissions: allPermissions,
      },
      {
        name: 'MANAGER',
        description: 'Store manager responsible for daily store operations, inventory, and management reports.',
        permissions: DEFAULT_ROLE_PERMISSIONS.MANAGER,
      },
      {
        name: 'CASHIER',
        description: 'Front-desk point of sale cashier handling billing, customer lookup, and receipts.',
        permissions: DEFAULT_ROLE_PERMISSIONS.CASHIER,
      },
    ];

    for (const roleDef of defaultRoles) {
      await prisma.$transaction(async (tx) => {
        const role = await tx.role.create({
          data: {
            name: roleDef.name,
            description: roleDef.description,
            status: 'ACTIVE',
            createdBy: 'SYSTEM',
          },
        });

        if (roleDef.permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: roleDef.permissions.map((perm) => ({
              roleId: role.id,
              permission: perm,
            })),
          });
        }
      });
    }

    this.clearCache();
    console.log('[RoleService] Default roles seeded successfully.');
  }

  /**
   * Returns all roles with their assigned user counts and permission counts.
   */
  async listRoles(): Promise<RoleDTO[]> {
    await this.seedDefaultRolesIfEmpty();
    const prisma = getPrismaClient();

    const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { permissions: true },
        },
      },
    });

    const userCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    const userCountMap = new Map<string, number>();
    for (const uc of userCounts) {
      userCountMap.set(uc.role, uc._count.id);
    }

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status as Status,
      isSystem: isSystemRole(r.name),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      userCount: userCountMap.get(r.name) || 0,
      permissionCount: r._count.permissions,
    }));
  }

  /**
   * Retrieves full details of a single role including its permission keys.
   */
  async getRoleById(id: string): Promise<RoleDetailDTO> {
    const prisma = getPrismaClient();
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          select: { permission: true },
        },
      },
    });

    if (!role) {
      throw new Error(`Role with ID "${id}" not found.`);
    }

    const userCount = await prisma.user.count({
      where: { role: role.name },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      status: role.status as Status,
      isSystem: isSystemRole(role.name),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
      createdBy: role.createdBy,
      updatedBy: role.updatedBy,
      userCount,
      permissionCount: role.permissions.length,
      permissions: role.permissions.map((p) => p.permission),
    };
  }

  /**
   * Retrieves full details of a role by name.
   */
  async getRoleByName(name: string): Promise<RoleDetailDTO | null> {
    const prisma = getPrismaClient();
    const role = await prisma.role.findUnique({
      where: { name },
      include: {
        permissions: {
          select: { permission: true },
        },
      },
    });

    if (!role) return null;

    const userCount = await prisma.user.count({
      where: { role: role.name },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      status: role.status as Status,
      isSystem: isSystemRole(role.name),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
      createdBy: role.createdBy,
      updatedBy: role.updatedBy,
      userCount,
      permissionCount: role.permissions.length,
      permissions: role.permissions.map((p) => p.permission),
    };
  }

  /**
   * Creates a new role and its associated permissions atomically.
   */
  async createRole(input: CreateRoleDTO, actorUserId?: string): Promise<RoleDetailDTO> {
    const validated = CreateRoleSchema.parse(input);
    const prisma = getPrismaClient();

    // Check uniqueness
    const existing = await prisma.role.findUnique({
      where: { name: validated.name },
    });
    if (existing) {
      throw new Error(`A role named "${validated.name}" already exists.`);
    }

    // Filter valid permissions from catalogue
    const validPermKeys = new Set(PERMISSION_CATALOGUE.map((p) => p.key));
    const selectedPerms = Array.from(new Set(validated.permissions)).filter((p) => validPermKeys.has(p));

    const createdRole = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: validated.name,
          description: validated.description || null,
          status: validated.status || 'ACTIVE',
          createdBy: actorUserId || 'ADMIN',
        },
      });

      if (selectedPerms.length > 0) {
        await tx.rolePermission.createMany({
          data: selectedPerms.map((permKey) => ({
            roleId: role.id,
            permission: permKey,
          })),
        });
      }

      return role;
    });

    this.clearCache();

    await auditService.log({
      userId: actorUserId,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: createdRole.id,
      newValue: {
        name: createdRole.name,
        description: createdRole.description,
        status: createdRole.status,
        permissionsCount: selectedPerms.length,
        permissions: selectedPerms,
      },
    });

    return {
      id: createdRole.id,
      name: createdRole.name,
      description: createdRole.description,
      status: createdRole.status as Status,
      isSystem: isSystemRole(createdRole.name),
      createdAt: createdRole.createdAt.toISOString(),
      updatedAt: createdRole.updatedAt.toISOString(),
      createdBy: createdRole.createdBy,
      updatedBy: createdRole.updatedBy,
      userCount: 0,
      permissionCount: selectedPerms.length,
      permissions: selectedPerms,
    };
  }

  /**
   * Updates an existing role and its permissions atomically.
   */
  async updateRole(id: string, input: UpdateRoleDTO, actorUserId?: string): Promise<RoleDetailDTO> {
    const validated = UpdateRoleSchema.parse(input);
    const prisma = getPrismaClient();

    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: { permissions: true },
    });

    if (!existingRole) {
      throw new Error(`Role with ID "${id}" not found.`);
    }

    const isSystem = isSystemRole(existingRole.name);

    // System roles can have description and permissions updated, but cannot change status to INACTIVE or be renamed
    if (isSystem) {
      if (validated.name && validated.name !== existingRole.name) {
        throw new Error(`System role "${existingRole.name}" cannot be renamed.`);
      }
      if (validated.status && validated.status === 'INACTIVE') {
        throw new Error(`System role "${existingRole.name}" cannot be deactivated.`);
      }
    }

    // If name is changing, check uniqueness
    if (validated.name && validated.name !== existingRole.name) {
      const duplicate = await prisma.role.findUnique({
        where: { name: validated.name },
      });
      if (duplicate && duplicate.id !== id) {
        throw new Error(`A role named "${validated.name}" already exists.`);
      }
    }

    const validPermKeys = new Set(PERMISSION_CATALOGUE.map((p) => p.key));
    const newPerms = validated.permissions
      ? Array.from(new Set(validated.permissions)).filter((p) => validPermKeys.has(p))
      : undefined;

    const oldPermKeys = existingRole.permissions.map((p) => p.permission);

    const updatedRole = await prisma.$transaction(async (tx) => {
      // If role name changed, update users assigned to this role name
      if (validated.name && validated.name !== existingRole.name) {
        await tx.user.updateMany({
          where: { role: existingRole.name },
          data: { role: validated.name },
        });
      }

      const role = await tx.role.update({
        where: { id },
        data: {
          name: validated.name,
          description: validated.description !== undefined ? validated.description : existingRole.description,
          status: validated.status || existingRole.status,
          updatedBy: actorUserId || 'ADMIN',
        },
      });

      if (newPerms !== undefined) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        if (newPerms.length > 0) {
          await tx.rolePermission.createMany({
            data: newPerms.map((permKey) => ({
              roleId: id,
              permission: permKey,
            })),
          });
        }
      }

      return role;
    });

    this.clearCache();

    const userCount = await prisma.user.count({
      where: { role: updatedRole.name },
    });

    const finalPerms = newPerms !== undefined ? newPerms : oldPermKeys;

    await auditService.log({
      userId: actorUserId,
      action: 'ROLE_UPDATED',
      entityType: 'Role',
      entityId: updatedRole.id,
      oldValue: {
        name: existingRole.name,
        description: existingRole.description,
        status: existingRole.status,
      },
      newValue: {
        name: updatedRole.name,
        description: updatedRole.description,
        status: updatedRole.status,
      },
    });

    if (newPerms !== undefined) {
      await auditService.log({
        userId: actorUserId,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entityType: 'Role',
        entityId: updatedRole.id,
        oldValue: { permissionsCount: oldPermKeys.length },
        newValue: { permissionsCount: newPerms.length, permissions: newPerms },
      });
    }

    return {
      id: updatedRole.id,
      name: updatedRole.name,
      description: updatedRole.description,
      status: updatedRole.status as Status,
      isSystem: isSystemRole(updatedRole.name),
      createdAt: updatedRole.createdAt.toISOString(),
      updatedAt: updatedRole.updatedAt.toISOString(),
      createdBy: updatedRole.createdBy,
      updatedBy: updatedRole.updatedBy,
      userCount,
      permissionCount: finalPerms.length,
      permissions: finalPerms,
    };
  }

  /**
   * Deletes a role safely after verifying no users are assigned.
   */
  async deleteRole(id: string, actorUserId?: string): Promise<{ success: boolean }> {
    const prisma = getPrismaClient();
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new Error(`Role with ID "${id}" not found.`);
    }

    if (isSystemRole(role.name)) {
      throw new Error(`System role "${role.name}" cannot be deleted.`);
    }

    const assignedUsers = await prisma.user.count({
      where: { role: role.name },
    });

    if (assignedUsers > 0) {
      throw new Error(
        `Cannot delete role "${role.name}". It is currently assigned to ${assignedUsers} user(s). Please reassign or update those users first.`
      );
    }

    await prisma.role.delete({
      where: { id },
    });

    this.clearCache(role.name);

    await auditService.log({
      userId: actorUserId,
      action: 'ROLE_DELETED',
      entityType: 'Role',
      entityId: id,
      oldValue: { name: role.name, description: role.description },
    });

    return { success: true };
  }

  /**
   * Retrieves permissions for a given role name (cached in-memory for performance).
   */
  async getEffectivePermissions(roleName: string): Promise<{ status: string; permissions: Set<string> }> {
    const now = Date.now();
    const cached = this.cache.get(roleName);
    if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      return { status: cached.status, permissions: cached.permissions };
    }

    await this.seedDefaultRolesIfEmpty();
    const prisma = getPrismaClient();

    const role = await prisma.role.findUnique({
      where: { name: roleName },
      include: {
        permissions: {
          select: { permission: true },
        },
      },
    });

    if (!role) {
      // Fallback: if role record doesn't exist yet, check default role map
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[roleName as keyof typeof DEFAULT_ROLE_PERMISSIONS];
      if (defaultPerms) {
        const permsSet = new Set(defaultPerms);
        this.cache.set(roleName, { status: 'ACTIVE', permissions: permsSet, cachedAt: now });
        return { status: 'ACTIVE', permissions: permsSet };
      }
      return { status: 'INACTIVE', permissions: new Set() };
    }

    const permsSet = new Set(role.permissions.map((p) => p.permission));
    this.cache.set(roleName, { status: role.status, permissions: permsSet, cachedAt: now });
    return { status: role.status, permissions: permsSet };
  }

  /**
   * Authoritative backend authorization check.
   * Checks role status, permission existence, scope (view_own vs view_all), and thresholds.
   */
  async hasPermission(
    roleName: string,
    permissionKey: string,
    options?: PermissionCheckOptions
  ): Promise<boolean> {
    const { status, permissions } = await this.getEffectivePermissions(roleName);

    // Inactive roles grant no permissions
    if (status !== 'ACTIVE') {
      return false;
    }

    if (permissionKey === 'sales.payment_override') {
      return roleName === 'ADMIN' || permissions.has('sales.void');
    }
    if (permissionKey === 'settings.payment_gateways.update') {
      return roleName === 'ADMIN' || permissions.has('settings.update');
    }

    // Super Admin / full ADMIN fallback check: if ADMIN has all permissions seeded
    if (permissions.has(permissionKey)) {
      // Check scope-aware permission rules
      if (permissionKey === 'sales.view_own' && options) {
        // If user has view_all, they automatically can view own as well
        if (permissions.has('sales.view_all')) return true;
        // Otherwise they can only view if owner matches
        if (options.recordUserId && options.currentUserId) {
          return options.recordUserId === options.currentUserId;
        }
      }

      if (permissionKey === 'quotations.view_own' && options) {
        if (permissions.has('quotations.view_all')) return true;
        if (options.recordUserId && options.currentUserId) {
          return options.recordUserId === options.currentUserId;
        }
      }

      // Check threshold rules
      if (permissionKey === 'sales.discount' && options?.discountPercent !== undefined && options?.discountThreshold !== undefined) {
        if (options.discountPercent > options.discountThreshold) {
          // Normal discount permission is NOT enough; requires discount_above_threshold
          return permissions.has('sales.discount_above_threshold');
        }
      }

      if (permissionKey === 'returns.create' && options?.returnAmount !== undefined && options?.returnThreshold !== undefined) {
        if (options.returnAmount > options.returnThreshold) {
          return permissions.has('returns.create_above_threshold');
        }
      }

      return true;
    }

    // Special scope elevation: if checking sales.view_own, check if role has sales.view_all
    if (permissionKey === 'sales.view_own' && permissions.has('sales.view_all')) {
      return true;
    }

    if (permissionKey === 'quotations.view_own' && permissions.has('quotations.view_all')) {
      return true;
    }

    return false;
  }

  /**
   * Returns the static permission catalogue metadata.
   */
  getPermissionCatalogue(): PermissionDefinition[] {
    return PERMISSION_CATALOGUE;
  }
}

export const roleService = new RoleService();
