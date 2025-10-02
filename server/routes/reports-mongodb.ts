import { RequestHandler } from "express";
import ReportModel from "../../shared/models/report";
import AlertModel from "../../shared/models/Alert";
import { uploadFields } from "../utils/gridfs";
import { DataEncryption } from "../utils/encryption";
import { 
  encryptSensitiveData,
  decryptSensitiveData,
  EncryptedData 
} from "../middleware/authMiddleware";
import { 
  processReportNotification, 
  NotificationData 
} from "../utils/notificationHelpers";
import { sendUrgentReportNotifications } from "../utils/notifications";
import { broadcastToAdmins, notifyNewReport } from "../utils/realtime";
import mongoose from "mongoose";

/**
 * Universal Report Creation Handler
 */
export const createReport: RequestHandler = async (req, res) => {
  console.log("🚀 Processing report submission");
  console.log("📥 Content-Type:", req.get('Content-Type'));
  console.log("📦 Request body keys:", Object.keys(req.body || {}));
  
  const isMultipart = req.get('Content-Type')?.includes('multipart/form-data');
  
  if (isMultipart) {
    console.log("📁 Processing multipart upload...");
    uploadFields(req, res, async (uploadError) => {
      if (uploadError) {
        console.error("❌ File upload failed:", uploadError);
        return res.status(400).json({
          success: false,
          error: `File upload failed: ${uploadError.message}`,
        });
      }
      console.log("✅ Upload successful, processing report...");
      await processReportCreation(req, res);
    });
  } else {
    console.log("📝 Processing JSON request...");
    await processReportCreation(req, res);
  }
};

