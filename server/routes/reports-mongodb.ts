import { RequestHandler } from "express";
import ReportModel from "../../shared/models/report";
import { uploadFields } from "../utils/gridfs";
import { 
  encryptReportData, 
  encryptSensitiveData,
  EncryptedData 
} from "../middleware/authMiddleware";
import { 
  processReportNotification, 
  NotificationData 
} from "../utils/notificationHelpers";
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
    
    const { message, location } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.log("❌ Validation failed: Missing or empty message");
      return res.status(400).json({
        success: false,
        error: "Message is required and cannot be empty",
      });
    }
    
    console.log("✅ Message validation passed:", message.substring(0, 50) + "...");
    
    const reportData: any = { message: message.trim() };
    
    if (location) {
      try {
        let locationData = typeof location === 'string' ? JSON.parse(location) : location;
        if (locationData && typeof locationData.lat === 'number' && typeof locationData.lng === 'number') {
          reportData.location = { lat: locationData.lat, lng: locationData.lng };
        }
      } catch (error) {
        console.warn("⚠️ Failed to parse location data:", error);
      }
    }
    
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files.image && files.image[0]) {
        const imageFile = files.image[0] as any;
        if (imageFile.id) {
          reportData.photo_file_id = new mongoose.Types.ObjectId(imageFile.id);
        }
      }
      
      if (files.video && files.video[0]) {
        const videoFile = files.video[0] as any;
        if (videoFile.id) {
          reportData.video_file_id = new mongoose.Types.ObjectId(videoFile.id);
        }
      }
    }
    
    const report = new ReportModel(reportData);
    const savedReport = await report.save();
    
    res.status(201).json({
      success: true,
      data: {
        id: savedReport._id.toString(),
        shortId: savedReport.shortId,
        imageFiles: req.files?.image ? req.files.image.length : 0,
        videoFiles: req.files?.video ? req.files.video.length : 0,
        locationAccuracy: reportData.location ? 0 : undefined
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
      error: "Internal server error. Please try again.",
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
