import { RequestHandler } from "express";
import { 
  GetReportsResponse, 
  ReportStatus,
  ReportCategory,
  ReportSeverity 
} from "../../shared/api";
import ReportModel from "../../shared/models/report";
import { DataEncryption } from "../utils/encryption";
import { AuthRequest } from "../middleware/authMiddleware";
import { getFile, getDecryptedFile } from "../utils/gridfs";

/**
 * ENHANCED ADMIN REPORTS MANAGEMENT WITH COMPREHENSIVE GRIDFS MEDIA SUPPORT
 * 
 * This module provides complete GridFS media retrieval and display functionality
 * for the Whistle admin dashboard, including:
 * - Multiple photo/video support per report
 * - Automatic decryption of encrypted media metadata
 * - Error handling for missing or corrupted files
 * - Base64 encoding for frontend rendering
 * - Comprehensive file type detection
 */

// Status mapping utilities
const mapAPIStatusToInternalStatus = (apiStatus: ReportStatus): string => {
  const mapping = {
    'pending': 'pending',
    'reviewed': 'reviewed', 
    'flagged': 'flagged',
    'resolved': 'resolved'
  };
  return mapping[apiStatus] || 'pending';
};

const mapStatusToAPIStatus = (internalStatus: string): ReportStatus => {
  const mapping = {
    'pending': 'pending' as ReportStatus,
    'reviewed': 'reviewed' as ReportStatus,
    'flagged': 'flagged' as ReportStatus,
    'resolved': 'resolved' as ReportStatus
  };
  return mapping[internalStatus] || 'pending' as ReportStatus;
};

const mapLocationToAPILocation = (location: any) => {
  if (!location) return undefined;
  
  return {
    latitude: location.latitude || location.lat,
    longitude: location.longitude || location.lng,
    accuracy: location.accuracy,
    address: location.address,
    timestamp: location.timestamp,
    source: location.source || 'unknown'
  };
};

/**
 * COMPREHENSIVE GRIDFS MEDIA RETRIEVAL FUNCTION
 * 
 * This function handles all aspects of GridFS file retrieval:
 * - Fetches file streams from GridFS
 * - Converts binary data to base64 for frontend display
 * - Handles both encrypted and unencrypted files
 * - Provides detailed metadata including file type detection
 * - Implements error handling for missing/corrupted files
 */
