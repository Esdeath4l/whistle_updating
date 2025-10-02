import express from 'express';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import ReportModel from '../../shared/models/report.js';
import AdminModel from '../models/admin.js';
import { authenticateAdmin, requirePermission, requireRole, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Enhanced Admin Reports Management with GridFS Support
 */

// Initialize GridFS
let gfsBucket: GridFSBucket;
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

/**
 * Get all reports with advanced filtering and pagination
 * GET /api/admin/reports
 */
router.get('/reports', 
  authenticateAdmin, 
  requirePermission('can_view_reports'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        type,
        priority,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        dateFrom,
        dateTo
      } = req.query;

      // Build filter query
      const filter: any = {};
      
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (priority) filter.priority = priority;
      
      if (search) {
        filter.$or = [
          { shortId: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
      }

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Execute query with pagination
      const reports = await ReportModel.find(filter)
        .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limitNum)
        .select('-encrypted_data -encryption_iv -encryption_auth_tag');

      const totalReports = await ReportModel.countDocuments(filter);
      const totalPages = Math.ceil(totalReports / limitNum);

      // Get summary statistics
      const stats = await ReportModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalReports,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1
          },
          stats: stats[0] || {
            total: 0, pending: 0, in_progress: 0, resolved: 0, urgent: 0, high: 0
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching admin reports:', error);
      res.status(500).json({
        error: 'Failed to fetch reports',
        message: 'An error occurred while fetching reports'
      });
    }
  }
);

/**
 * Get single report with decrypted content
 * GET /api/admin/reports/:id
 */
router.get('/reports/:id',
  authenticateAdmin,
  requirePermission('can_view_reports'),
  async (req, res) => {
    try {
      const report = await ReportModel.findById(req.params.id)
        .select('+encrypted_data +encryption_iv +encryption_auth_tag');

      if (!report) {
        return res.status(404).json({
          error: 'Report not found',
          message: 'No report found with the specified ID'
        });
      }

      // Get decrypted message
      const decryptedMessage = report.getDecryptedMessage();
      
      // Prepare response with decrypted content
      const reportData = {
        ...report.toJSON(),
        decryptedMessage,
        hasMedia: !!(report.photo_file_id || report.video_file_id)
      };

      res.json({
        success: true,
        data: reportData
      });

    } catch (error) {
      console.error('❌ Error fetching report:', error);
      res.status(500).json({
        error: 'Failed to fetch report',
        message: 'An error occurred while fetching the report'
      });
    }
  }
);

/**
 * Update report status and add admin notes
 * PUT /api/admin/reports/:id
 */
router.put('/reports/:id',
  authenticateAdmin,
  requirePermission('can_resolve_reports'),
  async (req: AuthRequest, res) => {
    try {
      const { status, admin_notes, escalate } = req.body;
      const adminUser = req.adminUser;

      const report = await ReportModel.findById(req.params.id);
      if (!report) {
        return res.status(404).json({
          error: 'Report not found',
          message: 'No report found with the specified ID'
        });
      }

      // Prepare update data
      const updateData: any = {};
      
      if (status) {
        updateData.status = status;
        
        // Auto-set timestamps based on status
        if (status === 'resolved' && !report.resolved_at) {
          updateData.resolved_at = new Date();
        }
      }

      if (admin_notes) {
        updateData.admin_notes = admin_notes;
      }

      if (escalate && adminUser?.hasPermission('can_escalate_reports')) {
        updateData.status = 'escalated';
        updateData.escalated_at = new Date();
      }

      // Update the report
      const updatedReport = await ReportModel.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      console.log(`✅ Report ${report.shortId} updated by ${adminUser?.email}`);

      res.json({
        success: true,
        message: 'Report updated successfully',
        data: updatedReport
      });

    } catch (error) {
      console.error('❌ Error updating report:', error);
      res.status(500).json({
        error: 'Failed to update report',
        message: 'An error occurred while updating the report'
      });
    }
  }
);

/**
 * Get report media file (photo/video)
 * GET /api/admin/reports/:id/media/:type
 */
