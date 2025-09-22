import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/adminAuth';
import { AuditLogger } from '@/lib/admin/auditLogger';
import { AdminAction } from '@/types/admin';

/**
 * GET /api/admin/audit
 * Gets audit logs with filters
 */
export const GET = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters from query params
    const filters: any = {};
    
    const adminId = searchParams.get('adminId');
    if (adminId) filters.adminId = adminId;
    
    const targetUserId = searchParams.get('targetUserId');
    if (targetUserId) filters.targetUserId = targetUserId;
    
    const action = searchParams.get('action');
    if (action) filters.action = action as AdminAction;
    
    const startDate = searchParams.get('startDate');
    if (startDate) filters.startDate = new Date(startDate);
    
    const endDate = searchParams.get('endDate');
    if (endDate) filters.endDate = new Date(endDate);
    
    const limit = searchParams.get('limit');
    if (limit) filters.limit = parseInt(limit);
    
    const offset = searchParams.get('offset');
    if (offset) filters.offset = parseInt(offset);
    
    // Fetch logs
    const logs = await AuditLogger.getLogs(filters);
    
    return NextResponse.json({
      logs,
      filters,
      retrievedBy: context.user.uid,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch audit logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/audit/report
 * Generates an audit report
 */
export const POST = withAdminAuth(async (request: NextRequest, context) => {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: startDate and endDate' },
        { status: 400 }
      );
    }
    
    const report = await AuditLogger.generateReport(
      new Date(startDate),
      new Date(endDate)
    );
    
    return NextResponse.json({
      report,
      generatedBy: context.user.uid,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating audit report:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate audit report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});