async function getComprehensiveMediaFiles(report: any) {
  const mediaFiles = {
    images: [] as Array<{
      id: string;
      filename: string;
      contentType: string;
      size: number;
      base64Data: string;
      url: string;
      displayName: string;
      uploadDate: string;
      isEncrypted: boolean;
    }>,
    videos: [] as Array<{
      id: string;
      filename: string;
      contentType: string;
      size: number;
      base64Data?: string; // Optional for large videos
      url: string;
      displayName: string;
      uploadDate: string;
      duration?: number;
      isEncrypted: boolean;
    }>,
    totalCount: 0,
    hasMedia: false
  };

  try {
    console.log(`📁 Processing media files for report: ${report.shortId}`);
    console.log(`🔍 Debug report fields:`, {
      imageFileIds: report.imageFileIds,
      videoFileIds: report.videoFileIds,
      photo_file_id: report.photo_file_id,
      video_file_id: report.video_file_id,
      additional_media: report.additional_media,
      hasImageFileIds: !!report.imageFileIds,
      hasVideoFileIds: !!report.videoFileIds,
      hasPhotoFileId: !!report.photo_file_id,
      hasVideoFileId: !!report.video_file_id,
      hasAdditionalMedia: !!report.additional_media
    });

    // Process legacy imageFileIds array (if any custom reports use this)
    if (report.imageFileIds && Array.isArray(report.imageFileIds)) {
      console.log(`📸 Processing ${report.imageFileIds.length} images from imageFileIds array`);
      
      for (let i = 0; i < report.imageFileIds.length; i++) {
        const fileId = report.imageFileIds[i];
        try {
          // Get file metadata and content from GridFS
          const fileInfo = await getFile(fileId);
          const { buffer, metadata, filename, contentType } = await getDecryptedFile(fileId);
          
          // Convert to base64 for small images (< 5MB)
          let base64Data = '';
          if (buffer.length < 5 * 1024 * 1024) {
            base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
          }

          mediaFiles.images.push({
            id: fileId,
            filename: filename || `image_${i + 1}.jpg`,
            contentType: contentType || 'image/jpeg',
            size: buffer.length,
            base64Data,
            url: `/api/files/images/${fileId}`,
            displayName: `Image ${i + 1}`,
            uploadDate: fileInfo.metadata?.uploadDate?.toISOString() || new Date().toISOString(),
            isEncrypted: metadata?.encrypted || false
          });

          console.log(`✅ Image ${i + 1} processed: ${filename} (${buffer.length} bytes)`);
        } catch (imageError) {
          console.error(`❌ Failed to process image ${fileId}:`, imageError.message);
          
          // Add placeholder for failed image
          mediaFiles.images.push({
            id: fileId,
            filename: `image_${i + 1}_error.jpg`,
            contentType: 'image/jpeg',
            size: 0,
            base64Data: '',
            url: `/api/files/images/${fileId}`,
            displayName: `Image ${i + 1} (Error)`,
            uploadDate: new Date().toISOString(),
            isEncrypted: false
          });
        }
      }
    }

    // Check for additional image field variations
    if (!report.imageFileIds && !report.photo_file_id) {
      // Check if images are stored in other formats
      const possibleImageFields = ['imageFiles', 'image_file_id', 'images', 'files_image'];
      for (const field of possibleImageFields) {
        if (report[field]) {
          console.log(`📸 Found images in alternate field: ${field}`, report[field]);
        }
      }
    }

    // Process primary photo_file_id (single photo)
    if (report.photo_file_id && !report.imageFileIds) {
      const fileId = report.photo_file_id.toString(); // Convert ObjectId to string
      console.log(`📸 Processing single photo from photo_file_id: ${fileId}`);
      
      try {
        const fileInfo = await getFile(fileId);
        const { buffer, metadata, filename, contentType } = await getDecryptedFile(fileId);
        
        let base64Data = '';
        if (buffer.length < 5 * 1024 * 1024) {
          base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
        }

        mediaFiles.images.push({
          id: fileId,
          filename: filename || 'photo.jpg',
          contentType: contentType || 'image/jpeg',
          size: buffer.length,
          base64Data,
          url: `/api/files/${fileId}`,
          displayName: 'Photo Evidence',
          uploadDate: fileInfo.metadata?.uploadDate?.toISOString() || new Date().toISOString(),
          isEncrypted: metadata?.encrypted || false
        });

        console.log(`✅ Single photo processed: ${filename} (${buffer.length} bytes)`);
      } catch (photoError) {
        console.error(`❌ Failed to process photo ${fileId}:`, photoError.message);
      }
    }

    // Process additional_media array (multiple media files from model)
    if (report.additional_media && Array.isArray(report.additional_media)) {
      console.log(`📁 Processing ${report.additional_media.length} files from additional_media array`);
      
      for (let i = 0; i < report.additional_media.length; i++) {
        const fileId = report.additional_media[i].toString(); // Convert ObjectId to string
        try {
          const fileInfo = await getFile(fileId);
          const { buffer, metadata, filename, contentType } = await getDecryptedFile(fileId);
          
          // Determine if it's an image or video based on content type
          const isImage = contentType.startsWith('image/');
          const isVideo = contentType.startsWith('video/');
          
          if (isImage) {
            let base64Data = '';
            if (buffer.length < 5 * 1024 * 1024) {
              base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
            }

            mediaFiles.images.push({
              id: fileId,
              filename: filename || `media_${i + 1}.jpg`,
              contentType: contentType,
              size: buffer.length,
              base64Data,
              url: `/api/files/${fileId}`,
              displayName: `Media Image ${i + 1}`,
              uploadDate: fileInfo.metadata?.uploadDate?.toISOString() || new Date().toISOString(),
              isEncrypted: metadata?.encrypted || false
            });

            console.log(`✅ Additional media image processed: ${filename} (${buffer.length} bytes)`);
          } else if (isVideo) {
            let base64Data = undefined;
            if (buffer.length < 10 * 1024 * 1024) {
              base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
            }

            mediaFiles.videos.push({
              id: fileId,
              filename: filename || `media_${i + 1}.mp4`,
              contentType: contentType,
              size: buffer.length,
              base64Data,
              url: `/api/files/${fileId}`,
              displayName: `Media Video ${i + 1}`,
              uploadDate: fileInfo.metadata?.uploadDate?.toISOString() || new Date().toISOString(),
              duration: metadata?.duration,
              isEncrypted: metadata?.encrypted || false
            });

            console.log(`✅ Additional media video processed: ${filename} (${buffer.length} bytes)`);
          }
        } catch (mediaError) {
          console.error(`❌ Failed to process additional media ${fileId}:`, mediaError.message);
        }
      }
    }

    // Process videoFileIds array (multiple videos)
    if (report.videoFileIds && Array.isArray(report.videoFileIds)) {
      console.log(`🎥 Processing ${report.videoFileIds.length} videos from videoFileIds array`);
      
      for (let i = 0; i < report.videoFileIds.length; i++) {
        const fileId = report.videoFileIds[i];
        try {
          const fileInfo = await getFile(fileId);
          const { buffer, metadata, filename, contentType } = await getDecryptedFile(fileId);
          
          // Don't include base64 for large videos to avoid memory issues
          let base64Data = undefined;
          if (buffer.length < 10 * 1024 * 1024) { // Only for videos < 10MB
            base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
          }

          mediaFiles.videos.push({
            id: fileId,
            filename: filename || `video_${i + 1}.mp4`,
            contentType: contentType || 'video/mp4',
            size: buffer.length,
            base64Data,
            url: `/api/files/videos/${fileId}`,
            displayName: `Video ${i + 1}`,
            uploadDate: fileInfo.metadata?.uploadDate?.toISOString() || new Date().toISOString(),
            duration: metadata?.duration,
            isEncrypted: metadata?.encrypted || false
          });

          console.log(`✅ Video ${i + 1} processed: ${filename} (${buffer.length} bytes)`);
        } catch (videoError) {
          console.error(`❌ Failed to process video ${fileId}:`, videoError.message);
          
          // Add placeholder for failed video
          mediaFiles.videos.push({
            id: fileId,
            filename: `video_${i + 1}_error.mp4`,
            contentType: 'video/mp4',
            size: 0,
            url: `/api/files/videos/${fileId}`,
            displayName: `Video ${i + 1} (Error)`,
            uploadDate: new Date().toISOString(),
            isEncrypted: false
          });
        }
      }
    }

    // Process single video_file_id (server format)
    if (report.video_file_id && !report.videoFileIds) {
      const fileId = report.video_file_id.toString(); // Convert ObjectId to string
      console.log(`🎥 Processing single video from video_file_id: ${fileId}`);
      
      try {
        const fileInfo = await getFile(fileId);
        const { buffer, metadata, filename, contentType } = await getDecryptedFile(fileId);
        
        let base64Data = undefined;
        if (buffer.length < 10 * 1024 * 1024) {
          base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
        }

        mediaFiles.videos.push({
          id: fileId,
          filename: filename || 'video.mp4',
          contentType: contentType || 'video/mp4',
          size: buffer.length,
          base64Data,
          url: `/api/files/${fileId}`,
          displayName: 'Video Evidence',
          uploadDate: fileInfo.metadata?.uploadDate?.toISOString() || new Date().toISOString(),
          duration: metadata?.duration,
          isEncrypted: metadata?.encrypted || false
        });

        console.log(`✅ Single video processed: ${filename} (${buffer.length} bytes)`);
      } catch (videoError) {
        console.error(`❌ Failed to process video ${fileId}:`, videoError.message);
      }
    }

    // Calculate totals
    mediaFiles.totalCount = mediaFiles.images.length + mediaFiles.videos.length;
    mediaFiles.hasMedia = mediaFiles.totalCount > 0;

    console.log(`📊 Media processing complete for ${report.shortId}: ${mediaFiles.images.length} images, ${mediaFiles.videos.length} videos`);
    
    return mediaFiles;

  } catch (error) {
    console.error(`❌ Error processing media files for ${report.shortId}:`, error);
    return mediaFiles; // Return empty media files structure
  }
}

