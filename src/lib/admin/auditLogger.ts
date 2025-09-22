import { adminFirestore } from '@/lib/firebase/admin';
import { AdminAction } from '@/types/admin';

export interface AuditLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  action: AdminAction;
  targetUserId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditFilters {
  adminId?: string;
  targetUserId?: string;
  action?: AdminAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private static readonly COLLECTION = 'audit_logs';

  /**
   * Log an admin action
   */
  static async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      await adminFirestore.collection(this.COLLECTION).add({
        ...entry,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit logging should not break operations
    }
  }

  /**
   * Retrieve audit logs with filters
   */
  static async getLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
    let query = adminFirestore.collection(this.COLLECTION)
      .orderBy('timestamp', 'desc');

    if (filters.adminId) {
      query = query.where('adminId', '==', filters.adminId);
    }

    if (filters.targetUserId) {
      query = query.where('targetUserId', '==', filters.targetUserId);
    }

    if (filters.action) {
      query = query.where('action', '==', filters.action);
    }

    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }

    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    } as AuditLog));
  }

  /**
   * Generate an audit report
   */
  static async generateReport(startDate: Date, endDate: Date) {
    const logs = await this.getLogs({ startDate, endDate });

    const report = {
      period: { startDate, endDate },
      totalActions: logs.length,
      actionsByType: {} as Record<string, number>,
      actionsByAdmin: {} as Record<string, number>,
      uniqueAdmins: new Set(logs.map(log => log.adminId)).size,
      uniqueTargetUsers: new Set(logs.filter(log => log.targetUserId).map(log => log.targetUserId)).size
    };

    // Count actions by type and admin
    logs.forEach(log => {
      report.actionsByType[log.action] = (report.actionsByType[log.action] || 0) + 1;
      report.actionsByAdmin[log.adminEmail] = (report.actionsByAdmin[log.adminEmail] || 0) + 1;
    });

    return report;
  }
}