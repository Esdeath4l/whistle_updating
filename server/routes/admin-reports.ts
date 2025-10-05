import { RequestHandler } from "express";
import { GetReportsResponse, UpdateReportRequest, ReportStatus, ReportCategory, ReportSeverity, LocationData } from "../../shared/api";
import ReportModel from "../../shared/models/report";
import { AuthRequest, requireAdmin } from "../middleware/authMiddleware";
import { DataEncryption } from "../utils/encryption";
import { notifyReportUpdate } from "../utils/notificationHelpers";
import { clearEscalationHistory } from "../utils/escalation";

/**
 * Admin-specific report management routes with status filtering
 * Protected routes requiring admin authentication
 */

// Helper function to map API status to internal status
const mapAPIStatusToInternalStatus = (status: ReportStatus): 'pending' | 'in-progress' | 'resolved' | 'escalated' | 'reviewed' | 'flagged' => {
  switch (status) {
    case 'reviewed':
      return 'in-progress';
    case 'flagged':
      return 'escalated';
    case 'pending':
    case 'resolved':
      return status;
    default:
      return 'pending';
  }
};

// Helper function to map internal status to API status
const mapStatusToAPIStatus = (status: string): ReportStatus => {
  switch (status) {
    case 'in-progress':
      return 'reviewed';
    case 'escalated':
      return 'flagged';
    case 'pending':
    case 'resolved':
      return status as ReportStatus;
    default:
      return 'pending';
  }
};

// Helper function to map internal location to API location
const mapLocationToAPILocation = (location: any): LocationData | undefined => {
  if (!location) return undefined;
  
  return {
    latitude: location.lat || location.latitude || 0,
    longitude: location.lng || location.longitude || 0,
    accuracy: location.accuracy || 0,
    altitude: location.altitude,
    altitudeAccuracy: location.altitudeAccuracy,
    heading: location.heading,
    speed: location.speed,
    timestamp: location.timestamp || Date.now(),
    address: location.address,
    capturedAt: location.capturedAt,
    source: location.source || 'browser_gps'
  };
};

/**
 * Enhanced admin reports retrieval with comprehensive decryption and filtering
 * 
 * Features:
 * - Fetch all reports from MongoDB with decryption
 * - Display shortId as Report ID instead of ObjectId
 * - Dropdown filter (Pending, Reviewed, Flagged, Resolved) works correctly
 * - Ensure all reports are marked as encrypted (is_encrypted = true)
 * - Graceful error handling for decryption failures
 */
