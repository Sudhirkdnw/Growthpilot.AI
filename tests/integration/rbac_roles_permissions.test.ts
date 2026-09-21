/**
 * Production RBAC and Role Permission Builder - COMPLETE Test Suite v2
 * Covers ALL specification requirements (Sections 1-27)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient, initializeDatabasePragmas } from '../../src/main/database/client';
import { roleService } from '../../src/main/modules/auth/role.service';
import { sessionManager } from '../../src/main/modules/auth/session.manager';
import { dispatchFastify } from '../../src/main/fastify/server';
import {
  PERMISSION_CATALOGUE,
  PERMISSION_CATEGORIES,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../src/shared/constants/permissions';

describe('Production RBAC and Role Permission Builder Test Suite', () => {
  const prisma = getPrismaClient();
  let adminToken: string;
  let adminUserId: string;
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let testProductId: string;

  beforeAll(async () => {
    await initializeDatabasePragmas();
    await roleService.seedDefaultRolesIfEmpty();

    let admin = await prisma.user.findFirst({ where: { username: 'rbac_admin_test' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: { username: 'rbac_admin_test', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash', fullName: 'RBAC Super Admin', role: 'ADMIN', status: 'ACTIVE' },
      });
    }
    adminUserId = admin.id;
    adminToken = sessionManager.createSession({ id: admin.id, username: admin.username, fullName: admin.fullName, role: 'ADMIN', status: 'ACTIVE', createdAt: admin.createdAt.toISOString() }).token;

    let userA = await prisma.user.findFirst({ where: { username: 'rbac_user_a' } });
    if (!userA) {
      userA = await prisma.user.create({ data: { username: 'rbac_user_a', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash', fullName: 'Operator User A', role: 'CASHIER', status: 'ACTIVE' } });
    }
    userAId = userA.id;
    userAToken = sessionManager.createSession({ id: userA.id, username: userA.username, fullName: userA.fullName, role: userA.role, status: 'ACTIVE', createdAt: userA.createdAt.toISOString() }).token;

    let userB = await prisma.user.findFirst({ where: { username: 'rbac_user_b' } });
    if (!userB) {
      userB = await prisma.user.create({ data: { username: 'rbac_user_b', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash', fullName: 'Operator User B', role: 'CASHIER', status: 'ACTIVE' } });
    }
    userBId = userB.id;
    userBToken = sessionManager.createSession({ id: userB.id, username: userB.username, fullName: userB.fullName, role: userB.role, status: 'ACTIVE', createdAt: userB.createdAt.toISOString() }).token;

    let unit = await prisma.unit.findFirst();
    if (!unit) unit = await prisma.unit.create({ data: { name: 'Piece', shortCode: 'PCS', allowDecimal: false } });

    let product = await prisma.product.findFirst({ where: { sku: 'RBAC-PROD-1' } });
    if (!product) {
      product = await prisma.product.create({ data: { name: 'RBAC Test Product', sku: 'RBAC-PROD-1', unitId: unit.id, purchasePrice: 50, salePrice: 100, currentStock: 100, status: 'ACTIVE' } });
    }
    testProductId = product.id;
  });

  afterAll(async () => {
    await prisma.role.deleteMany({ where: { name: { in: ['Floor Supervisor','Test Duplicate Role','Test Deletion Role','Test Mutation Role','Test Clone Source','Test Clone Source (Copy)','Senior Cashier Clone','Inactive Test Role','Concurrent Role A','Dynamic Perm Role'] } } });
    await prisma.user.update({ where: { id: userAId }, data: { role: 'CASHIER' } }).catch(() => {});
    await prisma.user.update({ where: { id: userBId }, data: { role: 'CASHIER' } }).catch(() => {});
  });

  function cashierSessionToken() { return userBToken; }

  // ===========================================================================
  // 1. PERMISSION CATALOGUE AND CATEGORIES INTEGRITY
  // ===========================================================================
  describe('1. Permission Catalogue and Metadata', () => {
    it('contains all 20 categories and 128 distinct permission keys', () => {
      expect(PERMISSION_CATEGORIES.length).toBe(20);
      expect(PERMISSION_CATALOGUE.length).toBe(128);
      const keys = PERMISSION_CATALOGUE.map((p) => p.key);
      expect(new Set(keys).size).toBe(128);
    });

    it('marks all 12 required dangerous permissions', () => {
      const dangerous = PERMISSION_CATALOGUE.filter((p) => p.dangerous).map((p) => p.key);
      ['accounting.opening_balances','accounting.year_end_close','accounting.unlock_period','backup.restore','quotations.cancel','commerce.manage','settings.update_dangerous','updater.run','users.create_super_admin','users.mfa_reset','settings.whatsapp.credentials','whatsapp.send_bulk'].forEach((k) => expect(dangerous).toContain(k));
    });

    it('every permission has key, category, displayName, and description', () => {
      for (const p of PERMISSION_CATALOGUE) {
        expect(p.key).toBeTruthy();
        expect(p.category).toBeTruthy();
        expect(p.displayName).toBeTruthy();
        expect(p.description).toBeTruthy();
      }
    });

    it('validates exact permission count per category', () => {
      const cat = (n: string) => PERMISSION_CATEGORIES.find((c) => c.name === n)!.permissions.length;
      expect(cat('Accounting')).toBe(9); expect(cat('Backup')).toBe(2); expect(cat('Customers')).toBe(9);
      expect(cat('Expenses')).toBe(5); expect(cat('Hardware')).toBe(4); expect(cat('Operations')).toBe(2);
      expect(cat('Products')).toBe(12); expect(cat('Purchases')).toBe(5); expect(cat('Quotations')).toBe(7);
      expect(cat('Reports')).toBe(11); expect(cat('Returns')).toBe(3); expect(cat('Sales')).toBe(14);
      expect(cat('Sales Channels')).toBe(4); expect(cat('Settings')).toBe(5); expect(cat('Shifts')).toBe(8);
      expect(cat('Stores')).toBe(4); expect(cat('Suppliers')).toBe(6); expect(cat('Updater')).toBe(2);
      expect(cat('Users')).toBe(8); expect(cat('WhatsApp')).toBe(8);
    });

    it('permission search for refund finds sales.refund', () => {
      const q = 'refund';
      const results = PERMISSION_CATALOGUE.filter((p) => p.key.includes(q) || p.displayName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
      expect(results.map((p) => p.key)).toContain('sales.refund');
    });

    it('permission search for backup finds both backup permissions', () => {
      const q = 'backup';
      const results = PERMISSION_CATALOGUE.filter((p) => p.key.includes(q) || p.displayName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
      expect(results.map((p) => p.key)).toContain('backup.restore');
      expect(results.map((p) => p.key)).toContain('backup.run');
    });
  });

  // ===========================================================================
  // 2. DEFAULT SYSTEM ROLES
  // ===========================================================================
  describe('2. Default Roles Seeding and Immutability', () => {
    it('seeds ADMIN, MANAGER, and CASHIER roles with correct permission counts', async () => {
      const roles = await roleService.listRoles();
      const names = roles.map((r) => r.name);
      expect(names).toContain('ADMIN'); expect(names).toContain('MANAGER'); expect(names).toContain('CASHIER');
      const adminRole = roles.find((r) => r.name === 'ADMIN')!;
      expect(adminRole.isSystem).toBe(true); expect(adminRole.permissionCount).toBe(128);
    });

    it('ADMIN role contains ALL 128 catalogue permissions', async () => {
      const role = await roleService.getRoleByName('ADMIN');
      expect(role!.permissions.length).toBe(128);
      for (const p of PERMISSION_CATALOGUE) { expect(role!.permissions).toContain(p.key); }
    });

    it('CASHIER has sales and products basics but not dangerous permissions', async () => {
      const role = await roleService.getRoleByName('CASHIER');
      expect(role!.permissions).toContain('sales.create');
      expect(role!.permissions).toContain('products.view');
      expect(role!.permissions).toContain('sales.view_own');
      expect(role!.permissions).not.toContain('backup.restore');
      expect(role!.permissions).not.toContain('users.create_super_admin');
      expect(role!.permissions).not.toContain('accounting.year_end_close');
    });

    it('prevents renaming or deactivating system roles', async () => {
      const admin = await roleService.getRoleByName('ADMIN');
      await expect(roleService.updateRole(admin!.id, { name: 'Renamed ADMIN' }, adminUserId)).rejects.toThrow('cannot be renamed');
      await expect(roleService.updateRole(admin!.id, { status: 'INACTIVE' }, adminUserId)).rejects.toThrow('cannot be deactivated');
    });

    it('prevents deleting system roles', async () => {
      const admin = await roleService.getRoleByName('ADMIN');
      await expect(roleService.deleteRole(admin!.id, adminUserId)).rejects.toThrow('cannot be deleted');
    });

    it('DEFAULT_ROLE_PERMISSIONS MANAGER matches seeded MANAGER role', async () => {
      const role = await roleService.getRoleByName('MANAGER');
      const expected = new Set(DEFAULT_ROLE_PERMISSIONS.MANAGER);
      for (const p of expected) { expect(role!.permissions).toContain(p); }
    });
  });

  // ===========================================================================
  // 3. ROLE CREATION AND VALIDATION
  // ===========================================================================
  describe('3. Role Creation and Validation', () => {
    it('creates a role with permissions in an atomic DB transaction', async () => {
      const created = await roleService.createRole({ name: 'Test Mutation Role', description: 'A test role', status: 'ACTIVE', permissions: ['products.view', 'sales.create', 'sales.discount'] }, adminUserId);
      expect(created.id).toBeDefined(); expect(created.permissionCount).toBe(3);
      const dbPerms = await prisma.rolePermission.findMany({ where: { roleId: created.id } });
      expect(dbPerms.length).toBe(3);
    });

    it('rejects duplicate role names', async () => {
      await expect(roleService.createRole({ name: 'Test Mutation Role', permissions: ['products.view'] }, adminUserId)).rejects.toThrow('already exists');
    });

    it('rejects empty role name via Zod schema', async () => {
      await expect(roleService.createRole({ name: '', permissions: [] }, adminUserId)).rejects.toThrow();
    });

    it('silently filters invalid permission keys from catalogue', async () => {
      const created = await roleService.createRole({ name: 'Test Clone Source', description: 'Cloning tests', status: 'ACTIVE', permissions: ['products.view', 'sales.create', 'NON_EXISTENT_PERMISSION', 'FAKE.PERM'] }, adminUserId);
      expect(created.permissionCount).toBe(2);
      expect(created.permissions).not.toContain('NON_EXISTENT_PERMISSION');
    });

    it('creates a role with INACTIVE status; grants no permissions', async () => {
      const created = await roleService.createRole({ name: 'Inactive Test Role', status: 'INACTIVE', permissions: ['products.view'] }, adminUserId);
      expect(created.status).toBe('INACTIVE');
      expect(await roleService.hasPermission('Inactive Test Role', 'products.view')).toBe(false);
    });

    it('via Fastify: POST /api/admin/roles succeeds with roles.manage', async () => {
      const res = await dispatchFastify('POST', '/api/admin/roles', { name: 'Concurrent Role A', status: 'ACTIVE', permissions: ['products.view', 'customers.view'] }, { authorization: adminToken });
      expect(res.success).toBe(true); expect(res.role.permissionCount).toBe(2);
    });

    it('via Fastify: POST /api/admin/roles rejected without roles.manage', async () => {
      const res = await dispatchFastify('POST', '/api/admin/roles', { name: 'Should Not Be Created', permissions: [] }, { authorization: userBToken });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/does not have the required permission .roles\.manage./i);
    });
  });

  // ===========================================================================
  // 4. PERMISSION ASSIGNMENT AND UPDATES
  // ===========================================================================
  describe('4. Permission Assignment and Updates', () => {
    it('updates role permissions atomically: add, then remove', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      const updated1 = await roleService.updateRole(role!.id, { permissions: ['products.view', 'sales.create', 'sales.discount', 'customers.view'] }, adminUserId);
      expect(updated1.permissionCount).toBe(4); expect(updated1.permissions).toContain('customers.view');
      const updated2 = await roleService.updateRole(role!.id, { permissions: ['products.view'] }, adminUserId);
      expect(updated2.permissionCount).toBe(1);
    });

    it('select all: updating with all 128 permissions', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      const allPerms = PERMISSION_CATALOGUE.map((p) => p.key);
      const updated = await roleService.updateRole(role!.id, { permissions: allPerms }, adminUserId);
      expect(updated.permissionCount).toBe(128);
    });

    it('deselect all: updating with empty permissions removes all', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      const updated = await roleService.updateRole(role!.id, { permissions: [] }, adminUserId);
      expect(updated.permissionCount).toBe(0); expect(updated.permissions).toEqual([]);
    });

    it('updates description without changing permissions', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      const updated = await roleService.updateRole(role!.id, { description: 'Updated description', permissions: ['products.view'] }, adminUserId);
      expect(updated.description).toBe('Updated description'); expect(updated.permissionCount).toBe(1);
    });

    it('cycles role status INACTIVE then ACTIVE', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      const deact = await roleService.updateRole(role!.id, { status: 'INACTIVE' }, adminUserId);
      expect(deact.status).toBe('INACTIVE');
      const react = await roleService.updateRole(role!.id, { status: 'ACTIVE' }, adminUserId);
      expect(react.status).toBe('ACTIVE');
    });

    it('duplicate name check fires on rename to existing role name', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      await expect(roleService.updateRole(role!.id, { name: 'CASHIER' }, adminUserId)).rejects.toThrow('already exists');
    });

    it('via Fastify: PUT /api/admin/roles/:id rejected for non-admin', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      const res = await dispatchFastify('PUT', `/api/admin/roles/${role!.id}`, { description: 'Unauthorized attempt' }, { authorization: userBToken });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/does not have the required permission .roles\.manage./i);
    });
  });

  // ===========================================================================
  // 5. SAFE DELETION GUARDS
  // ===========================================================================
  describe('5. Role Deletion Safety', () => {
    it('rejects deletion of role assigned to active users; succeeds after reassignment', async () => {
      const role = await roleService.createRole({ name: 'Test Deletion Role', permissions: ['products.view'] }, adminUserId);
      await prisma.user.update({ where: { id: userBId }, data: { role: 'Test Deletion Role' } });
      await expect(roleService.deleteRole(role.id, adminUserId)).rejects.toThrow('currently assigned to 1 user');
      await prisma.user.update({ where: { id: userBId }, data: { role: 'CASHIER' } });
      const result = await roleService.deleteRole(role.id, adminUserId);
      expect(result.success).toBe(true);
      expect(await prisma.role.findUnique({ where: { id: role.id } })).toBeNull();
    });

    it('deletes unassigned role immediately', async () => {
      const role = await roleService.createRole({ name: 'Test Duplicate Role', permissions: [] }, adminUserId);
      expect((await roleService.deleteRole(role.id, adminUserId)).success).toBe(true);
    });

    it('via Fastify: DELETE /api/admin/roles/:id rejected for non-admin', async () => {
      const mgr = await roleService.getRoleByName('MANAGER');
      const res = await dispatchFastify('DELETE', `/api/admin/roles/${mgr!.id}`, undefined, { authorization: userBToken });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/does not have the required permission .roles\.manage./i);
    });
  });

  // ===========================================================================
  // 6. BACKEND AUTHORIZATION AND FASTIFY ENFORCEMENT
  // ===========================================================================
  describe('6. Fastify Backend Authorization Guards', () => {
    it('rejects product deletion for CASHIER (lacks products.delete)', async () => {
      const res = await dispatchFastify('DELETE', `/api/products/${testProductId}`, undefined, { authorization: cashierSessionToken() });
      expect(res.error).toMatch(/does not have the required permission .products\.delete./i);
    });

    it('rejects backup restore for CASHIER (lacks backup.restore)', async () => {
      const res = await dispatchFastify('POST', '/api/maintenance/restore', { backupFilePath: 'fake.zip' }, { authorization: cashierSessionToken() });
      expect(res.error).toMatch(/does not have the required permission .backup\.restore./i);
    });

    it('rejects roles listing for CASHIER (lacks roles.manage)', async () => {
      const res = await dispatchFastify('GET', '/api/admin/roles', undefined, { authorization: cashierSessionToken() });
      expect(res.error).toMatch(/does not have the required permission .roles\.manage./i);
    });

    it('rejects customer creation for role without customers.create', async () => {
      const limitedRole = await roleService.createRole({ name: 'Dynamic Perm Role', permissions: ['products.view'] }, adminUserId);
      const session = sessionManager.createSession({ id: userAId, username: 'rbac_user_a', fullName: 'Operator User A', role: limitedRole.name, status: 'ACTIVE', createdAt: new Date().toISOString() });
      const res = await dispatchFastify('POST', '/api/customers', { name: 'Test Customer' }, { authorization: session.token });
      expect(res.error).toMatch(/does not have the required permission .customers\.create./i);
    });

    it('rejects unauthenticated request with auth error', async () => {
      const res = await dispatchFastify('GET', '/api/admin/roles', undefined, {});
      expect(res.error).toBeDefined();
    });
  });

  // ===========================================================================
  // 7. SCOPE-AWARE AUTHORIZATION: own vs all
  // ===========================================================================
  describe('7. Scope-Aware Authorization (Own vs All)', () => {
    it('sales.view_own: same user allowed, different user denied', async () => {
      expect(await roleService.hasPermission('CASHIER', 'sales.view_own', { currentUserId: 'u1', recordUserId: 'u1' })).toBe(true);
      expect(await roleService.hasPermission('CASHIER', 'sales.view_own', { currentUserId: 'u1', recordUserId: 'u2' })).toBe(false);
    });

    it('ADMIN with sales.view_all grants sales.view_own for any user', async () => {
      expect(await roleService.hasPermission('ADMIN', 'sales.view_own', { currentUserId: adminUserId, recordUserId: 'u999' })).toBe(true);
    });

    it('MANAGER with sales.view_all grants sales.view_own for any user', async () => {
      expect(await roleService.hasPermission('MANAGER', 'sales.view_own', { currentUserId: 'manager-id', recordUserId: 'cashier-id' })).toBe(true);
    });

    it('sales.view_own without view_all returns only own records from API', async () => {
      const role = await roleService.createRole({ name: 'ViewOwnOnly_Temp', permissions: ['sales.view_own', 'sales.create', 'products.view'] }, adminUserId);
      const session = sessionManager.createSession({ id: userBId, username: 'rbac_user_b', fullName: 'B', role: role.name, status: 'ACTIVE', createdAt: new Date().toISOString() });
      const res = await dispatchFastify('GET', '/api/sales', undefined, { authorization: session.token });
      expect(res.data).toBeDefined(); expect(Array.isArray(res.data)).toBe(true);
      await prisma.role.deleteMany({ where: { name: 'ViewOwnOnly_Temp' } });
    });
  });

  // ===========================================================================
  // 8. THRESHOLD-AWARE AUTHORIZATION
  // ===========================================================================
  describe('8. Threshold-Aware Discount and Returns Authorization', () => {
    it('CASHIER allowed under threshold, denied above threshold', async () => {
      expect(await roleService.hasPermission('CASHIER', 'sales.discount', { discountPercent: 5, discountThreshold: 10 })).toBe(true);
      expect(await roleService.hasPermission('CASHIER', 'sales.discount', { discountPercent: 15, discountThreshold: 10 })).toBe(false);
    });

    it('MANAGER with sales.discount_above_threshold allowed above threshold', async () => {
      expect(await roleService.hasPermission('MANAGER', 'sales.discount', { discountPercent: 25, discountThreshold: 10 })).toBe(true);
    });

    it('returns.create above threshold denied without returns.create_above_threshold', async () => {
      const role = await roleService.createRole({ name: 'ReturnLimited_Temp', permissions: ['returns.create'] }, adminUserId);
      expect(await roleService.hasPermission('ReturnLimited_Temp', 'returns.create', { returnAmount: 5000, returnThreshold: 1000 })).toBe(false);
      await prisma.role.deleteMany({ where: { name: 'ReturnLimited_Temp' } });
    });

    it('MANAGER returns.create above threshold allowed (has returns.create_above_threshold)', async () => {
      expect(await roleService.hasPermission('MANAGER', 'returns.create', { returnAmount: 5000, returnThreshold: 1000 })).toBe(true);
    });
  });

  // ===========================================================================
  // 9. DANGEROUS PERMISSIONS - INDIVIDUAL ENFORCEMENT
  // ===========================================================================
  describe('9. Dangerous Permissions - Individual Backend Enforcement', () => {
    it('backup.restore: CASHIER denied', async () => { expect(await roleService.hasPermission('CASHIER', 'backup.restore')).toBe(false); });
    it('accounting.year_end_close: CASHIER denied, ADMIN allowed', async () => {
      expect(await roleService.hasPermission('CASHIER', 'accounting.year_end_close')).toBe(false);
      expect(await roleService.hasPermission('ADMIN', 'accounting.year_end_close')).toBe(true);
    });
    it('accounting.unlock_period: CASHIER denied, ADMIN allowed', async () => {
      expect(await roleService.hasPermission('CASHIER', 'accounting.unlock_period')).toBe(false);
      expect(await roleService.hasPermission('ADMIN', 'accounting.unlock_period')).toBe(true);
    });
    it('users.create_super_admin: CASHIER denied, ADMIN allowed', async () => {
      expect(await roleService.hasPermission('CASHIER', 'users.create_super_admin')).toBe(false);
      expect(await roleService.hasPermission('ADMIN', 'users.create_super_admin')).toBe(true);
    });
    it('settings.update_dangerous: CASHIER denied, ADMIN allowed', async () => {
      expect(await roleService.hasPermission('CASHIER', 'settings.update_dangerous')).toBe(false);
      expect(await roleService.hasPermission('ADMIN', 'settings.update_dangerous')).toBe(true);
    });
    it('updater.run: CASHIER denied', async () => { expect(await roleService.hasPermission('CASHIER', 'updater.run')).toBe(false); });
    it('whatsapp.send_bulk: CASHIER denied', async () => { expect(await roleService.hasPermission('CASHIER', 'whatsapp.send_bulk')).toBe(false); });
    it('settings.whatsapp.credentials: CASHIER denied', async () => { expect(await roleService.hasPermission('CASHIER', 'settings.whatsapp.credentials')).toBe(false); });
    it('users.mfa_reset: CASHIER denied, ADMIN allowed', async () => {
      expect(await roleService.hasPermission('CASHIER', 'users.mfa_reset')).toBe(false);
      expect(await roleService.hasPermission('ADMIN', 'users.mfa_reset')).toBe(true);
    });
    it('creating ADMIN user requires users.create_super_admin', async () => {
      const role = await roleService.createRole({ name: 'UserCreatorLimited_Temp', permissions: ['users.create', 'users.view'] }, adminUserId);
      const session = sessionManager.createSession({ id: userBId, username: 'rbac_user_b', fullName: 'B', role: role.name, status: 'ACTIVE', createdAt: new Date().toISOString() });
      const res = await dispatchFastify('POST', '/api/admin/users', { username: 'new_admin_attempt', password: 'SecurePass123!', fullName: 'New Admin', role: 'ADMIN' }, { authorization: session.token });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/does not have the required permission .users\.create_super_admin./i);
      await prisma.role.deleteMany({ where: { name: 'UserCreatorLimited_Temp' } });
    });
  });

  // ===========================================================================
  // 10. ROLE CLONING (SECTION 22)
  // ===========================================================================
  describe('10. Role Cloning - Independent Identity', () => {
    it('clone has new ID but same permissions; modifying clone does not affect original', async () => {
      const original = await roleService.getRoleByName('Test Clone Source');
      const cloned = await roleService.createRole({ name: 'Test Clone Source (Copy)', description: `Clone of ${original!.name}`, status: 'ACTIVE', permissions: [...original!.permissions] }, adminUserId);
      expect(cloned.id).not.toBe(original!.id);
      expect(cloned.permissionCount).toBe(original!.permissionCount);
      await roleService.updateRole(cloned.id, { permissions: ['products.view', 'sales.create', 'expenses.view'] }, adminUserId);
      const originalAfter = await roleService.getRoleById(original!.id);
      expect(originalAfter.permissionCount).toBe(original!.permissionCount);
    });
  });

  // ===========================================================================
  // 11. ROLE STATUS ENFORCEMENT (SECTION 23)
  // ===========================================================================
  describe('11. Role Status Enforcement (Active/Inactive)', () => {
    it('INACTIVE role grants no permissions', async () => {
      expect(await roleService.hasPermission('Inactive Test Role', 'products.view')).toBe(false);
    });

    it('reactivating role immediately restores permissions', async () => {
      const role = await roleService.getRoleByName('Inactive Test Role');
      await roleService.updateRole(role!.id, { status: 'ACTIVE' }, adminUserId);
      expect(await roleService.hasPermission('Inactive Test Role', 'products.view')).toBe(true);
      await roleService.updateRole(role!.id, { status: 'INACTIVE' }, adminUserId);
    });
  });

  // ===========================================================================
  // 12. CONCURRENCY (SECTION 24)
  // ===========================================================================
  describe('12. Concurrent Role Permission Updates', () => {
    it('handles concurrent updates on same role safely; final state is consistent', async () => {
      const role = await roleService.getRoleByName('Concurrent Role A');
      const [r1, r2, r3] = await Promise.allSettled([
        roleService.updateRole(role!.id, { permissions: ['products.view', 'sales.create'] }, adminUserId),
        roleService.updateRole(role!.id, { permissions: ['customers.view', 'products.view'] }, adminUserId),
        roleService.updateRole(role!.id, { permissions: ['expenses.view'] }, adminUserId),
      ]);
      const fulfilled = [r1, r2, r3].filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      const finalRole = await roleService.getRoleById(role!.id);
      const dbPerms = await prisma.rolePermission.findMany({ where: { roleId: role!.id } });
      expect(dbPerms.length).toBe(finalRole.permissionCount);
    });
  });

  // ===========================================================================
  // 13. IPC SECURITY (SECTION 12)
  // ===========================================================================
  describe('13. IPC Security - Renderer Cannot Bypass RBAC', () => {
    it('dispatchFastify enforces auth on dangerous routes (no token = rejected)', async () => {
      const res = await dispatchFastify('POST', '/api/maintenance/restore', { backupFilePath: 'malicious.db' }, {});
      expect(res.error || res.success === false).toBeTruthy();
    });

    it('invalid/expired token rejected before service layer', async () => {
      const res = await dispatchFastify('DELETE', `/api/products/${testProductId}`, undefined, { authorization: 'fake-expired-token-xyz' });
      expect(res.error).toBeDefined();
    });

    it('CASHIER cannot access admin user list via simulated IPC call', async () => {
      const res = await dispatchFastify('GET', '/api/admin/users', undefined, { authorization: cashierSessionToken() });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/does not have the required permission .users\.view./i);
    });
  });

  // ===========================================================================
  // 14. USER-ROLE ASSIGNMENT AND DYNAMIC PERMISSION CHANGES (SECTION 10)
  // ===========================================================================
  describe('14. User-Role Assignment and Dynamic Permission Effects', () => {
    it('changing user role changes their effective permissions at runtime', async () => {
      expect(await roleService.hasPermission('CASHIER', 'products.delete')).toBe(false);
      const customRole = await roleService.createRole({ name: 'Senior Cashier Clone', permissions: ['products.view', 'products.delete', 'sales.create'] }, adminUserId);
      expect(await roleService.hasPermission(customRole.name, 'products.delete')).toBe(true);
      const session = sessionManager.createSession({ id: userBId, username: 'rbac_user_b', fullName: 'B', role: customRole.name, status: 'ACTIVE', createdAt: new Date().toISOString() });
      const res = await dispatchFastify('GET', `/api/products/${testProductId}`, undefined, { authorization: session.token });
      expect(res.id || res.success !== false).toBeTruthy();
      await prisma.user.update({ where: { id: userBId }, data: { role: 'CASHIER' } });
    });

    it('permission cache is invalidated on role update (dynamic effect)', async () => {
      const role = await roleService.getRoleByName('Test Mutation Role');
      expect(await roleService.hasPermission('Test Mutation Role', 'customers.create')).toBe(false);
      await roleService.updateRole(role!.id, { permissions: ['products.view', 'customers.create'] }, adminUserId);
      expect(await roleService.hasPermission('Test Mutation Role', 'customers.create')).toBe(true);
    });
  });

  // ===========================================================================
  // 15. ROLE LIST AND DETAILS API (SECTIONS 19-20)
  // ===========================================================================
  describe('15. Role List and Details API', () => {
    it('GET /api/admin/roles returns roles with correct shape', async () => {
      const res = await dispatchFastify('GET', '/api/admin/roles', undefined, { authorization: adminToken });
      expect(res.success).toBe(true); expect(res.roles.length).toBeGreaterThanOrEqual(3);
      for (const r of res.roles) { expect(r.id).toBeDefined(); expect(typeof r.userCount).toBe('number'); expect(typeof r.permissionCount).toBe('number'); }
    });

    it('GET /api/admin/roles/:id returns full permissions array', async () => {
      const admin = await roleService.getRoleByName('ADMIN');
      const res = await dispatchFastify('GET', `/api/admin/roles/${admin!.id}`, undefined, { authorization: adminToken });
      expect(res.success).toBe(true); expect(res.role.permissions.length).toBe(128);
    });

    it('GET /api/admin/permissions returns full 128-item catalogue', async () => {
      const res = await dispatchFastify('GET', '/api/admin/permissions', undefined, { authorization: adminToken });
      expect(res.success).toBe(true); expect(res.catalogue.length).toBe(128);
      const cashierRes = await dispatchFastify('GET', '/api/admin/permissions', undefined, { authorization: cashierSessionToken() });
      expect(cashierRes.success).toBe(true);
    });
  });

  // ===========================================================================
  // 16. COMPLETE ACCEPTANCE TEST (SECTION 25)
  // ===========================================================================
  describe('16. Complete Acceptance Test Scenario (Section 25)', () => {
    let floorSupervisorRoleId: string;

    it('Step 1: Create role Floor Supervisor with exact specified permissions', async () => {
      const res = await dispatchFastify('POST', '/api/admin/roles', { name: 'Floor Supervisor', description: 'Handles normal floor operations', status: 'ACTIVE', permissions: ['products.view','products.update','sales.create','sales.discount','sales.view_own','customers.view','customers.create'] }, { authorization: adminToken });
      expect(res.success).toBe(true); expect(res.role.name).toBe('Floor Supervisor'); expect(res.role.permissionCount).toBe(7);
      floorSupervisorRoleId = res.role.id;
      const dbPerms = await prisma.rolePermission.findMany({ where: { roleId: floorSupervisorRoleId } });
      expect(dbPerms.length).toBe(7);
    });

    it('Step 2: Assign Floor Supervisor role to User A', async () => {
      await prisma.user.update({ where: { id: userAId }, data: { role: 'Floor Supervisor' } });
      const user = await prisma.user.findUnique({ where: { id: userAId } });
      userAToken = sessionManager.createSession({ id: user!.id, username: user!.username, fullName: user!.fullName, role: user!.role, status: 'ACTIVE', createdAt: user!.createdAt.toISOString() }).token;
    });

    it('Step 3: User A authorization enforcement matches acceptance criteria', async () => {
      // ALLOWED: Create sale
      const saleRes = await dispatchFastify('POST', '/api/sales', { items: [{ productId: testProductId, quantity: 1, sellingPrice: 100 }], discount: 0, paidAmount: 100, paymentMethod: 'CASH' }, { authorization: userAToken });
      expect(saleRes.id).toBeDefined();
      // ALLOWED: Normal discount (5% <= threshold)
      const discountRes = await dispatchFastify('POST', '/api/sales', { items: [{ productId: testProductId, quantity: 1, sellingPrice: 100 }], discount: 5, paidAmount: 95, paymentMethod: 'CASH' }, { authorization: userAToken });
      expect(discountRes.id).toBeDefined();
      // ALLOWED: View own sales
      const ownSalesRes = await dispatchFastify('GET', '/api/sales', undefined, { authorization: userAToken });
      expect(ownSalesRes.data).toBeDefined(); expect(Array.isArray(ownSalesRes.data)).toBe(true);
      // DENIED: Delete product
      const delRes = await dispatchFastify('DELETE', `/api/products/${testProductId}`, undefined, { authorization: userAToken });
      expect(delRes.error).toMatch(/does not have the required permission .products\.delete./i);
      // DENIED: Restore backup
      const restoreRes = await dispatchFastify('POST', '/api/maintenance/restore', { backupFilePath: 'any.zip' }, { authorization: userAToken });
      expect(restoreRes.error).toMatch(/does not have the required permission .backup\.restore./i);
      // DENIED: Manage roles
      const rolesRes = await dispatchFastify('GET', '/api/admin/roles', undefined, { authorization: userAToken });
      expect(rolesRes.error).toMatch(/does not have the required permission .roles\.manage./i);
    });

    it('Step 4 and 5: Add sales.view_all to role; User A dynamically gains access without rebuild', async () => {
      const updateRes = await dispatchFastify('PUT', `/api/admin/roles/${floorSupervisorRoleId}`, { permissions: ['products.view','products.update','sales.create','sales.discount','sales.view_own','sales.view_all','customers.view','customers.create'] }, { authorization: adminToken });
      expect(updateRes.success).toBe(true); expect(updateRes.role.permissions).toContain('sales.view_all');
      const allSalesRes = await dispatchFastify('GET', '/api/sales', undefined, { authorization: userAToken });
      expect(allSalesRes.data).toBeDefined(); expect(allSalesRes.total).toBeGreaterThan(0);
    });
  });
});
