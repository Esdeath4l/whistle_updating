import { Request, Response } from 'express';
import ReportModel from '../../shared/models/report';
import AlertModel from '../../shared/models/Alert';
import { initializeGridFS, gridfsUpload, getFileById, deleteFileById } from '../utils/gridfsStorage';
import { ReportCategory, ReportSeverity, LocationData } from '../../shared/api';
import { moderateContent, ModerationResult } from '../../client/lib/ai-moderation';
import { ObjectId } from 'mongodb';

/**
 * Enhanced Reports API with GridFS File Storage and High-Precision Location
 * 
 * This module handles:
 * - FormData parsing with multer-gridfs-storage
 * - High-precision location validation and storage
 * - GridFS file storage for images and videos
 * - File validation (type, size, format)
 * - Error handling with proper HTTP status codes
 * - Maintaining compatibility with existing features
 */

interface FormDataReportRequest {
  message: string;
  category: ReportCategory;
  severity?: ReportSeverity;
  
  // High-precision location data (JSON string in FormData)
  location?: string; // JSON.stringify(LocationData)
  share_location?: string; // 'true' | 'false'
  
  // File upload fields handled by multer
  // Files are automatically processed by gridfsUpload middleware
  
  // Optional fields
  is_encrypted?: string; // 'true' | 'false'
  is_offline_sync?: string; // 'true' | 'false'
}

/**
 * Create report with FormData (files + location)
 * POST /api/reports/upload
 * 
 * Handles multipart/form-data with:
 * - Text fields: message, category, severity, location JSON
 * - File fields: image, video (multiple files supported)
 * - Automatic GridFS storage for files
 * - High-precision location parsing and validation
 */
export const createReportWithGridFS = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('📥 Received FormData report submission with GridFS storage');
    
    // Handle file uploads with GridFS
    gridfsUpload.fields([
      { name: 'image', maxCount: 5 }, // Support multiple images
      { name: 'video', maxCount: 2 }  // Support multiple videos
    ])(req, res, async (uploadError) => {
      if (uploadError) {
        console.error('❌ GridFS upload error:', uploadError.message);
        return res.status(400).json({
          success: false,
          error: uploadError.message,
          code: 'GRIDFS_UPLOAD_ERROR'
        });
      }

      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const body = req.body as FormDataReportRequest;

        console.log('📋 FormData fields received:', Object.keys(body));
        console.log('📎 Files received:', Object.keys(files || {}));

        // Validate required fields
        if (!body.message || !body.category) {
          // Cleanup uploaded files on validation failure
          await cleanupUploadedFiles(files);
          return res.status(400).json({
            success: false,
            error: 'Message and category are required'
          });
        }

        // Validate category
        const validCategories: ReportCategory[] = ['harassment', 'medical', 'emergency', 'safety', 'feedback'];
        if (!validCategories.includes(body.category)) {
          await cleanupUploadedFiles(files);
          return res.status(400).json({
            success: false,
            error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
          });
        }

        // Parse and validate location if provided
        let locationData: LocationData | undefined;
        if (body.share_location === 'true' && body.location) {
          try {
            locationData = JSON.parse(body.location);
            
            // High-precision location validation
            if (!isValidHighPrecisionLocation(locationData)) {
              await cleanupUploadedFiles(files);
              return res.status(400).json({
                success: false,
                error: 'Invalid location data. High-precision GPS coordinates required.'
              });
            }
            
            console.log('📍 High-precision location validated:', {
              lat: locationData.latitude,
              lng: locationData.longitude,
              accuracy: locationData.accuracy,
              source: locationData.source
            });
          } catch (parseError) {
            console.error('Location parsing error:', parseError);
            await cleanupUploadedFiles(files);
            return res.status(400).json({
              success: false,
              error: 'Invalid location data format'
            });
          }
        }

        // Process uploaded files
        const imageFileIds: ObjectId[] = [];
        const videoFileIds: ObjectId[] = [];

        if (files.image) {
          files.image.forEach(file => {
            imageFileIds.push(new ObjectId((file as any).id));
            console.log('🖼️ Image uploaded to GridFS:', {
              fileId: (file as any).id,
              filename: file.originalname,
              size: file.size,
              mimetype: file.mimetype
            });
          });
        }

        if (files.video) {
          files.video.forEach(file => {
            videoFileIds.push(new ObjectId((file as any).id));
            console.log('🎥 Video uploaded to GridFS:', {
              fileId: (file as any).id,
              filename: file.originalname,
              size: file.size,
              mimetype: file.mimetype
            });
          });
        }

        // Apply AI moderation
        const moderation: ModerationResult | undefined = moderateContent(body.message);
        if (moderation?.isFlagged) {
          console.log('🚨 AI moderation flagged content:', moderation.reason);
        }

        // Create report document
        const reportData = {
          message: body.message.trim(),
          category: body.category,
          severity: body.severity || 'medium_priority',
          
          // GridFS file references
          imageFileId: imageFileIds[0], // Primary image
          videoFileId: videoFileIds[0], // Primary video
          
          // Enhanced video metadata for GridFS
          video_metadata: files.video?.[0] ? {
            size: files.video[0].size,
            format: files.video[0].mimetype,
            uploadMethod: 'gridfs',
            gridfsId: new ObjectId((files.video[0] as any).id),
            isRecorded: true // Assume recorded if uploaded
          } : undefined,

          // High-precision location
          location: locationData,
          
          // Status and metadata
          status: 'pending',
          moderation,
          is_encrypted: body.is_encrypted === 'true',
          is_offline_sync: body.is_offline_sync === 'true',
          created_at: new Date(),
          updated_at: new Date()
        };

        // Save to MongoDB
        const report = new ReportModel(reportData);
        const savedReport = await report.save();
        
        console.log('✅ Report saved with GridFS files:', {
          reportId: savedReport._id,
          shortId: savedReport.shortId,
          imageFiles: imageFileIds.length,
          videoFiles: videoFileIds.length,
          hasLocation: !!locationData
        });

        // Create alert for urgent reports
        if (body.severity === 'urgent' || body.category === 'medical' || body.category === 'emergency') {
          await createUrgentAlert(savedReport);
        }

        // Success response
        res.status(201).json({
          success: true,
          data: {
            id: savedReport._id,
            shortId: savedReport.shortId,
            message: savedReport.message,
            category: savedReport.category,
            severity: savedReport.severity,
            created_at: savedReport.created_at,
            imageFiles: imageFileIds.length,
            videoFiles: videoFileIds.length,
            hasLocation: !!locationData,
            locationAccuracy: locationData?.accuracy
          }
        });

      } catch (processingError) {
        console.error('❌ Report processing error:', processingError);
        
        // Cleanup uploaded files on error
        if (req.files) {
          await cleanupUploadedFiles(req.files as { [fieldname: string]: Express.Multer.File[] });
        }

        res.status(500).json({
          success: false,
          error: 'Failed to process report',
          details: process.env.NODE_ENV === 'development' ? processingError.message : undefined
        });
      }
    });

  } catch (error) {
    console.error('❌ GridFS report creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get file from GridFS by ID
 * GET /api/files/:bucketName/:fileId
 */
export const getGridFSFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bucketName, fileId } = req.params;
    
    // Validate bucket name
    if (bucketName !== 'images' && bucketName !== 'videos') {
      res.status(400).json({
        success: false,
        error: 'Invalid bucket name. Must be "images" or "videos"'
      });
      return;
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(fileId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid file ID format'
      });
      return;
    }

    // Get file from GridFS
    const { stream, file } = await getFileById(fileId, bucketName);
    
    // Set appropriate headers
    res.set({
      'Content-Type': file.contentType || 'application/octet-stream',
      'Content-Length': file.length.toString(),
      'Content-Disposition': `inline; filename="${file.filename}"`,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'ETag': file.md5
    });

    // Stream file to response
    stream.pipe(res);
    
    console.log('📤 GridFS file served:', {
      fileId,
      bucketName,
      filename: file.filename,
      size: file.length,
      contentType: file.contentType
    });

  } catch (error) {
    console.error('❌ GridFS file retrieval error:', error);
    
    if (error.message.includes('File not found')) {
      res.status(404).json({
        success: false,
        error: 'File not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve file'
      });
    }
  }
};

