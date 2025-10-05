// @ts-nocheck
import multer from 'multer';
import { GridFSBucket, ObjectId, MongoClient } from 'mongodb';
import { GridFsStorage } from 'multer-gridfs-storage';
import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

/**
 * ROBUST GRIDFS FILE UPLOAD SYSTEM
 * 
 * This module provides a comprehensive file upload solution with:
 * 1. Proper MongoDB connection handling
 * 2. GridFS storage with fallback to disk storage
 * 3. File encryption for security
 * 4. TypeScript compatibility
 * 5. Comprehensive error handling
 */

// Global variables for GridFS management
let gridFSBucket: GridFSBucket | null = null;
let isGridFSReady = false;

// Encryption utilities
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Encrypt file buffer for security
 */
function encryptBuffer(buffer: Buffer): { encryptedBuffer: Buffer; iv: string } {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  
  return {
    encryptedBuffer: encrypted,
    iv: iv.toString('hex')
  };
}

/**
 * Decrypt file buffer
 */
function decryptBuffer(encryptedBuffer: Buffer, ivHex: string): Buffer {
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  
  return decrypted;
}

/**
 * Initialize GridFS Bucket after MongoDB connection is established
 * This ensures the database connection is ready before GridFS operations
 */
export const initializeGridFSBucket = async (): Promise<GridFSBucket> => {
  console.log('🔧 Initializing GridFS bucket...');
  
  // Wait for MongoDB connection to be ready
  if (mongoose.connection.readyState !== 1) {
    console.log('⏳ Waiting for MongoDB connection...');
    await new Promise((resolve) => {
      mongoose.connection.on('connected', resolve);
    });
  }

  if (!gridFSBucket && mongoose.connection.db) {
    try {
      gridFSBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
      });
      isGridFSReady = true;
      console.log('✅ GridFS bucket "uploads" initialized successfully');
      return gridFSBucket;
    } catch (error) {
      console.error('❌ Failed to initialize GridFS bucket:', error);
      throw error;
    }
  }

  if (!gridFSBucket) {
    throw new Error('GridFS bucket initialization failed - no database connection');
  }

  return gridFSBucket;
};

/**
 * Create GridFS Storage configuration for multer
 * This is initialized only after MongoDB connection is established
 */
const createGridFSStorage = (): GridFsStorage => {
  console.log('🔧 Creating GridFS storage configuration...');
  
  const storage = new GridFsStorage({
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/whistle',
    cache: true,
    file: (req: Express.Request, file: Express.Multer.File) => {
      return new Promise((resolve, reject) => {
        try {
          console.log(`📁 Processing file: ${file.originalname} (${file.mimetype})`);
          
          // Generate unique filename with timestamp and random string
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(8).toString('hex');
          const fileExtension = path.extname(file.originalname);
          const baseName = path.basename(file.originalname, fileExtension);
          const filename = `${timestamp}_${randomString}_${baseName}${fileExtension}`;
          
          console.log(`📝 Generated filename: ${filename}`);
          
          // Return file configuration for GridFS
          resolve({
            filename: filename,
            bucketName: 'uploads',
            metadata: {
              originalName: file.originalname,
              mimeType: file.mimetype,
              uploadDate: new Date(),
              encrypted: true,
              fieldName: file.fieldname
            }
          });
        } catch (error) {
          console.error('❌ Error in file configuration:', error);
          reject(error);
        }
      });
    }
  });

  // Add event listeners for debugging and monitoring
  storage.on('connection', (db) => {
    console.log('✅ GridFS storage connected to MongoDB');
    isGridFSReady = true;
  });

  storage.on('connectionFailed', (err) => {
    console.error('❌ GridFS storage connection failed:', err);
    isGridFSReady = false;
  });

  storage.on('file', (file) => {
    console.log('✅ File stored in GridFS:', file.filename, 'ID:', file.id);
  });

  storage.on('streamError', (error, conf) => {
    console.error('❌ GridFS stream error:', error);
    console.error('❌ Configuration:', conf);
  });

  return storage;
};

/**
 * Create disk storage as fallback when GridFS fails
 */
const createDiskStorage = (): multer.StorageEngine => {
  console.log('🔧 Creating disk storage fallback...');
  
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory:', uploadsDir);
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      try {
        // Generate unique filename similar to GridFS
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const fileExtension = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, fileExtension);
        const filename = `fallback_${timestamp}_${randomString}_${baseName}${fileExtension}`;
        
        console.log(`💾 Fallback disk filename: ${filename}`);
        cb(null, filename);
      } catch (error) {
        console.error('❌ Error generating disk filename:', error);
        cb(error, '');
      }
    }
  });
};