async function processReportCreation(req: any, res: any) {
  try {
    console.log("📝 Processing report data");
    console.log("📥 Request body:", JSON.stringify(req.body, null, 2));
    console.log("📁 Files:", req.files ? Object.keys(req.files) : "None");
    
    const { 
      message, 
      location, 
      category, 
      severity, 
      is_encrypted, 
      share_location 
    } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.log("❌ Validation failed: Missing or empty message");
      return res.status(400).json({
        success: false,
        error: "Message is required and cannot be empty",
      });
    }
    
    console.log("✅ Message validation passed:", message.substring(0, 50) + "...");
    console.log("🔒 Encryption flag:", is_encrypted);
    
    const reportData: any = {
      category: category || 'feedback',
      severity: severity || 'medium',
      is_encrypted: is_encrypted === 'true' || is_encrypted === true,
      share_location: share_location === 'true' || share_location === true
    };
    
    // Handle encryption
    if (reportData.is_encrypted) {
      try {
        console.log("🔐 Encrypting report data...");
        const encrypted = encryptSensitiveData(message.trim());
        reportData.encrypted_message = encrypted.encryptedData;
        reportData.encryption_iv = encrypted.iv;
        reportData.encryption_auth_tag = encrypted.authTag;
        reportData.message = "Encrypted"; // Keep a placeholder instead of empty string
        console.log("✅ Report data encrypted successfully");
      } catch (encryptionError) {
        console.error("❌ Encryption failed:", encryptionError);
        // Fallback to plaintext if encryption fails
        reportData.message = message.trim();
        reportData.is_encrypted = false;
        console.log("⚠️ Falling back to plaintext storage");
      }
    } else {
      console.log("📝 Storing report as plaintext (encryption disabled)");
      reportData.message = message.trim();
    }
    
    // Handle location data
    if (location && reportData.share_location) {
      try {
        let locationData = typeof location === 'string' ? JSON.parse(location) : location;
        console.log("📍 Processing location data:", locationData);
        
        if (locationData && typeof locationData.latitude === 'number' && typeof locationData.longitude === 'number') {
          reportData.location = {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy || 0,
            timestamp: locationData.timestamp || Date.now(),
            address: locationData.address || '',
            source: locationData.source || 'browser_gps'
          };
          console.log("✅ Location data processed:", {
            lat: reportData.location.latitude,
            lng: reportData.location.longitude,
            accuracy: reportData.location.accuracy
          });
        }
      } catch (error) {
        console.warn("⚠️ Failed to parse location data:", error);
      }
    }
    
    // Handle file uploads
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files.image && files.image[0]) {
        const imageFile = files.image[0] as any;
        if (imageFile.id) {
          reportData.photo_file_id = new mongoose.Types.ObjectId(imageFile.id);
          console.log("📸 Image file linked:", imageFile.id);
        }
      }
      
      if (files.video && files.video[0]) {
        const videoFile = files.video[0] as any;
        if (videoFile.id) {
          reportData.video_file_id = new mongoose.Types.ObjectId(videoFile.id);
          console.log("🎥 Video file linked:", videoFile.id);
        }
      }
    }
    
    console.log("💾 Saving report to MongoDB...");
    const report = new ReportModel(reportData);
    const savedReport = await report.save();
    
    console.log("✅ Report saved successfully:", {
      id: savedReport._id.toString(),
      shortId: savedReport.shortId,
      encrypted: savedReport.is_encrypted,
      hasLocation: !!savedReport.location,
      hasFiles: !!(savedReport.photo_file_id || savedReport.video_file_id)
    });

    // =======================================
    // REAL-TIME DASHBOARD NOTIFICATION
    // =======================================
    
    /**
     * Send real-time notification to admin dashboard with all required details
     * Includes shortId, priority, timestamp, location, and media information
     */
    try {
      const notificationData = {
        shortId: savedReport.shortId,
        priority: reportData.severity || reportData.priority || 'medium',
        severity: reportData.severity || 'medium',
        category: reportData.category || reportData.type || 'other',
        timestamp: savedReport.createdAt?.toISOString() || new Date().toISOString(),
        location: reportData.location ? {
          latitude: reportData.location.latitude || reportData.location.lat,
          longitude: reportData.location.longitude || reportData.location.lng,
          address: reportData.location.address
        } : undefined,
        hasMedia: !!(savedReport.photo_file_id || savedReport.video_file_id),
        isEncrypted: savedReport.is_encrypted || false
      };
      
      // Send real-time notification to all connected admin clients
      notifyNewReport(notificationData);
      console.log("📡 Real-time notification sent to admin dashboard");
      
    } catch (notificationError) {
      console.error("❌ Failed to send real-time notification:", notificationError);
      // Don't fail the request if notification fails
    }

    // Create alert and send notifications for urgent reports
    if (reportData.severity === "urgent" || 
        reportData.category === "medical" || 
        reportData.category === "emergency") {
      
      const alert = new AlertModel({
        reportId: savedReport._id,
        alertType: reportData.category === "medical" ? "emergency" : "urgent",
        message: `${reportData.severity?.toUpperCase()} ${reportData.category.replace("_", " ")} report received`,
        severity: reportData.severity || "high",
        category: reportData.category,
        created_at: new Date(),
      });

      await alert.save();
      console.log("🚨 Alert created for urgent report");

      // Send urgent notifications via email/SMS
      try {
        await sendUrgentReportNotifications({
          _id: savedReport._id.toString(),
          shortId: savedReport.shortId,
          category: reportData.category,
          severity: reportData.severity || "high",
          message: reportData.is_encrypted ? "New encrypted urgent report received" : reportData.message,
          location: reportData.location || undefined,
          timestamp: new Date()
        });
        console.log("📧 Urgent notifications sent successfully");
      } catch (notifyError) {
        console.error("❌ Failed to send urgent notifications:", notifyError);
      }

      // Broadcast to admin dashboard in real-time
      try {
        broadcastToAdmins('urgent-report', {
          reportId: savedReport._id.toString(),
          shortId: savedReport.shortId,
          category: reportData.category,
          severity: reportData.severity || "high",
          message: reportData.is_encrypted ? "New encrypted urgent report received" : reportData.message,
          created_at: new Date().toISOString()
        });
        console.log("📡 Real-time broadcast sent to admin dashboard");
      } catch (broadcastError) {
        console.error("❌ Failed to broadcast to admins:", broadcastError);
      }
    }

    // Send notification to admins about new report
    try {
      const notificationData: NotificationData = {
        reportId: savedReport._id.toString(),
        shortId: savedReport.shortId,
        message: reportData.is_encrypted ? "New encrypted report received" : message.substring(0, 100),
        category: reportData.category,
        priority: reportData.severity === 'urgent' ? 'urgent' : 
                 reportData.severity === 'high' ? 'high' : 'medium',
        timestamp: new Date(),
        hasMedia: !!(savedReport.photo_file_id || savedReport.video_file_id)
      };
      
      processReportNotification(notificationData);
      console.log("📢 Admin notification sent");
    } catch (notificationError) {
      console.warn("⚠️ Failed to send notification:", notificationError);
    }
    
    res.status(201).json({
      success: true,
      data: {
        _id: savedReport._id.toString(),
        id: savedReport._id.toString(), // For backward compatibility
        shortId: savedReport.shortId,
        is_encrypted: savedReport.is_encrypted,
        imageFiles: req.files?.image ? req.files.image.length : 0,
        videoFiles: req.files?.video ? req.files.video.length : 0,
        locationAccuracy: reportData.location?.accuracy
      },
      message: "Report submitted successfully",
    });
    
  } catch (error: any) {
    console.error("💥 Error creating report:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.message}`,
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to create report",
    });
  }
}

