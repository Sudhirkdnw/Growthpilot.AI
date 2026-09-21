import { getPrismaClient } from '../../database/client';

export interface LogActionParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: any;
  newValue?: any;
  reason?: string | null;
}

export class AuditService {
  /**
   * Appends an immutable record to the audit_logs table.
   */
  async log(params: LogActionParams, tx?: any): Promise<void> {
    const client = tx || getPrismaClient();
    try {
      await client.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId || null,
          oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
          newValue: params.newValue ? JSON.stringify(params.newValue) : null,
          reason: params.reason || null,
        },
      });
    } catch (err) {
      console.error('[AuditService] Failed to write audit log:', err);
      // Non-blocking for application flow unless inside a required strict tx
    }
  }

  /**
   * Retrieves paginated audit logs for admin review.
   */
  async listLogs(page = 1, pageSize = 50) {
    const client = getPrismaClient();
    const skip = (page - 1) * pageSize;
    const [logs, total] = await Promise.all([
      client.auditLog.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, fullName: true, role: true },
          },
        },
      }),
      client.auditLog.count(),
    ]);

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const auditService = new AuditService();