router.get('/reports/:id/media/:type',
  authenticateAdmin,
  requirePermission('can_view_reports'),
  async (req, res) => {
    try {
      const { id, type } = req.params;
      
      if (!['photo', 'video'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid media type',
          message: 'Media type must be either photo or video'
        });
      }

      const report = await ReportModel.findById(id);
      if (!report) {
        return res.status(404).json({
          error: 'Report not found',
          message: 'No report found with the specified ID'
        });
      }

      const fileId = type === 'photo' ? report.photo_file_id : report.video_file_id;
      if (!fileId) {
        return res.status(404).json({
          error: 'Media not found',
          message: `No ${type} found for this report`
        });
      }

      // Stream file from GridFS
      const downloadStream = gfsBucket.openDownloadStream(
        new mongoose.Types.ObjectId(fileId)
      );

      downloadStream.on('error', (error) => {
        console.error(`❌ Error streaming ${type}:`, error);
        res.status(404).json({
          error: 'Media not found',
          message: 'The requested media file could not be found'
        });
      });

      // Set appropriate content type
      const contentType = type === 'photo' ? 'image/jpeg' : 'video/mp4';
      res.set('Content-Type', contentType);
      
      downloadStream.pipe(res);

    } catch (error) {
      console.error('❌ Error fetching media:', error);
      res.status(500).json({
        error: 'Failed to fetch media',
        message: 'An error occurred while fetching the media file'
      });
    }
  }
);

/**
 * Export reports data
 * GET /api/admin/reports/export
 */
router.get('/export',
  authenticateAdmin,
  requirePermission('can_export_data'),
  async (req: AuthRequest, res) => {
    try {
      const { format = 'csv', dateFrom, dateTo } = req.query;

      // Build filter for export
      const filter: any = {};
      if (dateFrom) filter.createdAt = { $gte: new Date(dateFrom as string) };
      if (dateTo) {
        filter.createdAt = filter.createdAt || {};
        filter.createdAt.$lte = new Date(dateTo as string);
      }

      const reports = await ReportModel.find(filter)
        .select('-encrypted_data -encryption_iv -encryption_auth_tag')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        // Generate CSV
        const csvHeaders = [
          'ID', 'Short ID', 'Type', 'Priority', 'Status', 'Message',
          'Location', 'Created At', 'Admin Notes', 'Resolved At'
        ];
        
        const csvRows = reports.map(report => [
          report._id,
          report.shortId,
          report.type,
          report.priority,
          report.status,
          report.message?.replace(/"/g, '""') || '',
          report.location ? `${report.location.lat},${report.location.lng}` : '',
          report.createdAt?.toISOString(),
          report.admin_notes?.replace(/"/g, '""') || '',
          report.resolved_at?.toISOString() || ''
        ]);

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="reports-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        // Return JSON format
        res.json({
          success: true,
          data: {
            reports,
            exportDate: new Date().toISOString(),
            totalCount: reports.length
          }
        });
      }

      console.log(`✅ Reports exported by ${req.adminUser?.email}`);

    } catch (error) {
      console.error('❌ Error exporting reports:', error);
      res.status(500).json({
        error: 'Export failed',
        message: 'An error occurred while exporting reports'
      });
    }
  }
);

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 */
router.get('/dashboard/stats',
  authenticateAdmin,
  requirePermission('can_view_reports'),
  async (req, res) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalReports,
        todayReports,
        weekReports,
        monthReports,
        urgentReports,
        pendingReports,
        statusDistribution,
        typeDistribution
      ] = await Promise.all([
        ReportModel.countDocuments(),
        ReportModel.countDocuments({ createdAt: { $gte: today } }),
        ReportModel.countDocuments({ createdAt: { $gte: thisWeek } }),
        ReportModel.countDocuments({ createdAt: { $gte: thisMonth } }),
        ReportModel.countDocuments({ priority: 'urgent', status: { $ne: 'resolved' } }),
        ReportModel.countDocuments({ status: 'pending' }),
        ReportModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        ReportModel.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ])
      ]);

      // Get reports needing escalation
      const escalationNeeded = await ReportModel.findNeedingEscalation();

      res.json({
        success: true,
        data: {
          overview: {
            totalReports,
            todayReports,
            weekReports,
            monthReports,
            urgentReports,
            pendingReports,
            escalationNeeded: escalationNeeded.length
          },
          distributions: {
            status: statusDistribution,
            type: typeDistribution
          },
          needsAttention: escalationNeeded.map(report => ({
            id: report._id,
            shortId: report.shortId,
            type: report.type,
            priority: report.priority,
            ageInHours: report.ageInHours,
            createdAt: report.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      res.status(500).json({
        error: 'Failed to fetch statistics',
        message: 'An error occurred while fetching dashboard statistics'
      });
    }
  }
);

export default router;