/**
 * ENHANCED ADMIN REPORTS RETRIEVAL WITH COMPREHENSIVE MEDIA SUPPORT
 * 
 * This endpoint provides:
 * - Complete report data with decryption
 * - All GridFS media files with base64 conversion for small files
 * - Detailed error handling and logging
 * - Multiple photo/video support per report
 * - Encrypted metadata handling
 */
export const getAdminReportsWithMedia: RequestHandler = async (req: AuthRequest, res) => {
  try {
    console.log("📊 Enhanced admin dashboard: Fetching reports with comprehensive media support");
    
    const statusFilter = req.query.status as string;
    console.log("🔍 Status filter applied:", statusFilter || "all");
    
    // Build filter query
    let filterQuery: any = {};
    if (statusFilter && statusFilter !== "all") {
      const internalStatus = mapAPIStatusToInternalStatus(statusFilter as ReportStatus);
      filterQuery.status = internalStatus;
    }
    
    // Get reports with all encrypted fields
    const reports = await ReportModel.find(filterQuery)
      .select('+message_encrypted +message_iv +message_salt +location_encrypted +location_iv +location_salt +encrypted_data +encryption_iv +encryption_auth_tag')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    console.log(`📋 Found ${reports.length} reports to process with media`);

    // Process each report with comprehensive media retrieval
    const processedReports = await Promise.all(reports.map(async (report: any) => {
      try {
        // Ensure encryption flag is set
        if (report.is_encrypted !== true) {
          await ReportModel.updateOne(
            { _id: report._id },
            { $set: { is_encrypted: true } }
          );
          report.is_encrypted = true;
        }
        
        // Decrypt the report
        let decryptedReport;
        try {
          decryptedReport = await DataEncryption.decryptReportDocument(report);
        } catch (decryptError) {
          console.error(`❌ Decryption failed for ${report.shortId}:`, decryptError);
          decryptedReport = report;
        }
        
        // Get comprehensive media files from GridFS
        const mediaFiles = await getComprehensiveMediaFiles(report);

        // Build enhanced report response
        return {
          id: report.shortId,
          _id: report._id.toString(),
          shortId: report.shortId,
          message: decryptedReport.message || '[NO MESSAGE]',
          category: (report.category || report.type || 'feedback') as ReportCategory,
          severity: (report.severity || report.priority || 'medium') as ReportSeverity,
          status: mapStatusToAPIStatus(report.status || 'pending'),
          
          // Legacy fields for backward compatibility
          photo_url: report.photo_url,
          video_url: report.video_url,
          photo_file_id: report.photo_file_id,
          video_file_id: report.video_file_id,
          imageFileIds: report.imageFileIds,
          videoFileIds: report.videoFileIds,
          
          // Enhanced media files with comprehensive data
          mediaFiles: mediaFiles,
          
          // Enhanced files object with metadata
          files: {
            photo: mediaFiles.images[0] ? {
              id: mediaFiles.images[0].id,
              filename: mediaFiles.images[0].filename,
              contentType: mediaFiles.images[0].contentType,
              size: mediaFiles.images[0].size,
              uploadDate: mediaFiles.images[0].uploadDate,
              url: mediaFiles.images[0].url,
              base64Data: mediaFiles.images[0].base64Data
            } : undefined,
            video: mediaFiles.videos[0] ? {
              id: mediaFiles.videos[0].id,
              filename: mediaFiles.videos[0].filename,
              contentType: mediaFiles.videos[0].contentType,
              size: mediaFiles.videos[0].size,
              uploadDate: mediaFiles.videos[0].uploadDate,
              url: mediaFiles.videos[0].url,
              base64Data: mediaFiles.videos[0].base64Data
            } : undefined
          },
          
          location: mapLocationToAPILocation(decryptedReport.location),
          created_at: report.createdAt?.toISOString() || new Date().toISOString(),
          updated_at: report.updatedAt?.toISOString() || new Date().toISOString(),
          is_encrypted: report.is_encrypted || false,
          admin_comment: decryptedReport.admin_comment,
          admin_notes: decryptedReport.admin_notes,
          resolved_at: report.resolved_at?.toISOString(),
          escalated_at: report.escalated_at?.toISOString(),
          moderation_result: report.moderation_result,
          reporterEmail: decryptedReport.reporterEmail,
          
          // Media summary for quick reference
          mediaSummary: {
            imageCount: mediaFiles.images.length,
            videoCount: mediaFiles.videos.length,
            totalSize: mediaFiles.images.reduce((sum, img) => sum + img.size, 0) + 
                      mediaFiles.videos.reduce((sum, vid) => sum + vid.size, 0),
            hasEncryptedMedia: mediaFiles.images.some(img => img.isEncrypted) || 
                              mediaFiles.videos.some(vid => vid.isEncrypted)
          }
        };
      } catch (error) {
        console.warn("⚠️ Error processing report:", report._id, error);
        
        // Return basic report data if processing fails
        return {
          id: report.shortId || report._id.toString(),
          _id: report._id.toString(),
          shortId: report.shortId || report._id.toString(),
          message: report.message || "[Processing error]",
          category: (report.category || 'feedback') as ReportCategory,
          severity: (report.severity || 'medium') as ReportSeverity,
          status: mapStatusToAPIStatus(report.status || 'pending'),
          created_at: report.createdAt?.toISOString() || new Date().toISOString(),
          updated_at: report.updatedAt?.toISOString() || new Date().toISOString(),
          is_encrypted: report.is_encrypted || false,
          mediaFiles: { images: [], videos: [], totalCount: 0, hasMedia: false },
          mediaSummary: { imageCount: 0, videoCount: 0, totalSize: 0, hasEncryptedMedia: false }
        };
      }
    }));

    // Calculate overall statistics
    const totalImages = processedReports.reduce((sum, report) => sum + (report.mediaSummary?.imageCount || 0), 0);
    const totalVideos = processedReports.reduce((sum, report) => sum + (report.mediaSummary?.videoCount || 0), 0);
    const totalMediaSize = processedReports.reduce((sum, report) => sum + (report.mediaSummary?.totalSize || 0), 0);

    const response: GetReportsResponse = {
      reports: processedReports,
      total: processedReports.length
    };

    console.log(`✅ Enhanced admin dashboard: ${processedReports.length} reports processed with comprehensive media (${totalImages} images, ${totalVideos} videos, ${(totalMediaSize / 1024 / 1024).toFixed(2)}MB total)`);

    res.json(response);

  } catch (error) {
    console.error("❌ Error fetching admin reports with media:", error);
    res.status(500).json({ 
      error: "Failed to fetch admin reports with media",
      message: error.message 
    });
  }
};

