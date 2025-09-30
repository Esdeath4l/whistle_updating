import { RequestHandler } from "express";
import {
  Report as ReportType,
  CreateReportRequest,
  CreateReportResponse,
  GetReportsResponse,
  UpdateReportRequest,
  ReportStatus,
  ReportCategory,
  LocationData,
  ModerationResult,
} from "../../shared/api";
import ReportModel from "../../shared/models/report";
import AlertModel from "../../shared/models/Alert";
import { notifyNewReport } from "./notifications";
import { AuthService, AuthRequest } from "../utils/auth";
import { DataEncryption } from "../utils/encryption";
import { emailService } from "../email-service";
import { uploadFields, getFileUrl, cleanupFiles } from "../utils/fileUpload";

/**
 * Enhanced Reports Routes with JWT Authentication and Encryption
 * Handles report CRUD operations with secure data handling
 */

// Simple AI moderation (server-side backup)
function moderateContent(text: string): ModerationResult {
  const offensiveTerms = ["fuck", "shit", "kill", "die", "hate", "threat"];
  const lowercaseText = text.toLowerCase();
  const detectedTerms: string[] = [];

  offensiveTerms.forEach((term) => {
    if (lowercaseText.includes(term)) {
      detectedTerms.push(term);
    }
  });

  const isFlagged = detectedTerms.length > 0;
  const confidence = Math.min(detectedTerms.length * 0.3, 1);

  return {
    isFlagged,
    reason: isFlagged
      ? "Potentially inappropriate content detected"
      : undefined,
    confidence,
    detectedTerms,
  };
}

