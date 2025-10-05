/**
 * Shared types between client and server for Whistle app
 */

export interface Report {
  id: string;
  message: string;
  category: ReportCategory;
  
  // GridFS file storage - primary file references
  imageFileIds?: string[]; // GridFS file IDs for images
  videoFileIds?: string[]; // GridFS file IDs for videos
  
  // Server-side file references for GridFS
  photo_file_id?: string; // Single photo file ID from server
  video_file_id?: string; // Single video file ID from server
  files?: {
    photo?: {
      id: string;
      filename: string;
      contentType: string;
      size: number;
      uploadDate: string;
      url: string;
    };
    video?: {
      id: string;
      filename: string;
      contentType: string;
      size: number;
      uploadDate: string;
      url: string;
    };
  };
  
  // Legacy URL fields for backward compatibility
  photo_url?: string;
  video_url?: string;
  
  video_metadata?: VideoMetadata;
  created_at: string;
  status: ReportStatus;
  admin_response?: string;
  admin_response_at?: string;
  severity?: ReportSeverity;
  
  // Enhanced admin fields
  type?: string; // Report type
  priority?: string; // Priority level
  updated_at?: string; // Last update timestamp
  resolved_at?: string; // Resolution timestamp
  escalated_at?: string; // Escalation timestamp
  reporter_email?: string; // Reporter email (admin only)
  admin_notes?: string; // Admin notes
  admin_comment?: string; // Admin comment
  
  // Encrypted data fields
  encrypted_data?: EncryptedReportData;
  is_encrypted?: boolean;
  // New features
  location?: LocationData;
  moderation?: ModerationResult;
  is_offline_sync?: boolean;
  // Enhanced security and tracking
  shortId: string; // Required for anonymous status lookups
  history?: StatusHistory[];
}

/**
 * High-precision location data with GPS accuracy validation
 * Captured using navigator.geolocation with enableHighAccuracy: true
 */
export interface LocationData {
  latitude: number; // WGS84 coordinate (-90 to 90)
  longitude: number; // WGS84 coordinate (-180 to 180)
  accuracy: number; // Horizontal accuracy in meters (required for precision)
  altitude?: number; // Height above sea level in meters
  altitudeAccuracy?: number; // Vertical accuracy in meters
  heading?: number; // Direction of travel (0-359 degrees)
  speed?: number; // Speed in meters per second
  timestamp: number; // Unix timestamp when location was captured
  address?: string; // Human-readable address from reverse geocoding
  capturedAt?: Date; // When location was recorded in the report
  source: 'browser_gps' | 'network' | 'passive' | 'manual'; // Location data source (required)
}

/**
 * GridFS file reference for MongoDB Atlas storage
 */
export interface GridFSFileRef {
  fileId: string; // MongoDB ObjectId as string
  filename: string; // Original filename
  mimetype: string; // File MIME type
  size: number; // File size in bytes
  uploadDate: Date; // When file was uploaded
  bucketName: 'images' | 'videos'; // GridFS bucket name
}

export interface ModerationResult {
  isFlagged: boolean;
  reason?: string;
  confidence: number;
  detectedTerms: string[];
}

export interface StatusHistory {
  status: ReportStatus;
  admin_user?: string;
  updated_at: string;
  comment?: string;
}

export interface VideoMetadata {
  duration: number; // in seconds
  size: number; // in bytes
  format: string; // MIME type
  width?: number;
  height?: number;
  isRecorded: boolean;
  uploadMethod: "direct" | "resumable";
}

export interface EncryptedReportData {
  encryptedMessage: string;
  encryptedCategory: string;
  encryptedPhotoUrl?: string;
  encryptedVideoUrl?: string;
  encryptedVideoMetadata?: string;
  iv: string;
  timestamp: string;
}

export type ReportStatus = "pending" | "reviewed" | "flagged" | "resolved";
export type ReportCategory =
  | "harassment"
  | "medical"
  | "emergency"
  | "safety"
  | "feedback";
export type ReportSeverity = "low" | "medium" | "high" | "urgent";

export interface CreateReportRequest {
  message: string;
  category: ReportCategory;
  severity?: ReportSeverity;
  // Legacy fields for backward compatibility
  photo_url?: string;
  video_url?: string;
  video_metadata?: VideoMetadata;
  // For encrypted submissions
  encrypted_data?: EncryptedReportData;
  is_encrypted?: boolean;
  // New features
  location?: LocationData;
  share_location?: boolean;
  is_offline_sync?: boolean;
}

export interface CreateReportResponse {
  id: string;
  message: string;
  created_at: string;
  shortId: string; // Always included for frontend to display
}

export interface GetReportsResponse {
  reports: Report[];
  total: number;
}

export interface ReportStatusResponse {
  id: string;
  status: ReportStatus;
  created_at: string;
  admin_response?: string;
  admin_response_at?: string;
  // Additional fields for better display
  message?: string;
  category?: ReportCategory;
  severity?: ReportSeverity;
  location?: LocationData;
  is_encrypted?: boolean;
}

export interface UpdateReportRequest {
  status?: ReportStatus;
  admin_response?: string;
}

export interface AdminAuthRequest {
  username: string;
  password: string;
}

export interface AdminAuthResponse {
  success: boolean;
  token?: string;
}

/**
 * Legacy demo interface (keeping for compatibility)
 */
export interface DemoResponse {
  message: string;
}