export const getAdminReports: RequestHandler = async (req: AuthRequest, res) => {
  try {
    console.log("📊 Enhanced admin dashboard: Fetching reports for admin user:", req.user?.username);
    
    // Extract status filter from query parameters
    const statusFilter = req.query.status as string;
    console.log("🔍 Status filter applied:", statusFilter || "all");
    
    // Build filter query based on status parameter
    let filterQuery: any = {};
    if (statusFilter && statusFilter !== "all") {
      // Map API status to internal status for database query
      const internalStatus = mapAPIStatusToInternalStatus(statusFilter as ReportStatus);
      filterQuery.status = internalStatus;
    }
    
    // Get reports with ALL encrypted fields included for comprehensive decryption
    const reports = await ReportModel.find(filterQuery)
      .select('+message_encrypted +message_iv +message_salt +location_encrypted +location_iv +location_salt +reporterEmail_encrypted +reporterEmail_iv +reporterEmail_salt +admin_notes_encrypted +admin_notes_iv +admin_notes_salt +priority_encrypted +priority_iv +priority_salt +status_encrypted +status_iv +status_salt +encrypted_message +encryption_iv +encryption_auth_tag +encrypted_data')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    console.log(`📋 Found ${reports.length} reports to process (filter: ${statusFilter || "all"})`);

    // Ensure all reports are marked as encrypted and decrypt them
    const processedReports = await Promise.all(reports.map(async (report: any) => {
      try {
        // Fix encryption flag if missing
        if (report.is_encrypted !== true) {
          console.log(`🔧 Fixing missing encryption flag for ${report.shortId}`);
          await ReportModel.updateOne(
            { _id: report._id },
            { $set: { is_encrypted: true } }
          );
          report.is_encrypted = true;
        }
        
        // Decrypt the report using comprehensive decryption
        let decryptedReport;
        try {
          decryptedReport = await DataEncryption.decryptReportDocument(report);
        } catch (decryptError) {
          console.error(`❌ Decryption failed for ${report.shortId}:`, decryptError);
          // Use original report if decryption fails, but log the error
          decryptedReport = report;
        }
        
        // Get file metadata from GridFS
        const fileMetadata: any = {};
        
        if (report.photo_file_id) {
          try {
            const { getFile } = require("../utils/gridfs");
            const photoInfo = await getFile(report.photo_file_id);
            fileMetadata.photo = {
              id: report.photo_file_id,
              filename: photoInfo.filename,
              contentType: photoInfo.contentType,
              size: photoInfo.metadata?.length || 0,
              uploadDate: photoInfo.metadata?.uploadDate
            };
          } catch (error) {
            console.warn(`⚠️ Could not get photo metadata for ${report.shortId}`);
          }
        }

        if (report.video_file_id) {
          try {
            const { getFile } = require("../utils/gridfs");
            const videoInfo = await getFile(report.video_file_id);
            fileMetadata.video = {
              id: report.video_file_id,
              filename: videoInfo.filename,
              contentType: videoInfo.contentType,
              size: videoInfo.metadata?.length || 0,
              uploadDate: videoInfo.metadata?.uploadDate
            };
          } catch (error) {
            console.warn(`⚠️ Could not get video metadata for ${report.shortId}`);
          }
        }

        return {
          id: report.shortId, // Use shortId as the primary ID for display
          _id: report._id.toString(), // Keep internal _id for compatibility
          shortId: report.shortId, // Always include shortId prominently
          message: report.message || '[NO MESSAGE]',
          category: (report.category || report.type || 'feedback') as ReportCategory,
          severity: (report.severity || report.priority || 'medium') as ReportSeverity,
          status: mapStatusToAPIStatus(report.status || 'pending'),
          photo_url: report.photo_url,
          video_url: report.video_url,
          video_metadata: report.video_metadata,
          photo_file_id: report.photo_file_id,
          video_file_id: report.video_file_id,
          files: fileMetadata,
          location: mapLocationToAPILocation(report.location),
          created_at: report.createdAt?.toISOString() || new Date().toISOString(),
          updated_at: report.updatedAt?.toISOString() || new Date().toISOString(),
          is_encrypted: report.is_encrypted || false,
          admin_comment: report.admin_comment,
          admin_notes: report.admin_notes,
          resolved_at: report.resolved_at?.toISOString(),
          escalated_at: report.escalated_at?.toISOString(),
          moderation_result: report.moderation_result,
          reporterEmail: report.reporterEmail // Include decrypted email for admin
        };
      } catch (error) {
        console.warn("⚠️ Error processing report:", report._id, error);
        // Return basic report data if processing fails
        return {
          id: report.shortId || report._id.toString(),
          _id: report._id.toString(),
          shortId: report.shortId || report._id.toString(),
          message: report.message || "[Processing error]",
          category: (report.category || report.type || 'feedback') as ReportCategory,
          severity: (report.severity || report.priority || 'medium') as ReportSeverity,
          status: mapStatusToAPIStatus(report.status || 'pending'),
          created_at: report.createdAt?.toISOString() || new Date().toISOString(),
          updated_at: report.updatedAt?.toISOString() || new Date().toISOString(),
          is_encrypted: report.is_encrypted || false
        };
      }
    }));

    const response: GetReportsResponse = {
      reports: processedReports,
      total: processedReports.length
    };

    console.log(`✅ Admin dashboard: ${processedReports.length} reports processed and decrypted for admin view (filter: ${statusFilter || "all"})`);
    res.json(response);
  } catch (error) {
    console.error("❌ Error fetching admin reports:", error);
    res.status(500).json({ error: "Failed to fetch admin reports" });
  }
};

/**
 * Update report status and add admin comments
 */