export const createReport: RequestHandler = async (req, res) => {
  try {
    console.log("🚀 Received report submission with enhanced features");
    console.log("📋 Request body keys:", Object.keys(req.body));
    console.log("📊 Request body size:", JSON.stringify(req.body).length + " characters");
    
    const {
      message,
      category,
      severity,
      photo_url,
      video_url,
      video_metadata,
      encrypted_data,
      is_encrypted,
      location,
      share_location,
      is_offline_sync,
    }: CreateReportRequest = req.body;

    // Validate video metadata if video is provided
    if (video_url && video_metadata) {
      const maxSizeMB = 100;
      const maxDurationMinutes = 5;
      const allowedFormats = ["video/mp4", "video/webm", "video/quicktime"];

      if (video_metadata.size > maxSizeMB * 1024 * 1024) {
        console.log("Error: Video file too large");
        return res.status(400).json({
          error: `Video file too large. Maximum size is ${maxSizeMB}MB`,
        });
      }

      if (video_metadata.duration > maxDurationMinutes * 60) {
        console.log("Error: Video duration too long");
        return res.status(400).json({
          error: `Video too long. Maximum duration is ${maxDurationMinutes} minutes`,
        });
      }

      if (!allowedFormats.includes(video_metadata.format)) {
        console.log("Error: Invalid video format");
        return res.status(400).json({
          error: `Invalid video format. Allowed formats: ${allowedFormats.join(", ")}`,
        });
      }

      console.log("Video validation passed:", {
        size: `${(video_metadata.size / 1024 / 1024).toFixed(2)}MB`,
        duration: `${(video_metadata.duration / 60).toFixed(2)}min`,
        format: video_metadata.format,
        isRecorded: video_metadata.isRecorded,
      });
    }

    // Handle both encrypted and plain text reports
    if (is_encrypted && encrypted_data) {
      // Encrypted report validation
      if (
        !encrypted_data.encryptedMessage ||
        !encrypted_data.encryptedCategory
      ) {
        console.log("Error: Encrypted data is incomplete");
        return res.status(400).json({ error: "Invalid encrypted data" });
      }
      console.log("Processing encrypted report with media");
    } else {
      // Plain text report validation
      if (!message || message.trim().length === 0) {
        console.log("Error: Message is required");
        return res.status(400).json({ error: "Message is required" });
      }

      if (!category) {
        console.log("Error: Category is required");
        return res.status(400).json({ error: "Category is required" });
      }

      const validCategories = [
        "harassment",
        "medical_emergency",
        "safety_emergency",
        "safety_concern",
        "feedback",
      ];
      if (!validCategories.includes(category)) {
        console.log("Error: Invalid category:", category);
        return res.status(400).json({ error: "Invalid category" });
      }
      console.log("Processing plain text report");
    }

    const validSeverities = ["low_priority", "medium_priority", "high_priority", "urgent"];
    if (severity && !validSeverities.includes(severity)) {
      console.log("Error: Invalid severity:", severity);
      return res.status(400).json({ error: "Invalid severity level" });
    }

    // Apply AI moderation if not encrypted
    let moderation: ModerationResult | undefined;
    if (!is_encrypted && message) {
      moderation = moderateContent(message);
    }

    // Prepare report data for encryption if contains sensitive information
    let reportData: any = {
      message: is_encrypted ? "[ENCRYPTED]" : (message || "").trim(),
      category: is_encrypted
        ? ("harassment" as ReportCategory)
        : category || "feedback",
      severity: severity || "medium_priority",
      photo_url: is_encrypted ? undefined : photo_url,
      video_url: is_encrypted ? undefined : video_url,
      video_metadata: is_encrypted ? undefined : video_metadata,
      status: "pending" as ReportStatus,
      encrypted_data: encrypted_data,
      is_encrypted: is_encrypted || false,
      location: share_location && location ? location : undefined,
      moderation: moderation,
      is_offline_sync: is_offline_sync || false,
      // Don't manually set shortId - let the schema middleware handle it
    };

    // Encrypt sensitive fields if not already encrypted by client
    if (!is_encrypted && (message || location)) {
      try {
        reportData = DataEncryption.encryptReportData(reportData);
        reportData.is_encrypted = true;
        console.log("Server-side encryption applied to sensitive fields");
      } catch (encryptError) {
        console.error("Failed to encrypt report data:", encryptError);
        // Continue without encryption rather than failing
      }
    }

    // Create new report document for MongoDB
    const newReport = new ReportModel(reportData);

    // Auto-flag urgent reports or AI-flagged content
    if (
      severity === "urgent" ||
      category === "medical_emergency" ||
      category === "safety_emergency" ||
      (moderation && moderation.isFlagged && moderation.confidence > 0.7)
    ) {
      newReport.status = "flagged";
    }

    // Save to MongoDB
    const savedReport = await newReport.save();
    console.log("Report created successfully:", savedReport._id);

    // Create alert for urgent/emergency reports
    if (savedReport.severity === "urgent" || savedReport.category === "medical_emergency" || savedReport.category === "safety_emergency") {
      const alert = new AlertModel({
        reportId: savedReport._id,
        alertType: (savedReport.category === "medical_emergency" || savedReport.category === "safety_emergency") ? "emergency" : "urgent",
        message: `${savedReport.severity.toUpperCase()} ${savedReport.category} report received`,
        severity: savedReport.severity,
        category: savedReport.category
      });
      
      await alert.save();
      console.log(`Alert created for ${savedReport.severity} report:`, alert._id);

      // Send email notification for the alert
      try {
        const emailSent = await emailService.sendAlertNotification(alert, savedReport);
        if (emailSent) {
          alert.email_sent = true;
          alert.notification_sent = true;
          await alert.save();
          console.log(`📧 Email alert sent for ${savedReport.severity} report`);
        } else {
          console.log(`⚠️ Failed to send email for ${savedReport.severity} report`);
        }
      } catch (emailError) {
        console.error('Error sending alert email:', emailError);
      }
    }

    // Convert MongoDB document to API format for notifications
    const reportResponse: ReportType = {
      id: savedReport._id.toString(),
      message: savedReport.message,
      category: savedReport.category,
      severity: savedReport.severity,
      photo_url: savedReport.photo_url,
      video_url: savedReport.video_url,
      video_metadata: savedReport.video_metadata,
      created_at: savedReport.created_at.toISOString(),
      status: savedReport.status,
      admin_response: savedReport.admin_response,
      admin_response_at: savedReport.admin_response_at?.toISOString(),
      encrypted_data: savedReport.encrypted_data,
      is_encrypted: savedReport.is_encrypted,
      location: savedReport.location,
      moderation: savedReport.moderation,
      is_offline_sync: savedReport.is_offline_sync,
      shortId: savedReport.shortId
    };

    // Send real-time notification to admins
    try {
      notifyNewReport(reportResponse);
      console.log(
        `Notification sent for report ${reportResponse.id} (${reportResponse.severity} ${reportResponse.category})`,
      );
    } catch (notificationError) {
      console.error("Failed to send notification:", notificationError);
      // Don't fail the report creation if notification fails
    }

    const response: CreateReportResponse = {
      id: reportResponse.id,
      message: reportResponse.message,
      created_at: reportResponse.created_at,
      shortId: reportResponse.shortId,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("❌ Error creating report:", error);
    console.error("📊 Error details:", {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : 'Stack trace hidden in production',
      name: error.name,
      code: error.code
    });
    
    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: "Validation failed",
        details: process.env.NODE_ENV === 'development' ? error.message : 'Invalid data provided'
      });
    }
    
    if (error.code === 11000) { // Duplicate key error
      return res.status(409).json({ 
        error: "Duplicate report detected",
        details: process.env.NODE_ENV === 'development' ? error.message : 'Report ID conflict'
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create Report with File Upload Support
 * Handles multipart/form-data with image and video files
 */
export const createReportWithFiles: RequestHandler = async (req, res) => {
  try {
    console.log("Received report submission with file uploads");
    
    // Handle file uploads with multer
    uploadFields(req, res, async (uploadErr) => {
      if (uploadErr) {
        console.error("File upload error:", uploadErr);
        return res.status(400).json({
          success: false,
          error: uploadErr.message,
          code: 'UPLOAD_ERROR'
        });
      }

      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const {
          message,
          category,
          severity = "medium",
          encrypted_data,
          is_encrypted = false,
          location: locationStr,
          share_location = false,
          is_offline_sync = false,
        } = req.body;

        // Validate required fields
        if (!message || !category) {
          // Cleanup uploaded files if validation fails
          if (files) {
            Object.values(files).flat().forEach(file => {
              cleanupFiles([file]);
            });
          }
          return res.status(400).json({
            success: false,
            error: "Message and category are required"
          });
        }

        // Parse location if provided
        let location: LocationData | undefined;
        if (locationStr && share_location) {
          try {
            location = JSON.parse(locationStr);
          } catch (e) {
            console.warn("Invalid location data provided");
          }
        }

        // Process uploaded files
        let photo_url: string | undefined;
        let video_url: string | undefined;
        let video_metadata: any | undefined;

        if (files?.image && files.image.length > 0) {
          const imageFile = files.image[0];
          photo_url = getFileUrl(req, imageFile.filename, 'image');
          console.log("Image uploaded:", photo_url);
        }

        if (files?.video && files.video.length > 0) {
          const videoFile = files.video[0];
          video_url = getFileUrl(req, videoFile.filename, 'video');
          
          // Create video metadata
          video_metadata = {
            duration: 0, // Could be extracted with ffmpeg if needed
            size: videoFile.size,
            format: videoFile.mimetype,
            width: 0,
            height: 0,
            isRecorded: true,
            uploadMethod: "multipart"
          };
          
          console.log("Video uploaded:", {
            url: video_url,
            size: `${(videoFile.size / 1024 / 1024).toFixed(2)}MB`,
            format: videoFile.mimetype
          });
        }

        // Content moderation
        const moderation = moderateContent(message);

        // Generate unique short ID
        const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Handle encryption if requested
        let finalMessage = message;
        let finalEncryptedData = undefined;
        let finalIsEncrypted = is_encrypted;

        if (is_encrypted && encrypted_data) {
          try {
            // Validate encrypted data structure
            const encryptedParsed = typeof encrypted_data === 'string' 
              ? JSON.parse(encrypted_data) 
              : encrypted_data;
            
            if (encryptedParsed && encryptedParsed.data && encryptedParsed.iv) {
              finalMessage = "[ENCRYPTED]";
              finalEncryptedData = encryptedParsed;
              finalIsEncrypted = true;
            }
          } catch (encryptionError) {
            console.error("Encryption processing error:", encryptionError);
            finalIsEncrypted = false;
          }
        }

        // Create new report document
        const newReport = new ReportModel({
          shortId,
          message: finalMessage,
          category: category as ReportCategory,
          severity,
          photo_url,
          video_url,
          video_metadata,
          status: "pending" as ReportStatus,
          encrypted_data: finalEncryptedData,
          is_encrypted: finalIsEncrypted,
          location,
          moderation,
          is_offline_sync,
          created_at: new Date(),
          updated_at: new Date(),
          history: [{
            status: "pending" as ReportStatus,
            updated_at: new Date(),
            comment: "Report created"
          }]
        });

        const savedReport = await newReport.save();
        console.log("Report saved with ID:", savedReport._id);

        // Check if this requires urgent notification
        const isUrgent = severity === "urgent" || category === "emergency";
        const isEmergency = category === "emergency";

        if (isUrgent || isEmergency) {
          try {
            // Create alert document
            const alertDoc = new AlertModel({
              reportId: savedReport._id,
              alertType: isEmergency ? 'emergency' : 'urgent',
              message: `${isEmergency ? 'EMERGENCY' : 'URGENT'} report submitted: ${category}`,
              metadata: {
                category,
                severity,
                shortId: savedReport.shortId,
                hasMedia: !!(photo_url || video_url),
                location: location ? `${location.latitude},${location.longitude}` : undefined
              },
              created_at: new Date(),
              triggered_by: 'system',
              is_acknowledged: false
            });

            await alertDoc.save();
            console.log(`${isEmergency ? 'Emergency' : 'Urgent'} alert created for report ${savedReport.shortId}`);

            // Send email notification
            emailService.sendAlertNotification(alertDoc, savedReport).catch(err => {
              console.error("Failed to send email alert:", err);
            });
          } catch (alertError) {
            console.error("Error creating alert:", alertError);
          }
        }

        // Prepare response
        const reportResponse: ReportType = {
          id: savedReport._id.toString(),
          message: savedReport.message,
          category: savedReport.category,
          severity: savedReport.severity,
          photo_url: savedReport.photo_url,
          video_url: savedReport.video_url,
          video_metadata: savedReport.video_metadata,
          created_at: savedReport.created_at.toISOString(),
          status: savedReport.status,
          admin_response: savedReport.admin_response,
          admin_response_at: savedReport.admin_response_at?.toISOString(),
          encrypted_data: savedReport.encrypted_data,
          is_encrypted: savedReport.is_encrypted,
          location: savedReport.location,
          moderation: savedReport.moderation,
          is_offline_sync: savedReport.is_offline_sync,
          shortId: savedReport.shortId
        };

        // Send real-time notification to admins
        try {
          notifyNewReport(reportResponse);
          console.log(
            `Notification sent for report ${reportResponse.id} (${reportResponse.severity} ${reportResponse.category})`,
          );
        } catch (notificationError) {
          console.error("Failed to send notification:", notificationError);
          // Don't fail the report creation if notification fails
        }

        const response: CreateReportResponse = {
          id: reportResponse.id,
          message: reportResponse.message,
          created_at: reportResponse.created_at,
          shortId: reportResponse.shortId
        };

        res.status(201).json({
          success: true,
          data: response
        });
      } catch (error) {
        console.error("Error processing report with files:", error);
        // Cleanup uploaded files on error
        if (req.files) {
          const files = req.files as { [fieldname: string]: Express.Multer.File[] };
          Object.values(files).flat().forEach(file => {
            cleanupFiles([file]);
          });
        }
        res.status(500).json({ 
          success: false, 
          error: "Internal server error" 
        });
      }
    });
  } catch (error) {
    console.error("Error in createReportWithFiles:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

export const getReports: RequestHandler = async (req: AuthRequest, res) => {
  try {
    // JWT authentication is handled by AuthService.authenticateAdmin middleware
    
    const { status } = req.query;

    // Build query filter for MongoDB
    const filter: any = {};
    if (status && typeof status === "string") {
      filter.status = status;
    }

    // Fetch reports from MongoDB
    const rawReports = await ReportModel.find(filter)
      .sort({ created_at: -1 })
      .lean();

    // Decrypt sensitive fields for admin viewing
    const reports = rawReports.map((report) => {
      try {
        // Check if report has encrypted fields
        if (report.is_encrypted) {
          return DataEncryption.decryptReportData(report);
        }
        return report;
      } catch (decryptError) {
        console.error('Failed to decrypt report:', report._id, decryptError);
        // Return report with redacted sensitive fields on decrypt failure
        return {
          ...report,
          message: report.is_encrypted ? '[DECRYPTION FAILED]' : report.message,
          location: report.is_encrypted ? null : report.location
        };
      }
    });

    // Convert MongoDB documents to API format
    const formattedReports: ReportType[] = reports.map((report) => ({
      id: report._id.toString(),
      message: report.message,
      category: report.category,
      severity: report.severity,
      photo_url: report.photo_url,
      video_url: report.video_url,
      video_metadata: report.video_metadata,
      created_at: report.created_at.toISOString(),
      status: report.status,
      admin_response: report.admin_response,
      admin_response_at: report.admin_response_at?.toISOString(),
      encrypted_data: report.encrypted_data,
      is_encrypted: report.is_encrypted,
      location: report.location,
      moderation: report.moderation,
      is_offline_sync: report.is_offline_sync,
      shortId: report.shortId
    }));

    const response: GetReportsResponse = {
      reports: formattedReports,
      total: formattedReports.length
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

export const getReportStatus: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid report ID format" });
    }

    // Find report by ID
    const report = await ReportModel.findById(id).lean();
    
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Return public status info (no sensitive data)
    res.json({
      id: report._id.toString(),
      status: report.status,
      created_at: report.created_at.toISOString(),
      admin_response: report.admin_response || null,
      admin_response_at: report.admin_response_at?.toISOString() || null,
    });
  } catch (error) {
    console.error("Error getting report status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateReport: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, admin_response }: UpdateReportRequest = req.body;

    // Validate input
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid report ID format" 
      });
    }

    const validStatuses = ["pending", "in_progress", "resolved", "flagged"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid status" 
      });
    }

    // Find and update report
    const updateData: any = { status };
    
    if (admin_response && admin_response.trim()) {
      updateData.admin_response = admin_response.trim();
      updateData.admin_response_at = new Date();
    }

    const updatedReport = await ReportModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updatedReport) {
      return res.status(404).json({ 
        success: false, 
        error: "Report not found" 
      });
    }

    // Add status change to history
    await ReportModel.findByIdAndUpdate(id, {
      $push: {
        history: {
          status,
          changed_by: req.admin?.username || 'system',
          changed_at: new Date(),
          notes: admin_response || `Status changed to ${status}`
        }
      }
    });

    console.log(`Report ${id} updated to status: ${status} by admin: ${req.admin?.username}`);

    // Decrypt for admin response if encrypted
    let responseReport = updatedReport;
    try {
      if (updatedReport.is_encrypted) {
        responseReport = DataEncryption.decryptReportData(updatedReport);
      }
    } catch (decryptError) {
      console.error('Failed to decrypt updated report:', decryptError);
      // Continue with encrypted data
    }

    const reportResponse: ReportType = {
      id: responseReport._id.toString(),
      message: responseReport.message,
      category: responseReport.category,
      severity: responseReport.severity,
      photo_url: responseReport.photo_url,
      video_url: responseReport.video_url,
      video_metadata: responseReport.video_metadata,
      created_at: responseReport.created_at.toISOString(),
      status: responseReport.status,
      admin_response: responseReport.admin_response,
      admin_response_at: responseReport.admin_response_at?.toISOString(),
      encrypted_data: responseReport.encrypted_data,
      is_encrypted: responseReport.is_encrypted,
      location: responseReport.location,
      moderation: responseReport.moderation,
      is_offline_sync: responseReport.is_offline_sync,
      shortId: responseReport.shortId
    };

    res.json({
      success: true,
      data: reportResponse
    });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

export const getReportByShortId: RequestHandler = async (req, res) => {
  try {
    const { shortId } = req.params;

    if (!shortId || shortId.length !== 8) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid short ID format" 
      });
    }

    const report = await ReportModel.findOne({ shortId }).lean();
    
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        error: "Report not found" 
      });
    }

    // Return limited public info for status checking
    res.json({
      success: true,
      data: {
        shortId: report.shortId,
        status: report.status,
        created_at: report.created_at.toISOString(),
        admin_response: report.admin_response || null,
        admin_response_at: report.admin_response_at?.toISOString() || null
      }
    });
  } catch (error) {
    console.error("Error getting report by short ID:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};