export const getReports: RequestHandler = async (req, res) => {
  try {
    console.log('📊 Fetching reports with decryption for admin dashboard');
    
    const reports = await ReportModel.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Decrypt sensitive data for admin view
    const decryptedReports = reports.map(report => {
      let decryptedData: any = {};
      
      // Decrypt if encryption data exists
      if (report.encrypted_message && report.encryption_iv && report.encryption_auth_tag) {
        try {
          const { decryptReportData } = require('../middleware/authMiddleware');
          decryptedData = decryptReportData(
            report.encrypted_message, 
            report.encryption_iv, 
            report.encryption_auth_tag
          );
          console.log(`🔓 Decrypted report: ${report.shortId}`);
        } catch (error) {
          console.error(`❌ Failed to decrypt report ${report.shortId}:`, error);
          // Fallback to original message if decryption fails
          decryptedData = {
            message: report.message || 'Unable to decrypt message',
            location: report.location,
            category: 'unknown',
            priority: 'medium'
          };
        }
      } else {
        // No encryption, use original data
        decryptedData = {
          message: report.message || '',
          location: report.location,
          category: report.category || 'general',
          priority: report.priority || 'medium'
        };
      }
      
      return {
        id: report._id.toString(),
        shortId: report.shortId,
        message: decryptedData.message,
        location: decryptedData.location,
        category: decryptedData.category,
        priority: decryptedData.priority,
        photo_file_id: report.photo_file_id?.toString(),
        video_file_id: report.video_file_id?.toString(),
        hasMedia: !!(report.photo_file_id || report.video_file_id),
        isEncrypted: !!(report.encrypted_message),
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      };
    });

    console.log(`✅ Retrieved ${decryptedReports.length} reports with decryption`);
    
    res.json({
      success: true,
      data: {
        reports: decryptedReports,
        total: decryptedReports.length,
        encrypted: decryptedReports.filter(r => r.isEncrypted).length,
        withMedia: decryptedReports.filter(r => r.hasMedia).length
      },
      message: "Reports retrieved successfully"
    });
  } catch (error) {
    console.error("❌ Error fetching reports:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reports",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getReportByShortId: RequestHandler = async (req, res) => {
  try {
    // Handle both parameter names: :id and :shortId
    const reportId = req.params.id || req.params.shortId;
    console.log(`📋 Fetching report by ID: ${reportId}`);
    
    // Try to find by shortId first, then by MongoDB ObjectId
    let report = await ReportModel.findOne({ shortId: reportId })
      .select('+message_encrypted +message_iv +message_salt +location_encrypted +location_iv +location_salt +reporterEmail_encrypted +reporterEmail_iv +reporterEmail_salt +admin_notes_encrypted +admin_notes_iv +admin_notes_salt +encrypted_message +encryption_iv +encryption_auth_tag +encrypted_data')
      .lean();
    
    // If not found by shortId, try MongoDB ObjectId
    if (!report && mongoose.Types.ObjectId.isValid(reportId)) {
      console.log(`🔍 Not found by shortId, trying ObjectId: ${reportId}`);
      report = await ReportModel.findById(reportId)
        .select('+message_encrypted +message_iv +message_salt +location_encrypted +location_iv +location_salt +reporterEmail_encrypted +reporterEmail_iv +reporterEmail_salt +admin_notes_encrypted +admin_notes_iv +admin_notes_salt +encrypted_message +encryption_iv +encryption_auth_tag +encrypted_data')
        .lean();
    }
    
    if (!report) {
      console.log(`❌ Report not found with ID: ${reportId}`);
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    // Decrypt report data using the new decryption utility
    console.log(`🔓 Decrypting report: ${report.shortId}`);
    const decryptedReport = await DataEncryption.decryptReportDocument(report);

    // Format response data
    const responseData = {
      _id: report._id.toString(),
      id: report._id.toString(), // For backward compatibility
      shortId: report.shortId,
      message: decryptedReport.message || '[NO MESSAGE]',
      category: report.category,
      severity: report.severity,
      status: report.status || 'pending',
      location: decryptedReport.location,
      photo_file_id: report.photo_file_id,
      video_file_id: report.video_file_id,
      is_encrypted: report.is_encrypted,
      created_at: report.created_at || report.createdAt,
      updated_at: report.updated_at || report.updatedAt
    };

    console.log(`✅ Report retrieved and decrypted successfully: ${report.shortId} (searched by: ${reportId})`);
    res.json({
      success: true,
      data: responseData,
      message: "Report retrieved successfully"
    });

  } catch (error: any) {
    console.error("❌ Error fetching report by ID:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report"
    });
  }
};

export const getReportById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid report ID",
      });
    }

    const report = await ReportModel.findById(id).lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    res.json({
      success: true,
      report: {
        id: report._id.toString(),
        shortId: report.shortId,
        message: report.message,
        location: report.location,
        photo_file_id: report.photo_file_id?.toString(),
        video_file_id: report.video_file_id?.toString(),
        createdAt: report.createdAt,
      }
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report",
    });
  }
};