export const updateReportStatus: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updateData: UpdateReportRequest = req.body;
    
    console.log(`🔄 Admin updating report ${id}:`, updateData);

    // Try to find report by either MongoDB ObjectId or shortId
    let report;
    
    // Check if the id is a valid MongoDB ObjectId (24 hex characters)
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a MongoDB ObjectId
      report = await ReportModel.findById(id);
    } else {
      // It's likely a shortId
      report = await ReportModel.findOne({ shortId: id });
    }
    
    if (!report) {
      console.log(`❌ Report not found: ${id}`);
      return res.status(404).json({ error: "Report not found" });
    }

    console.log(`✅ Found report: ${report.shortId} (${report._id})`);

    // Update fields if provided
    if (updateData.status) {
      const internalStatus = mapAPIStatusToInternalStatus(updateData.status);
      report.status = internalStatus;
      console.log(`📝 Status updated: ${updateData.status} -> ${internalStatus}`);
    }
    
    if (updateData.admin_response) {
      report.admin_notes = updateData.admin_response;
      console.log(`📝 Admin response added: ${updateData.admin_response}`);
    }

    await report.save();

    // Clear escalation history when report is processed (no longer pending)
    if (updateData.status && updateData.status !== 'pending') {
      clearEscalationHistory(report.shortId);
      console.log(`🧹 Cleared escalation history for processed report: ${report.shortId}`);
    }

    // Send notification about status update
    notifyReportUpdate(report._id.toString(), {
      shortId: report.shortId,
      _id: report._id.toString(),
      oldStatus: report.status,
      newStatus: updateData.status || report.status as any,
      adminComment: updateData.admin_response,
      adminUser: req.user?.username || "Unknown Admin"
    });

    console.log(`✅ Report ${id} updated successfully`);
    res.json({ 
      success: true, 
      message: "Report updated successfully",
      report: {
        id: report.shortId, // Use shortId as primary display ID
        _id: report._id.toString(),
        shortId: report.shortId,
        status: mapStatusToAPIStatus(report.status),
        admin_notes: report.admin_notes,
        updated_at: report.updatedAt?.toISOString()
      }
    });
  } catch (error) {
    console.error("❌ Error updating report:", error);
    res.status(500).json({ error: "Failed to update report" });
  }
};

/**
 * Get detailed report information by ID or shortId for admin panel modal
 * Supports both regular MongoDB ObjectId and shortId for flexible access
 */
export const getAdminReportDetails: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Admin fetching report details by ID/shortId: ${id}`);
    
    // Try to find by shortId first, then by _id if shortId fails
    let report = await ReportModel.findOne({ shortId: id })
      .select('+message_encrypted +message_iv +message_salt +location_encrypted +location_iv +location_salt +reporterEmail_encrypted +reporterEmail_iv +reporterEmail_salt +admin_notes_encrypted +admin_notes_iv +admin_notes_salt +encrypted_message +encryption_iv +encryption_auth_tag +encrypted_data')
      .lean();
    
    // If not found by shortId, try by _id (MongoDB ObjectId)
    if (!report) {
      try {
        report = await ReportModel.findById(id)
          .select('+message_encrypted +message_iv +message_salt +location_encrypted +location_iv +location_salt +reporterEmail_encrypted +reporterEmail_iv +reporterEmail_salt +admin_notes_encrypted +admin_notes_iv +admin_notes_salt +encrypted_message +encryption_iv +encryption_auth_tag +encrypted_data')
          .lean();
      } catch (error) {
        console.log(`⚠️ Invalid ObjectId format: ${id}`);
      }
    }
    
    if (!report) {
      console.log(`❌ Report not found with ID/shortId: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    // Decrypt report data using the new decryption utility
    console.log(`🔓 Decrypting report: ${report.shortId}`);
    const decryptedReport = await DataEncryption.decryptReportDocument(report);

    // Get file metadata from GridFS
    const fileMetadata: any = {};
    
    if (report.photo_file_id) {
      try {
        const { getFile } = require("../utils/gridfs");
        const photoInfo = await getFile(report.photo_file_id);
        fileMetadata.photo = {
          id: report.photo_file_id,
          filename: photoInfo.filename,
          contentType: photoInfo.contentType,
          size: photoInfo.metadata?.length || 0,
          uploadDate: photoInfo.metadata?.uploadDate,
        };
      } catch (error) {
        console.warn(`⚠️ Could not load photo metadata for ${report.photo_file_id}:`, error);
      }
    }

    if (report.video_file_id) {
      try {
        const { getFile } = require("../utils/gridfs");
        const videoInfo = await getFile(report.video_file_id);
        fileMetadata.video = {
          id: report.video_file_id,
          filename: videoInfo.filename,
          contentType: videoInfo.contentType,
          size: videoInfo.metadata?.length || 0,
          uploadDate: videoInfo.metadata?.uploadDate,
        };
      } catch (error) {
        console.warn(`⚠️ Could not load video metadata for ${report.video_file_id}:`, error);
      }
    }

    console.log(`✅ Admin report details retrieved for: ${report.shortId}`);
    res.json({
      success: true,
      report: decryptedReport,
      fileMetadata
    });

  } catch (error) {
    console.error("❌ Error fetching admin report details:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report details"
    });
  }
};