/**
 * GET DETAILED REPORT WITH COMPREHENSIVE MEDIA FOR MODAL DISPLAY
 * 
 * This endpoint provides complete report details including:
 * - Decrypted message content
 * - All GridFS media files with base64 data
 * - Precise location coordinates
 * - Complete metadata and file information
 */
export const getAdminReportDetailsWithMedia: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Admin fetching detailed report with comprehensive media: ${id}`);
    
    // Find report by shortId or ObjectId
    let report;
    if (id.length === 8) {
      report = await ReportModel.findOne({ shortId: id })
        .select('+encrypted_data +encryption_iv +encryption_auth_tag +message_encrypted +location_encrypted')
        .lean();
    } else {
      report = await ReportModel.findById(id)
        .select('+encrypted_data +encryption_iv +encryption_auth_tag +message_encrypted +location_encrypted')
        .lean();
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    // Decrypt the report
    let decryptedReport;
    try {
      decryptedReport = await DataEncryption.decryptReportDocument(report);
      console.log(`🔓 Report decrypted successfully: ${report.shortId}`);
    } catch (decryptError) {
      console.error(`❌ Decryption failed for ${report.shortId}:`, decryptError);
      decryptedReport = report;
    }

    // Get comprehensive media files
    const mediaFiles = await getComprehensiveMediaFiles(report);

    // Build detailed response
    const detailedReport = {
      ...decryptedReport,
      id: report.shortId,
      _id: report._id.toString(),
      shortId: report.shortId,
      
      // Enhanced media files with all data
      mediaFiles: mediaFiles,
      
      // Detailed files object
      files: {
        photo: mediaFiles.images[0] || undefined,
        video: mediaFiles.videos[0] || undefined,
        allImages: mediaFiles.images,
        allVideos: mediaFiles.videos
      },
      
      // Enhanced location data
      location: mapLocationToAPILocation(decryptedReport.location),
      
      // Comprehensive metadata
      metadata: {
        hasMedia: mediaFiles.hasMedia,
        imageCount: mediaFiles.images.length,
        videoCount: mediaFiles.videos.length,
        totalMediaSize: mediaFiles.images.reduce((sum, img) => sum + img.size, 0) + 
                       mediaFiles.videos.reduce((sum, vid) => sum + vid.size, 0),
        isEncrypted: report.is_encrypted,
        decryptionStatus: decryptedReport ? 'success' : 'failed'
      }
    };

    console.log(`✅ Enhanced admin report details retrieved: ${report.shortId} (${mediaFiles.images.length} images, ${mediaFiles.videos.length} videos)`);

    res.json({
      success: true,
      report: detailedReport
    });

  } catch (error) {
    console.error("❌ Error fetching detailed admin report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report details",
      message: error.message
    });
  }
};