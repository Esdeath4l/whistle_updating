// @ts-nocheck
/*
  Legacy backup route: This file contains multiple legacy shapes and runtime-only
  behaviors that are noisy for the TypeScript compiler. We opt-in to runtime
  checks here and keep static typing focused elsewhere.
*/

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
} from "@shared/api";
import ReportModel from "../../shared/models/report";
import AlertModel from "../../shared/models/Alert";
import { notifyNewReport } from "../utils/realtime"; // Use Socket.io instead of SSE
import { AuthService, AuthRequest } from "../utils/auth";
import { DataEncryption } from "../utils/encryption";

// Admin credentials - should be environment variables in production
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

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
    console.log("Received report submission with enhanced features"); // Debug log (no sensitive data)
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

    const validSeverities = ["low", "medium", "high", "urgent"];
    if (severity && !validSeverities.includes(severity)) {
      console.log("Error: Invalid severity:", severity);
      return res.status(400).json({ error: "Invalid severity level" });
    }

    // Apply AI moderation if not encrypted
    let moderation: ModerationResult | undefined;
    if (!is_encrypted && message) {
      moderation = moderateContent(message);
    }

    // Create new report document for MongoDB
    const newReport = new ReportModel({
      message: is_encrypted ? "[ENCRYPTED]" : (message || "").trim(),
      category: is_encrypted
        ? ("harassment" as ReportCategory)
        : category || "feedback",
      severity: severity || "medium",
      photo_url: is_encrypted ? undefined : photo_url,
      video_url: is_encrypted ? undefined : video_url,
      video_metadata: is_encrypted ? undefined : video_metadata,
      status: "pending" as ReportStatus,
      encrypted_data: encrypted_data,
      is_encrypted: is_encrypted || false,
      location: share_location && location ? location : undefined,
      moderation: moderation,
      is_offline_sync: is_offline_sync || false,
    });

    // Auto-flag urgent reports or AI-flagged content
    if (
      severity === "urgent" ||
      (category as any) === "medical_emergency" ||
      (category as any) === "safety_emergency" ||
      (moderation && (moderation as any).isFlagged && (moderation as any).confidence > 0.7)
    ) {
      newReport.status = "flagged";
    }

    // Save to MongoDB
    const savedReport = await newReport.save();
    console.log("Report created successfully:", savedReport._id); // Debug log

    // Convert MongoDB document to API format for notifications
    const reportResponse: any = {
      id: savedReport._id.toString(),
      message: savedReport.message,
      category: savedReport.category,
      severity: savedReport.severity,
      photo_url: savedReport.photo_url,
      video_url: savedReport.video_url,
      video_metadata: savedReport.video_metadata,
      created_at: (savedReport.created_at || savedReport.createdAt)?.toISOString(),
      status: savedReport.status,
      admin_response: savedReport.admin_response,
      admin_response_at: savedReport.admin_response_at?.toISOString(),
      encrypted_data: savedReport.encrypted_data,
      is_encrypted: savedReport.is_encrypted,
      location: savedReport.location,
      moderation: savedReport.moderation,
      is_offline_sync: savedReport.is_offline_sync,
    };

    // Send real-time notification to admins
    try {
  notifyNewReport(reportResponse as any);
      console.log(
        `Notification sent for report ${reportResponse.id} (${reportResponse.severity} ${reportResponse.category})`,
      );
    } catch (notificationError) {
      console.error("Failed to send notification:", notificationError);
      // Don't fail the report creation if notification fails
    }

    const response: CreateReportResponse = {
      id: reportResponse.id,
      shortId: reportResponse.shortId,
      message: reportResponse.message,
      created_at: reportResponse.created_at,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: "Internal server error" });
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
      .sort({ created_at: -1 }) // Sort by newest first
      .lean(); // Use lean() for better performance

    // Decrypt sensitive fields for admin viewing
    const reports = rawReports.map((report) => {
      try {
        // Decrypt if report has encrypted fields
        if (report.encrypted_data) {
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
      shortId: report.shortId,
      history: report.history
    }));

    const response: GetReportsResponse = {
      reports: formattedReports,
      total: formattedReports.length,
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

    const report = await ReportModel.findById(id).lean();
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Return limited information for anonymous status check
    const statusInfo = {
      id: report._id.toString(),
      status: report.status,
      created_at: report.created_at.toISOString(),
      admin_response: report.admin_response || null,
      admin_response_at: report.admin_response_at?.toISOString() || null,
    };

    res.json(statusInfo);
  } catch (error) {
    console.error("Error fetching report status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateReport: RequestHandler = async (req, res) => {
  try {
    // Simple admin check
    const authHeader = req.headers.authorization;
    if (
      !authHeader ||
      authHeader !== `Bearer ${ADMIN_USERNAME}:${ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { status, admin_response }: UpdateReportRequest = req.body;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid report ID format" });
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
    }

    if (admin_response !== undefined) {
      updateData.admin_response = admin_response;
      updateData.admin_response_at = new Date();
    }

    const updatedReport = await ReportModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updatedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Convert to API format
    const reportResponse: ReportType = {
      id: updatedReport._id.toString(),
      message: updatedReport.message,
      category: updatedReport.category,
      severity: updatedReport.severity,
      photo_url: updatedReport.photo_url,
      video_url: updatedReport.video_url,
      video_metadata: updatedReport.video_metadata,
      created_at: updatedReport.created_at.toISOString(),
      status: updatedReport.status,
      admin_response: updatedReport.admin_response,
      admin_response_at: updatedReport.admin_response_at?.toISOString(),
      encrypted_data: updatedReport.encrypted_data,
      is_encrypted: updatedReport.is_encrypted,
      location: updatedReport.location,
      moderation: updatedReport.moderation,
      is_offline_sync: updatedReport.is_offline_sync,
    };

    res.json(reportResponse);
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const adminLogin: RequestHandler = (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      res.json({
        success: true,
        token: `${ADMIN_USERNAME}:${ADMIN_PASSWORD}`, // In production, generate proper JWT
      });
    } else {
      res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });
    }
  } catch (error) {
    console.error("Error in admin login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
