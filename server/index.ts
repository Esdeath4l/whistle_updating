import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { handleDemo } from "./routes/demo";
import { handleUploadError } from "./utils/fileUpload";
import {
  createReport,
  getReports,
  getReportById,
} from "./routes/reports-mongodb";
import { 
  createReportWithGridFS, 
  getGridFSFile 
} from "./routes/gridfs-reports";
import { adminLogin } from "./routes/adminLogin";
import {
  streamNotifications,
  testEmailNotification,
} from "./utils/notificationHelpers";
import { requireAuth, requireAdmin } from "./middleware/authMiddleware";

/**
 * Enhanced Whistle Server with JWT Authentication and Security
 * 
 * Security Features:
 * - Environment-based admin authentication
 * - JWT token-based authorization
 * - Protected admin routes
 * - Data encryption for sensitive information
 * - Comprehensive notification system
 */
export function createServer() {
  const app = express();

  // Middleware with increased limits for large file uploads
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8080'],
    credentials: true
  }));
  
  // Increased payload limits for large image/video uploads
  app.use(express.json({ 
    limit: "1200mb"  // Increased to support 1000MB videos + 500MB images + overhead
  }));
  app.use(express.urlencoded({ 
    extended: true,
    limit: "1200mb"  // Also increase URL-encoded limit
  }));

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Serve uploaded files statically
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Public routes (no authentication required)
  app.get("/ping", (_req, res) => {
    console.log("Ping endpoint hit");
    try {
      res.json({ message: "Hello from Whistle server!" });
    } catch (error) {
      console.error("Error in ping route:", error);
      res.status(500).json({ error: "Ping failed" });
    }
  });
  
  app.get("/test", async (_req, res) => {
    console.log("Test endpoint hit");
    try {
      // Test MongoDB connection without making queries
      const mongoose = await import("mongoose");
      const connectionState = mongoose.default.connection.readyState;
      
      res.json({ 
        message: "Test endpoint working",
        mongoState: connectionState,
        mongoStates: {
          0: "disconnected",
          1: "connected", 
          2: "connecting",
          3: "disconnecting"
        }
      });
    } catch (error) {
      console.error("Error in test route:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/demo", handleDemo);
  
  // Test route for debugging
  app.post("/test-submit", (req, res) => {
    console.log("Test submission received:", req.body);
    res.json({ success: true, message: "Test submission successful" });
  });

  // Temporary admin setup endpoint (remove in production)
  app.post("/setup-admin", async (req, res) => {
    try {
      const AdminModel = (await import("../shared/models/Admin")).default;
      const { AdminRole } = await import("../shared/models/Admin");
      const { AuthService } = await import("./utils/auth");
      
      // Check if any admin exists
      const existingAdmin = await AdminModel.findOne({});
      if (existingAdmin) {
        return res.json({ 
          success: false, 
          message: "Admin already exists. Use existing credentials or reset database." 
        });
      }

      // Create initial admin
      const hashedPassword = await AuthService.hashPassword('admin123');
      const admin = new AdminModel({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@whistle.com',
        role: AdminRole.SUPERADMIN,
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true
      });

      await admin.save();
      
      res.json({ 
        success: true, 
        message: "Initial admin created successfully!",
        credentials: {
          username: "admin",
          password: "admin123",
          email: "admin@whistle.com"
        }
      });
    } catch (error) {
      console.error("Setup admin error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Public report routes (API prefix handled by Vite middleware)
  app.post("/reports", createReport); // Unified report creation - /api/reports
  app.get("/reports/:id", getReportById); // Get single report by ID - /api/reports/:id
  
  // GridFS file serving routes  
  app.get("/files/:fileId", getGridFSFile); // Serve GridFS files - /api/files/:fileId
  app.get("/files/images/:fileId", getGridFSFile); // Serve GridFS images - /api/files/images/:fileId
  app.get("/files/videos/:fileId", getGridFSFile); // Serve GridFS videos - /api/files/videos/:fileId

  // Public admin authentication routes
  app.post("/admin/login", adminLogin);

  // Protected admin routes (JWT required) - apply new middleware
  app.get("/reports", requireAuth, requireAdmin, getReports); // Get all reports (admin only)

  // Protected notification routes (JWT required)
  app.get("/notifications/stream", requireAuth, requireAdmin, streamNotifications); // Real-time notifications
  app.post("/notifications/test-email", requireAuth, requireAdmin, testEmailNotification); // Test email system

  // Serve static files in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Serve static files from the dist/spa directory
    const staticPath = path.join(__dirname, '../spa');
    app.use(express.static(staticPath));
    
    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          error: 'API route not found',
          path: req.originalUrl
        });
      }
      
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  } else {
    // In development, let Vite handle the SPA routing
    // Only return 404 for API routes that don't exist
    app.use('/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'API route not found',
        path: req.originalUrl
      });
    });
  }

  // File upload error handler (must come before global error handler)
  app.use(handleUploadError);

  // Global error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server Error:', err);
    
    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
      success: false,
      error: isDevelopment ? err.message : 'Internal server error',
      ...(isDevelopment && { stack: err.stack })
    });
  });

  return app;
}