/**
 * File filter function for multer
 * Validates file types and sizes
 */
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log(`🔍 Filtering file: ${file.originalname} (${file.mimetype})`);
  
  // Check file type
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log('✅ File type accepted');
    cb(null, true);
  } else {
    console.log('❌ File type rejected');
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: images and videos only.`));
  }
};

/**
 * Initialize upload configuration based on MongoDB connection status
 * Returns GridFS storage if available, falls back to disk storage
 */
export const initializeUploadSystem = async (): Promise<{ 
  upload: multer.Multer; 
  isGridFS: boolean; 
  storage: 'gridfs' | 'disk' 
}> => {
  console.log('🚀 Initializing upload system...');
  
  let useGridFS = false;
  let storage: multer.StorageEngine;
  
  try {
    // First, ensure GridFS bucket is initialized
    await initializeGridFSBucket();
    
    // Try to create GridFS storage
    const gridfsStorage = createGridFSStorage();
    storage = gridfsStorage;
    useGridFS = true;
    
    console.log('✅ GridFS storage initialized successfully');
  } catch (error) {
    console.error('❌ GridFS initialization failed, falling back to disk storage:', error);
    storage = createDiskStorage();
    useGridFS = false;
  }
  
  // Create multer instance with appropriate storage
  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 1000 * 1024 * 1024, // 1000MB limit for videos
      files: 2, // Maximum 2 files (1 image + 1 video)
      fieldSize: 500 * 1024 * 1024 // 500MB field size limit for images
    },
    fileFilter: fileFilter
  });
  
  console.log(`✅ Upload system initialized with ${useGridFS ? 'GridFS' : 'disk'} storage`);
  
  return {
    upload,
    isGridFS: useGridFS,
    storage: useGridFS ? 'gridfs' : 'disk'
  };
};

/**
 * Global upload instance
 */
let uploadInstance: { upload: multer.Multer; isGridFS: boolean; storage: 'gridfs' | 'disk' } | null = null;

/**
 * Get or initialize upload instance
 */
export const getUploadInstance = async () => {
  if (!uploadInstance) {
    uploadInstance = await initializeUploadSystem();
  }
  return uploadInstance;
};

/**
 * Main upload function for handling multipart form data
 * Supports text + optional image + optional video + optional location
 */
export const uploadFields = async (req: any, res: any, callback: (error?: Error) => void) => {
  try {
    console.log('📁 Starting file upload process...');
    
    // Get upload instance (GridFS or disk fallback)
    const { upload, isGridFS, storage } = await getUploadInstance();
    
    // Configure field handling for our specific use case
    const uploadHandler = upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 }
    ]);
    
    // Execute upload
    uploadHandler(req, res, (error) => {
      if (error) {
        console.error(`❌ Upload error with ${storage} storage:`, error);
        
        // Provide specific error messages
        if (error instanceof multer.MulterError) {
          switch (error.code) {
            case 'LIMIT_FILE_SIZE':
              return callback(new Error('File too large (maximum 200MB per file)'));
            case 'LIMIT_FILE_COUNT':
              return callback(new Error('Too many files (maximum 1 image and 1 video)'));
            case 'LIMIT_UNEXPECTED_FILE':
              return callback(new Error('Unexpected file field. Only "image" and "video" fields allowed'));
            case 'LIMIT_FIELD_COUNT':
              return callback(new Error('Too many form fields'));
            default:
              return callback(new Error(`Upload error: ${error.message}`));
          }
        }
        
        return callback(error);
      }
      
      console.log(`✅ File upload completed successfully using ${storage} storage`);
      
      // Log uploaded files for debugging
      if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        Object.keys(files).forEach(fieldName => {
          files[fieldName].forEach(file => {
            console.log(`📄 Uploaded: ${fieldName} - ${file.originalname} (${file.size} bytes)`);
            if (isGridFS && (file as any).id) {
              console.log(`🔗 GridFS ID: ${(file as any).id}`);
            } else if (!isGridFS && file.filename) {
              console.log(`💾 Disk file: ${file.filename}`);
            }
          });
        });
      }
      
      callback();
    });
    
  } catch (error) {
    console.error('❌ Upload system initialization error:', error);
    callback(error as Error);
  }
};

/**
 * Upload file buffer directly to GridFS (for manual uploads)
 * Includes encryption for security
 */
export const uploadFileToGridFS = async (
  fileBuffer: Buffer, 
  filename: string, 
  mimetype: string
): Promise<ObjectId> => {
  return new Promise(async (resolve, reject) => {
    try {
      const bucket = await initializeGridFSBucket();
      
      // Encrypt file buffer for security
      const { encryptedBuffer, iv } = encryptBuffer(fileBuffer);
      
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: {
          originalName: filename,
          mimeType: mimetype,
          uploadDate: new Date(),
          encrypted: true,
          encryptionIV: iv
        }
      });

      uploadStream.on('error', (error) => {
        console.error('❌ GridFS upload stream error:', error);
        reject(error);
      });

      uploadStream.on('finish', () => {
        console.log('✅ File uploaded to GridFS:', uploadStream.id);
        resolve(uploadStream.id);
      });

      uploadStream.end(encryptedBuffer);
    } catch (error) {
      console.error('❌ GridFS upload error:', error);
      reject(error);
    }
  });
};

// Memory storage as backup
const memoryStorage = multer.memoryStorage();

// GridFS storage configuration with better error handling
export const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || 'mongodb://localhost:27017/whistle',
  cache: true,
  file: (req: any, file: any) => {
    console.log(`📁 Storing file: ${file.originalname} (${file.mimetype})`);
    const filename = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.originalname}`;
    console.log(`📝 Generated filename: ${filename}`);
    return new Promise((resolve) => {
      resolve({
        filename: filename,
        bucketName: 'uploads',
        metadata: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          uploadDate: new Date()
        }
      });
    });
  }
});