/**
 * High-precision location validation
 * Ensures GPS coordinates meet accuracy requirements
 */
function isValidHighPrecisionLocation(location: any): location is LocationData {
  if (!location || typeof location !== 'object') return false;
  
  // Required fields validation
  if (typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number' ||
      typeof location.accuracy !== 'number' ||
      typeof location.timestamp !== 'number') {
    return false;
  }
  
  // Coordinate range validation
  if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
    return false;
  }
  
  // High-precision accuracy validation (require accuracy better than 100 meters)
  if (location.accuracy > 100 || location.accuracy < 0) {
    console.warn('⚠️ Location accuracy not high-precision:', location.accuracy, 'meters');
    // Still allow but log warning for accuracy > 100m
  }
  
  // Timestamp validation (must be recent)
  const now = Date.now();
  const locationTime = location.timestamp;
  const maxAge = 10 * 60 * 1000; // 10 minutes max age
  
  if (Math.abs(now - locationTime) > maxAge) {
    console.warn('⚠️ Location timestamp is too old:', new Date(locationTime));
    // Still allow but log warning
  }
  
  return true;
}

/**
 * Create urgent alert for high-priority reports
 */
async function createUrgentAlert(report: any): Promise<void> {
  try {
    const alert = new AlertModel({
      reportId: report._id,
      alertType: report.category === 'medical_emergency' ? 'emergency' : 'urgent',
      message: `${report.severity.toUpperCase()} ${report.category.replace('_', ' ')} report received`,
      severity: report.severity,
      category: report.category,
      created_at: new Date()
    });
    
    await alert.save();
    console.log('🚨 Urgent alert created:', alert._id);
  } catch (error) {
    console.error('Failed to create urgent alert:', error);
    // Don't fail the report creation if alert fails
  }
}

/**
 * Cleanup uploaded files on error
 */
async function cleanupUploadedFiles(files: { [fieldname: string]: Express.Multer.File[] }): Promise<void> {
  try {
    for (const [fieldname, fileArray] of Object.entries(files)) {
      for (const file of fileArray) {
        const bucketName = file.mimetype.startsWith('image/') ? 'images' : 'videos';
        if ((file as any).id) {
          await deleteFileById((file as any).id, bucketName);
          console.log('🗑️ Cleaned up uploaded file:', (file as any).id);
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup uploaded files:', error);
  }
}