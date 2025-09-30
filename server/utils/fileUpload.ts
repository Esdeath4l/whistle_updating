import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * File Upload Configuration for Whistle App
 * Handles large image and video uploads with proper validation
 */

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');

// Ensure directories exist
[uploadsDir, imagesDir, videosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination based on file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, imagesDir);
    } else if (file.mimetype.startsWith('video/')) {
      cb(null, videosDir);
    } else {
      cb(new Error('Invalid file type'), '');
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed image types
  const allowedImageTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp'
  ];

  // Allowed video types
  const allowedVideoTypes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/avi',
    'video/wmv',
    'video/mov',
    'video/webm',
    'video/3gpp',
    'video/x-msvideo'
  ];

  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Multer configuration with increased limits
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max file size
    files: 5, // Maximum 5 files per request
    fieldNameSize: 100, // Max field name size
    fieldSize: 1024 * 1024, // 1MB max field value size
    fields: 20, // Max number of non-file fields
  },
});

// Memory storage for temporary processing (if needed)
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max file size
    files: 5,
  },
});

// Specific upload configurations
export const uploadSingle = upload.single('file');
export const uploadMultiple = upload.array('files', 5);
export const uploadFields = upload.fields([
  { name: 'image', maxCount: 3 },
  { name: 'video', maxCount: 2 }
]);

/**
 * Error handler for multer errors
 */
export const handleUploadError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          error: 'File too large. Maximum size is 200MB.',
          code: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(413).json({
          success: false,
          error: 'Too many files. Maximum is 5 files per request.',
          code: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field.',
          code: 'UNEXPECTED_FILE'
        });
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error: ' + err.message,
          code: 'UPLOAD_ERROR'
        });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

/**
 * Cleanup function to delete uploaded files
 */
export const cleanupFiles = (files: Express.Multer.File[] | undefined) => {
  if (!files) return;
  
  files.forEach(file => {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error(`Failed to cleanup file ${file.path}:`, error);
    }
  });
};

/**
 * Get file URL for client access
 */
export const getFileUrl = (req: any, filename: string, type: 'image' | 'video'): string => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/uploads/${type}s/${filename}`;
};