/**
 * Admin Report Management Routes
 * Handles viewing tracking and resolution management for multi-admin system
 */

import { RequestHandler } from "express";
import ReportModel from "../../shared/models/report";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * Mark report as viewed by current admin
 * POST /api/reports/:id/viewed
 */
export const markReportAsViewed: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUsername = req.admin?.username;

    if (!adminUsername) {
      res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
      return;
    }

    console.log(`📋 Marking report ${id} as viewed by ${adminUsername}`);

    // Find the report
    const report = await ReportModel.findById(id);
    
    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }

    // Mark as viewed using the model method
    await report.markViewedBy(adminUsername);

    console.log(`✅ Report ${id} marked as viewed by ${adminUsername}`);

    res.json({
      success: true,
      message: 'Report marked as viewed',
      viewedBy: report.viewedBy
    });

  } catch (error) {
    console.error('❌ Error marking report as viewed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Mark report as resolved by current admin
 * POST /api/reports/:id/resolve
 */
export const markReportAsResolved: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUsername = req.admin?.username;

    if (!adminUsername) {
      res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
      return;
    }

    console.log(`✅ Marking report ${id} as resolved by ${adminUsername}`);

    // Find the report
    const report = await ReportModel.findById(id);
    
    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }

    // Mark as resolved using the model method
    await report.markResolvedBy(adminUsername);

    console.log(`✅ Report ${id} resolved by ${adminUsername}`);

    res.json({
      success: true,
      message: 'Report marked as resolved',
      resolvedBy: report.resolvedBy,
      resolvedAt: report.resolved_at
    });

  } catch (error) {
    console.error('❌ Error marking report as resolved:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get escalation statistics for admin dashboard
 * GET /api/admin/escalation-stats
 */
export const getEscalationStats: RequestHandler = async (req: AuthRequest, res) => {
  try {
    console.log('📊 Getting escalation statistics...');

    // Get reports needing escalation
    const reportsNeedingEscalation = await ReportModel.findNeedingEscalation();
    
    // Get general statistics
    const totalReports = await ReportModel.countDocuments();
    const pendingReports = await ReportModel.countDocuments({ status: 'pending' });
    const resolvedReports = await ReportModel.countDocuments({ status: 'resolved' });
    const reportsWithNoViews = await ReportModel.countDocuments({ 
      status: 'pending', 
      viewedBy: { $size: 0 } 
    });

    // Calculate age statistics for unresolved reports
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    
    const reportsOlderThan2Hours = await ReportModel.countDocuments({
      status: { $ne: 'resolved' },
      createdAt: { $lt: twoHoursAgo }
    });
    
    const reportsOlderThan5Hours = await ReportModel.countDocuments({
      status: { $ne: 'resolved' },
      createdAt: { $lt: fiveHoursAgo }
    });

    const stats = {
      needingEscalation: reportsNeedingEscalation.length,
      total: totalReports,
      pending: pendingReports,
      resolved: resolvedReports,
      withNoViews: reportsWithNoViews,
      olderThan2Hours: reportsOlderThan2Hours,
      olderThan5Hours: reportsOlderThan5Hours,
      escalationDetails: reportsNeedingEscalation.map(report => ({
        id: report._id,
        shortId: report.shortId,
        status: report.status,
        priority: report.priority,
        createdAt: report.createdAt,
        viewedBy: report.viewedBy,
        lastEscalationSentAt: report.lastEscalationSentAt,
        ageInHours: Math.floor((Date.now() - report.createdAt.getTime()) / (1000 * 60 * 60))
      }))
    };

    console.log(`📊 Escalation stats: ${stats.needingEscalation} reports need escalation`);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error getting escalation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export default {
  markReportAsViewed,
  markReportAsResolved,
  getEscalationStats
};