import { RequestHandler } from "express";
import {
  CreateReportResponse,
  ReportCategory,
  ReportSeverity,
} from "../../shared/api";
import ReportModel from "../../shared/models/report";
import AlertModel from "../../shared/models/Alert";
import { uploadFields } from "../utils/gridfs";
import { notifyNewReport } from "./notifications";

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

      // Parse location if provided
      let parsedLocation;
      if (share_location === 'true' && location) {
        try {
          parsedLocation = JSON.parse(location);
        } catch (error) {
          console.warn("Failed to parse location:", error);
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
        location: parsedLocation,
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
            created_at: savedReport.created_at.toISOString(),
            updated_at: savedReport.updated_at.toISOString(),
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
        created_at: savedReport.created_at.toISOString(),
      };

      res.status(201).json({
        ...response,
        success: true,
        category: savedReport.category,
        severity: savedReport.severity,
        status: savedReport.status,
        imageFiles: imageFileIds.length,
        videoFiles: videoFileIds.length,
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
 * Get file from GridFS by ID
 */
export const getGridFSFile: RequestHandler = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Import getFile function here to avoid circular imports
    const { getFile } = await import("../utils/gridfs");
    
    const { stream, file } = await getFile(fileId);
    
    // Set headers for file streaming
    res.set({
      'Content-Type': file.contentType,
      'Content-Length': file.length.toString(),
      'Content-Disposition': `inline; filename="${file.filename}"`,
      'Cache-Control': 'private, max-age=3600',
    });

    // Stream file to response
    stream.pipe(res);
    
    console.log("📤 File served:", {
      fileId,
      filename: file.filename,
      size: file.length,
      contentType: file.contentType,
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