/**
 * Get single report details by shortId for map modal display
 */
export const getReportByShortId: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { shortId } = req.params;
    console.log(`📋 Admin fetching report details by shortId: ${shortId}`);
    
    // Find report by shortId with encrypted fields for decryption
    const report = await ReportModel.findOne({ shortId })
      .select('+message_encrypted +message_iv +message_salt +location_encrypted +location_iv +location_salt +reporterEmail_encrypted +reporterEmail_iv +reporterEmail_salt +admin_notes_encrypted +admin_notes_iv +admin_notes_salt +encrypted_message +encryption_iv +encryption_auth_tag +encrypted_data')
      .lean();
    
    if (!report) {
      console.log(`❌ Report not found with shortId: ${shortId}`);
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    // Decrypt report data using the new decryption utility
    console.log(`🔓 Decrypting report: ${report.shortId}`);
    const decryptedReport = await DataEncryption.decryptReportDocument(report);

    // Get file metadata from GridFS
    const fileMetadata: any = {};
    
    if (report.photo_file_id) {
      try {
        const { getFile } = require("../utils/gridfs");
        const photoInfo = await getFile(report.photo_file_id);
        fileMetadata.photo = {
          id: report.photo_file_id,
          filename: photoInfo.filename,
          contentType: photoInfo.contentType,
          size: photoInfo.metadata?.length || 0,
          uploadDate: photoInfo.metadata?.uploadDate,
          url: `/api/files/${report.photo_file_id}` // GridFS file URL
        };
      } catch (error) {
        console.warn(`⚠️ Could not get photo metadata for ${report.shortId}`);
      }
    }

    if (report.video_file_id) {
      try {
        const { getFile } = require("../utils/gridfs");
        const videoInfo = await getFile(report.video_file_id);
        fileMetadata.video = {
          id: report.video_file_id,
          filename: videoInfo.filename,
          contentType: videoInfo.contentType,
          size: videoInfo.metadata?.length || 0,
          uploadDate: videoInfo.metadata?.uploadDate,
          url: `/api/files/${report.video_file_id}` // GridFS file URL
        };
      } catch (error) {
        console.warn(`⚠️ Could not get video metadata for ${report.shortId}`);
      }
    }

    // Format detailed response for modal display
    const detailedReport = {
      id: report.shortId, // Use shortId as primary display ID
      _id: report._id.toString(),
      shortId: report.shortId,
      message: decryptedReport.message || '[NO MESSAGE]',
      category: report.category || report.type || 'feedback',
      severity: report.severity || report.priority || 'medium',
      status: mapStatusToAPIStatus(report.status || 'pending'),
      location: mapLocationToAPILocation(decryptedReport.location),
      photo_file_id: report.photo_file_id,
      video_file_id: report.video_file_id,
      files: fileMetadata,
      is_encrypted: report.is_encrypted,
      created_at: report.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: report.updatedAt?.toISOString() || new Date().toISOString(),
      admin_notes: decryptedReport.admin_notes,
      reporterEmail: decryptedReport.reporterEmail,
      resolved_at: report.resolved_at?.toISOString(),
      escalated_at: report.escalated_at?.toISOString()
    };

    console.log(`✅ Report details retrieved and decrypted successfully: ${report.shortId}`);
    res.json({
      success: true,
      data: detailedReport,
      message: "Report details retrieved successfully"
    });

  } catch (error: any) {
    console.error("❌ Error fetching report details by shortId:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report details"
    });
  }
};