import { getPrismaClient } from '../../database/client';
import { PasswordHasher } from '../../security/password.hasher';
import { sessionManager } from './session.manager';
import { auditService } from '../audit/audit.service';
import { UserManagementDTO, CreateUserDTO, UpdateUserDTO, Role, Status } from '../../../shared/types';
import { CreateUserSchema, UpdateUserSchema } from '../../../shared/schemas';

export class UserManagementService {
  /**
   * Lists all users in the system.
   */
  async listUsers(): Promise<UserManagementDTO[]> {
    const prisma = getPrismaClient();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role as Role,
      status: u.status as Status,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /**
   * Creates a new user with validation and password hashing.
   */
  async createUser(input: CreateUserDTO, adminUserId: string): Promise<UserManagementDTO> {
    const validated = CreateUserSchema.parse(input);
    const prisma = getPrismaClient();

    const existing = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (existing) {
      throw new Error(`Username "${validated.username}" already exists.`);
    }

    const passwordHash = await PasswordHasher.hash(validated.password);

    const user = await prisma.user.create({
      data: {
        username: validated.username,
        passwordHash,
        fullName: validated.fullName,
        role: validated.role,
        status: 'ACTIVE',
      },
    });

    await auditService.log({
      userId: adminUserId,
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: user.id,
      newValue: { username: user.username, role: user.role, fullName: user.fullName },
    });

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as Role,
      status: user.status as Status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Updates an existing user (full name, role, status, password).
   * Prevents deactivating or demoting the last active Administrator.
   */
  async updateUser(id: string, input: UpdateUserDTO, adminUserId: string): Promise<UserManagementDTO> {
    const validated = UpdateUserSchema.parse(input);
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error(`User with ID ${id} not found.`);
    }

    // Protection rule: Cannot deactivate or demote the last active Administrator
    if (user.role === 'ADMIN' && (validated.status === 'INACTIVE' || (validated.role && validated.role !== 'ADMIN'))) {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
          id: { not: id },
        },
      });

      if (activeAdminCount === 0) {
        throw new Error('Cannot deactivate or change role of the last active Administrator.');
      }
    }

    const dataToUpdate: any = {};
    if (validated.fullName) dataToUpdate.fullName = validated.fullName;
    if (validated.role) dataToUpdate.role = validated.role;
    if (validated.status) dataToUpdate.status = validated.status;

    if (validated.password) {
      dataToUpdate.passwordHash = await PasswordHasher.hash(validated.password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    // If user was deactivated, terminate all active sessions immediately
    if (validated.status === 'INACTIVE') {
      sessionManager.terminateOtherSessionsForUser(id);
    }

    await auditService.log({
      userId: adminUserId,
      action: 'USER_UPDATE',
      entityType: 'User',
      entityId: id,
      oldValue: { role: user.role, status: user.status, fullName: user.fullName },
      newValue: { role: updated.role, status: updated.status, fullName: updated.fullName, passwordChanged: Boolean(validated.password) },
    });

    if (user.role !== updated.role) {
      await auditService.log({
        userId: adminUserId,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: id,
        oldValue: { role: user.role },
        newValue: { role: updated.role },
      });
    }


    return {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role as Role,
      status: updated.status as Status,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}

export const userManagementService = new UserManagementService();
