import { RequestHandler } from "express";
import {
  Report as ReportType,
  GetReportsResponse,
  UpdateReportRequest,
  ReportStatus,
  ReportCategory,
  LocationData,
  ModerationResult,
} from "../../shared/api";
import ReportModel from "../../shared/models/report";
import { notifyNewReport } from "./notifications";
import { AuthService } from "../utils/auth";

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

export const getReports: RequestHandler = async (req, res) => {
  try {
    const { status } = req.query;

    // Build query filter
    const filter: any = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    // Get reports with pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const reports = await ReportModel.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ReportModel.countDocuments(filter);

    // Convert to API format
    const formattedReports: ReportType[] = reports.map((report) => ({
      id: report._id.toString(),
      shortId: report.shortId,
      message: report.message,
      category: report.category,
      severity: report.severity,
      imageFileIds: report.imageFileIds,
      videoFileIds: report.videoFileIds,
      status: report.status,
      admin_response: report.admin_response,
      admin_response_at: report.admin_response_at?.toISOString(),
      encrypted_data: report.encrypted_data,
      is_encrypted: report.is_encrypted,
      location: report.location,
      moderation: report.moderation,
      is_offline_sync: report.is_offline_sync,
      created_at: report.created_at.toISOString(),
      history: report.history,
    }));

    const response: GetReportsResponse = {
      reports: formattedReports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getReportStatus: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await ReportModel.findById(id).lean();

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Return minimal status info for anonymous lookup
    const statusInfo = {
      id: report._id.toString(),
      shortId: report.shortId,
      status: report.status,
      created_at: report.created_at.toISOString(),
      admin_response: report.admin_response,
      admin_response_at: report.admin_response_at?.toISOString(),
    };

    res.json(statusInfo);
  } catch (error) {
    console.error("Error fetching report status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateReport: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_response }: UpdateReportRequest = req.body;

    const updateData: any = {
      updated_at: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    if (admin_response) {
      updateData.admin_response = admin_response;
      updateData.admin_response_at = new Date();
    }

    // Add status change to history
    const historyEntry = {
      status: status || "pending",
      updated_at: new Date(),
      admin_user: req.user?.username || "Unknown Admin",
      comment: admin_response || "Status updated",
    };

    const updatedReport = await ReportModel.findByIdAndUpdate(
      id,
      {
        ...updateData,
        $push: { history: historyEntry },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Convert to API format
    const reportResponse: ReportType = {
      id: updatedReport._id.toString(),
      shortId: updatedReport.shortId,
      message: updatedReport.message,
      category: updatedReport.category,
      severity: updatedReport.severity,
      imageFileIds: updatedReport.imageFileIds,
      videoFileIds: updatedReport.videoFileIds,
      status: updatedReport.status,
      admin_response: updatedReport.admin_response,
      admin_response_at: updatedReport.admin_response_at?.toISOString(),
      encrypted_data: updatedReport.encrypted_data,
      is_encrypted: updatedReport.is_encrypted,
      location: updatedReport.location,
      moderation: updatedReport.moderation,
      is_offline_sync: updatedReport.is_offline_sync,
      created_at: updatedReport.created_at.toISOString(),
      history: updatedReport.history,
    };

    res.json(reportResponse);
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getReportByShortId: RequestHandler = async (req, res) => {
  try {
    const { shortId } = req.params;

    const report = await ReportModel.findOne({ shortId }).lean();

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Return minimal status info for anonymous lookup
    const statusInfo = {
      id: report._id.toString(),
      shortId: report.shortId,
      status: report.status,
      created_at: report.created_at.toISOString(),
      admin_response: report.admin_response,
      admin_response_at: report.admin_response_at?.toISOString(),
    };

    res.json(statusInfo);
  } catch (error) {
    console.error("Error fetching report by shortId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Protected routes with authentication
export const getReportsProtected = [AuthService.authenticateAdmin, getReports];
export const updateReportProtected = [AuthService.authenticateAdmin, updateReport];