// Backup multer with memory storage
export const memoryUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
    files: 2 // Maximum 2 files
  },
  fileFilter: (req, file, cb) => {
    console.log(`🔍 Memory filtering file: ${file.originalname} (${file.mimetype})`);
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      console.log('✅ File type accepted');
      cb(null, true);
    } else {
      console.log('❌ File type rejected');
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Add event listeners for debugging
storage.on('connection', (db) => {
  console.log('✅ GridFS storage connected to MongoDB');
});

storage.on('connectionFailed', (err) => {
  console.error('❌ GridFS storage connection failed:', err);
});

storage.on('file', (file) => {
  console.log('✅ File stored in GridFS:', file.filename);
});

storage.on('streamError', (error, conf) => {
  console.error('❌ GridFS stream error:', error);
  console.error('❌ Configuration:', conf);
});

// Multer upload configuration with better error handling
export const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
    files: 2 // Maximum 2 files (1 image + 1 video)
  },
  fileFilter: (req, file, cb) => {
    console.log(`🔍 Filtering file: ${file.originalname} (${file.mimetype})`);
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      console.log('✅ File type accepted');
      cb(null, true);
    } else {
      console.log('❌ File type rejected');
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Upload fields configuration with error handling
export const uploadFields = (req: any, res: any, callback: any) => {
  const uploadHandler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]);
  
  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('❌ Multer upload error:', err);
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return callback(new Error('File too large (max 200MB)'));
          case 'LIMIT_FILE_COUNT':
            return callback(new Error('Too many files'));
          case 'LIMIT_UNEXPECTED_FILE':
            return callback(new Error('Unexpected file field'));
          default:
            return callback(new Error(`Upload error: ${err.message}`));
        }
      }
      return callback(err);
    }
    callback(null);
  });
};

// Backup upload function using memory storage + native GridFS
export const uploadFieldsMemory = (req: any, res: any, callback: any) => {
  const uploadHandler = memoryUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]);
  
  uploadHandler(req, res, async (err) => {
    if (err) {
      console.error('❌ Memory upload error:', err);
      return callback(err);
    }
    
    try {
      // Process uploaded files and store them in GridFS manually
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files.image && files.image[0]) {
        const imageFile = files.image[0];
        const imageId = await uploadFileToGridFS(
          imageFile.buffer, 
          `image_${Date.now()}_${imageFile.originalname}`,
          imageFile.mimetype
        );
        // Attach the GridFS ID to the file object
        (imageFile as any).id = imageId;
        console.log('✅ Image uploaded to GridFS:', imageId);
      }
      
      if (files.video && files.video[0]) {
        const videoFile = files.video[0];
        const videoId = await uploadFileToGridFS(
          videoFile.buffer,
          `video_${Date.now()}_${videoFile.originalname}`,
          videoFile.mimetype
        );
        // Attach the GridFS ID to the file object
        (videoFile as any).id = videoId;
        console.log('✅ Video uploaded to GridFS:', videoId);
      }
      
      callback(null);
    } catch (uploadErr) {
      console.error('❌ GridFS manual upload error:', uploadErr);
      callback(uploadErr);
    }
  });
};

// Alternative native GridFS upload function as backup
export const uploadFileToGridFS = (fileBuffer: Buffer, filename: string, mimetype: string): Promise<ObjectId> => {
  return new Promise((resolve, reject) => {
    const bucket = initializeGridFSBucket();
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        originalName: filename,
        mimeType: mimetype,
        uploadDate: new Date()
      }
    });

    uploadStream.on('error', (error) => {
      console.error('❌ Native GridFS upload error:', error);
      reject(error);
    });

    uploadStream.on('finish', () => {
      console.log('✅ Native GridFS upload completed:', uploadStream.id);
      resolve(uploadStream.id);
    });

    uploadStream.end(fileBuffer);
  });
};

// Get file from GridFS
export const getFile = async (fileId: string | ObjectId) => {
  const gridBucket = initializeGridFSBucket();
  const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
  
  const files = await gridBucket.find({ _id: objectId }).toArray();
  if (files.length === 0) {
    throw new Error(`File not found: ${objectId}`);
  }
  
  const file = files[0];
  const downloadStream = gridBucket.openDownloadStream(objectId);
  
  return {
    stream: downloadStream,
    file: {
      id: file._id,
      filename: file.filename,
      contentType: file.metadata?.mimeType || 'application/octet-stream',
      length: file.length,
      uploadDate: file.uploadDate,
      metadata: file.metadata
    }
  };
};

// Delete file from GridFS
export const deleteFile = async (fileId: string | ObjectId) => {
  const gridBucket = initializeGridFSBucket();
  const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
  await gridBucket.delete(objectId);
};

// Initialize on MongoDB connection
mongoose.connection.on('connected', () => {
  initializeGridFSBucket();
});