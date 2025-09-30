import multer from 'multer';
import { GridFSBucket, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { Request } from 'express';

/**
 * GridFS File Storage for Whistle App
 * 
 * GridFS is MongoDB's solution for storing and retrieving large files.
 * It chunks files into 255KB pieces and stores them across multiple documents,
 * making it ideal for images and videos that exceed BSON document size limits.
 * 
 * Benefits:
 * - No 16MB BSON limit restriction
 * - Automatic chunking and reassembly
 * - Metadata storage for file information
 * - Efficient streaming for large files
 * - Built-in file versioning support
 */

interface FileInfo {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  id: ObjectId;
  filename: string;
  metadata: any;
  bucketName: string;
  chunkSize: number;
  size: number;
  md5: string;
  uploadDate: Date;
}

// GridFS buckets for different file types
let imagesBucket: GridFSBucket;
let videosBucket: GridFSBucket;

/**
 * Initialize GridFS buckets after MongoDB connection
 */
export function initializeGridFS(): void {
  try {
    const db = mongoose.connection.db;
    
    // Separate buckets for images and videos for better organization
    imagesBucket = new GridFSBucket(db, { 
      bucketName: 'images',
      chunkSizeBytes: 255 * 1024 // 255KB chunks (GridFS default)
    });
    
    videosBucket = new GridFSBucket(db, { 
      bucketName: 'videos',
      chunkSizeBytes: 255 * 1024 // 255KB chunks
    });
    
    console.log('✅ GridFS buckets initialized (images, videos)');
  } catch (error) {
    console.error('❌ GridFS initialization failed:', error);
    throw error;
  }
}

/**
 * GridFS Storage Engine for Multer
 * Handles file upload directly to MongoDB GridFS
 */
class GridFSStorage {
  private getBucket(mimetype: string): GridFSBucket {
    if (mimetype.startsWith('image/')) {
      return imagesBucket;
    } else if (mimetype.startsWith('video/')) {
      return videosBucket;
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }
  }

  _handleFile(req: Request, file: Express.Multer.File, cb: (error?: any, info?: Partial<FileInfo>) => void): void {
    try {
      const bucket = this.getBucket(file.mimetype);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
      
      // Create upload stream to GridFS
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: {
          originalName: file.originalname,
          fieldName: file.fieldname,
          mimetype: file.mimetype,
          uploadedAt: new Date(),
          reportId: req.body.reportId || null // Link to report if provided
        }
      });

      // Handle upload completion
      uploadStream.on('finish', () => {
        cb(null, {
          id: uploadStream.id,
          filename: filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: (uploadStream as any).bytesUploaded || 0,
          bucketName: (bucket as any).bucketName || (file.mimetype.startsWith('image/') ? 'images' : 'videos'),
          uploadDate: new Date()
        });
      });

      // Handle upload errors
      uploadStream.on('error', (error) => {
        cb(error);
      });

      // Pipe file stream to GridFS
      file.stream.pipe(uploadStream);

    } catch (error) {
      cb(error);
    }
  }

  _removeFile(req: Request, file: Express.Multer.File & { id?: ObjectId }, cb: (error?: any) => void): void {
    try {
      if (file.id) {
        const bucket = this.getBucket(file.mimetype);
        bucket.delete(file.id).then(() => cb()).catch(cb);
      } else {
        cb();
      }
    } catch (error) {
      cb(error);
    }
  }
}

/**
 * Multer configuration for GridFS storage
 */
export const gridfsUpload = multer({
  storage: new GridFSStorage() as any,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Validate file types
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

/**
 * Get file from GridFS by ID
 */
export async function getFileById(fileId: string, bucketName: 'images' | 'videos'): Promise<{ stream: NodeJS.ReadableStream; file: any }> {
  try {
    const objectId = new ObjectId(fileId);
    const bucket = bucketName === 'images' ? imagesBucket : videosBucket;
    
    // Get file metadata
    const files = await bucket.find({ _id: objectId }).toArray();
    if (files.length === 0) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    const file = files[0];
    
    // Create download stream
    const downloadStream = bucket.openDownloadStream(objectId);
    
    return { stream: downloadStream, file };
  } catch (error) {
    console.error('GridFS file retrieval error:', error);
    throw error;
  }
}

/**
 * Delete file from GridFS by ID
 */
export async function deleteFileById(fileId: string, bucketName: 'images' | 'videos'): Promise<void> {
  try {
    const objectId = new ObjectId(fileId);
    const bucket = bucketName === 'images' ? imagesBucket : videosBucket;
    
    await bucket.delete(objectId);
    console.log(`File deleted from GridFS: ${fileId}`);
  } catch (error) {
    console.error('GridFS file deletion error:', error);
    throw error;
  }
}

/**
 * Get file metadata from GridFS
 */
export async function getFileMetadata(fileId: string, bucketName: 'images' | 'videos'): Promise<any> {
  try {
    const objectId = new ObjectId(fileId);
    const bucket = bucketName === 'images' ? imagesBucket : videosBucket;
    
    const files = await bucket.find({ _id: objectId }).toArray();
    if (files.length === 0) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    return files[0];
  } catch (error) {
    console.error('GridFS metadata retrieval error:', error);
    throw error;
  }
}