import { RequestHandler } from "express";
import {
  CreateReportResponse,
  ReportCategory,
  ReportSeverity,
} from "../../shared/api";
import ReportModel from "../../shared/models/report";
import AlertModel from "../../shared/models/Alert";
import { uploadFields, getFile, getDecryptedFile } from "../utils/gridfs";
import { notifyNewReport } from "./notifications";
import { processLocationData } from "../utils/location-processor";
import { sendUrgentReportNotifications } from "../utils/notifications";
import { broadcastToAdmins } from "../utils/realtime";

/**
 * GridFS Report Creation Handler
 * Handles multipart/form-data with file uploads to GridFS
 */

// Simple AI moderation
function moderateContent(text: string) {
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
    reason: isFlagged ? "Potentially inappropriate content detected" : undefined,
    confidence,
    detectedTerms,
  };
}

export const createReportWithGridFS: RequestHandler = async (req, res) => {
  // Handle file upload with GridFS
  uploadFields(req, res, async (uploadError) => {
    if (uploadError) {
      console.error("❌ GridFS upload error:", uploadError.message);
      return res.status(400).json({
        success: false,
        error: uploadError.message,
      });
    }

    try {
      console.log("🚀 Processing GridFS report submission");
      const { message, category, severity, location, share_location, is_offline_sync } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Validate required fields
      if (!message || !category) {
        return res.status(400).json({
          success: false,
          error: "Message and category are required",
        });
      }

      // Validate category
      const validCategories: ReportCategory[] = [
        "harassment",
        "medical",
        "emergency", 
        "safety",
        "feedback"
      ];

      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
        });
      }

      // Process uploaded files
      const imageFileIds: string[] = [];
      const videoFileIds: string[] = [];

      if (files.image) {
        files.image.forEach((file: any) => {
          imageFileIds.push(file.id.toString());
          console.log("🖼️ Image uploaded to GridFS:", {
            fileId: file.id,
            filename: file.originalname,
            size: file.size,
          });
        });
      }

      if (files.video) {
        files.video.forEach((file: any) => {
          videoFileIds.push(file.id.toString());
          console.log("🎥 Video uploaded to GridFS:", {
            fileId: file.id,
            filename: file.originalname,
            size: file.size,
          });
        });
      }

      // Parse and process location if provided
      let processedLocation = null;
      if (share_location === 'true' && location) {
        processedLocation = processLocationData(location);
        if (processedLocation) {
          console.log("📍 Enhanced location data processed:", {
            coordinates: `${processedLocation.lat}, ${processedLocation.lng}`,
            source: processedLocation.source,
            city: processedLocation.city,
            country: processedLocation.country
          });
        }
      }

      // Apply AI moderation
      const moderation = moderateContent(message);

      // Create report data
      const reportData = {
        message: message.trim(),
        category,
        severity: severity || "medium",
        imageFileIds: imageFileIds.length > 0 ? imageFileIds : undefined,
        videoFileIds: videoFileIds.length > 0 ? videoFileIds : undefined,
        location: processedLocation,
        moderation,
        is_offline_sync: is_offline_sync === 'true',
        status: "pending" as const,
        created_at: new Date(),
        updated_at: new Date(),
        history: [{
          status: "pending" as const,
          updated_at: new Date(),
          comment: "Report submitted"
        }]
      };

      // Save to database
      const report = new ReportModel(reportData);
      const savedReport = await report.save();

      console.log("✅ Report saved with GridFS files:", {
        reportId: savedReport._id,
        shortId: savedReport.shortId,
        imageFiles: imageFileIds.length,
        videoFiles: videoFileIds.length,
      });

      // Create alert for urgent reports
      if (severity === "urgent" || 
          category === "medical" || 
          category === "emergency") {
        
        const alert = new AlertModel({
          reportId: savedReport._id,
          alertType: category === "medical" ? "emergency" : "urgent",
          message: `${severity?.toUpperCase()} ${category.replace("_", " ")} report received`,
          severity: severity || "high",
          category,
          created_at: new Date(),
        });

        await alert.save();
        console.log("🚨 Alert created for urgent report");

        // Send urgent notifications via email/SMS
        try {
          await sendUrgentReportNotifications({
            _id: savedReport._id.toString(),
            shortId: savedReport.shortId,
            category,
            severity: severity || "high",
            message: savedReport.message,
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
            category,
            severity: severity || "high",
            message: savedReport.message,
            created_at: new Date().toISOString()
          });
          console.log("📡 Real-time broadcast sent to admin dashboard");
        } catch (broadcastError) {
          console.error("❌ Failed to broadcast to admins:", broadcastError);
        }

        // Send notifications
        try {
          // Convert to Report interface format for notifications
          const reportForNotification = {
            id: savedReport._id.toString(),
            shortId: savedReport.shortId,
            message: savedReport.message,
            category: savedReport.category,
            severity: savedReport.severity,
            status: savedReport.status,
            created_at: (savedReport.created_at || savedReport.createdAt)?.toISOString() || new Date().toISOString(),
            updated_at: (savedReport.updated_at || savedReport.updatedAt)?.toISOString() || new Date().toISOString(),
          };
          await notifyNewReport(reportForNotification as any);
        } catch (notifyError) {
          console.error("Failed to send notifications:", notifyError);
          // Don't fail the request if notifications fail
        }
      }

      // Success response
      const response: CreateReportResponse = {
        id: savedReport._id.toString(),
        shortId: savedReport.shortId,
        message: savedReport.message,
        created_at: (savedReport.created_at || savedReport.createdAt)?.toISOString() || new Date().toISOString(),
      };

      res.status(201).json({
        success: true,
        data: {
          _id: savedReport._id.toString(),
          id: savedReport._id.toString(), // For backward compatibility
          shortId: savedReport.shortId,
          is_encrypted: savedReport.is_encrypted,
          imageFiles: imageFileIds.length,
          videoFiles: videoFileIds.length,
          locationAccuracy: savedReport.location?.accuracy
        },
        message: "Report submitted successfully",
      });

    } catch (error) {
      console.error("❌ GridFS report creation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create report",
      });
    }
  });
};

/**
 * Get file from GridFS by ID with automatic decryption
 */
export const getGridFSFile: RequestHandler = async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log(`📁 Serving file: ${fileId}`);
    
    // Get decrypted file content
    const { buffer, metadata, filename, contentType } = await getDecryptedFile(fileId);
    
    // Set headers for file streaming
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': buffer.length.toString(),
    });

    // Send decrypted file buffer
    res.send(buffer);
    
    console.log("📤 Decrypted file served:", {
      fileId,
      filename,
      contentType,
      size: buffer.length,
      encrypted: metadata?.encrypted || false
    });

  } catch (error) {
    console.error("❌ File retrieval error:", error);
    
    if (error.message.includes("File not found")) {
      res.status(404).json({
        success: false,
        error: "File not found",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to retrieve file",
      });
    }
  }
};