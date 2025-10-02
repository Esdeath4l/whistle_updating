
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import routes
import { handleDemo } from "./routes/demo.js";
import { handleUploadError } from "./utils/fileUpload.js";
import {
  createReport,
  getReports,
  getReportById,
} from "./routes/reports-mongodb.js";
import { 
  createReportWithGridFS, 
  getGridFSFile 
} from "./routes/gridfs-reports.js";
import {
  getAdminReports,
  updateReportStatus,
  getAdminReportDetails
} from "./routes/admin-reports.js";

// Import new enhanced admin routes
import adminAuthRoutes from "./routes/admin-auth.js";
import adminReportsRoutes from "./routes/admin-reports-enhanced.js";
import adminSMSRoutes from "./routes/admin-sms.js";

// Import middleware
import { requireAuth, requireAdmin, authenticateAdmin } from "./middleware/authMiddleware.js";
import { smsService } from "./sms-service.js";

// Import services
import { initializeNotificationSystem, notifyAdmins } from "./utils/notification-service.js";

// Load environment variables
dotenv.config();

/**
 * ================================================================================================
 * WHISTLE - ENHANCED SECURE REPORTING SERVER
 * ================================================================================================
 * 
 * Features:
 * - Enhanced admin authentication with role-based permissions
 * - Comprehensive report management with encryption support
 * - GridFS integration for large file uploads
 * - Automated notification system with email alerts
 * - Real-time escalation monitoring
 * - Security-focused middleware and error handling
 * 
 * Version: 2.0 (Enhanced Admin System)
 * ================================================================================================
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0-enhanced',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      notifications: 'active'
    }
  });
});

// ================================================================================================
// PUBLIC API ROUTES (No authentication required)
// ================================================================================================

// Demo route
app.get("/api/demo", handleDemo);

// SMS Test route (for testing SMS functionality)
app.get("/api/test-sms", async (req, res) => {
  try {
    console.log('📱 Testing SMS functionality...');
    
    const status = smsService.getStatus();
    console.log('SMS Service Status:', status);
    
    if (!status.configured) {
      return res.json({
        success: false,
        message: 'SMS service not configured',
        status: status
      });
    }
    
    // Send test SMS to +91 9500068744
    const testMessage = `🧪 Whistle SMS Test

This is a test message from the Whistle alert system.

Time: ${new Date().toLocaleString()}
Test ID: ${Math.random().toString(36).substr(2, 8).toUpperCase()}

✅ SMS service is working correctly!

--
Whistle Security Team`;
    
    const result = await smsService.sendSMSToSpecificNumber(testMessage);
    
    res.json({
      success: result,
      message: result ? 'SMS test sent successfully to +91 9500068744' : 'SMS test failed',
      targetNumber: '+91 9500068744',
      status: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('SMS test error:', error);
    res.status(500).json({
      success: false,
      message: 'SMS test failed',
      error: error.message
    });
  }
});

// Report submission (public)
app.post("/api/reports", createReport);
app.post("/api/reports-gridfs", createReportWithGridFS);

// Report retrieval (public with shortId)
app.get("/api/reports", getReports);
app.get("/api/reports/:id", getReportById);

// File serving for GridFS
app.get("/api/files/:id", getGridFSFile);

// ================================================================================================
// ADMIN AUTHENTICATION ROUTES
// ================================================================================================

// Enhanced admin authentication
app.use("/api/admin/auth", adminAuthRoutes);

// Legacy admin login support (for backward compatibility)
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Redirect to new authentication system
    const authData = {
      email: email || username,
      password
    };
    
    // Forward to enhanced auth system
    req.body = authData;
    req.url = '/login';
    adminAuthRoutes(req, res, () => {
      // Callback for next() if needed
    });
    
  } catch (error) {
    console.error('❌ Legacy login redirect failed:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'Please use the new admin login system'
    });
  }
});

// ================================================================================================
// PROTECTED ADMIN ROUTES (Authentication required)
// ================================================================================================

// Enhanced admin reports management
app.use("/api/admin", authenticateAdmin, adminReportsRoutes);

// Admin SMS management
app.use("/api/admin/sms", authenticateAdmin, adminSMSRoutes);

// Legacy admin routes (for backward compatibility)
app.get("/api/admin/reports", requireAdmin, getAdminReports);
app.put("/api/admin/reports/:id", requireAdmin, updateReportStatus);
app.get("/api/admin/reports/:id", requireAdmin, getAdminReportDetails);

// ================================================================================================
// NOTIFICATION AND MONITORING ENDPOINTS
// ================================================================================================

// Test notification system
app.post("/api/admin/test-notification", authenticateAdmin, async (req, res) => {
  try {
    const { type = 'test', reportId } = req.body;
    
    let testReport;
    if (reportId) {
      const ReportModel = (await import('../shared/models/report.js')).default;
      testReport = await ReportModel.findById(reportId);
    } else {
      testReport = {
        _id: 'test-id',
        shortId: 'TEST-001',
        type: 'suggestion',
        priority: 'medium',
        status: 'pending',
        message: 'This is a test notification',
        createdAt: new Date()
      };
    }
    
    await notifyAdmins({
      report: testReport,
      type: type as any
    });
    
    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });
    
  } catch (error) {
    console.error('❌ Test notification failed:', error);
    res.status(500).json({
      error: 'Test notification failed',
      message: error.message
    });
  }
});

// Manual escalation check
app.post("/api/admin/check-escalations", authenticateAdmin, async (req, res) => {
  try {
    const { checkAndEscalateReports } = await import('./utils/notification-service.js');
    await checkAndEscalateReports();
    
    res.json({
      success: true,
      message: 'Escalation check completed'
    });
    
  } catch (error) {
    console.error('❌ Manual escalation check failed:', error);
    res.status(500).json({
      error: 'Escalation check failed',
      message: error.message
    });
  }
});

// ================================================================================================
// FILE UPLOAD ERROR HANDLING
// ================================================================================================

app.use('/api/reports-gridfs', handleUploadError);

// ================================================================================================
// STATIC FILE SERVING
// ================================================================================================

// Serve static files from the dist directory (if exists)
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// Serve uploaded files from the uploads directory
const uploadsPath = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsPath));

// ================================================================================================
// SPA FALLBACK ROUTE
// ================================================================================================

// Serve the main React app for all non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api/")) {
    const indexPath = path.join(distPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.warn('⚠️ Frontend not built, serving basic response');
        res.status(200).send(`
          <html>
            <head><title>Whistle - Admin Setup Required</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1>🔧 Whistle Server Running</h1>
              <p>Admin system is ready for configuration.</p>
              <p>Frontend build not found. Please run the build process.</p>
              <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <h3>API Endpoints:</h3>
                <p><strong>Public:</strong> POST /api/reports (Submit reports)</p>
                <p><strong>Admin:</strong> POST /api/admin/auth/login (Admin login)</p>
                <p><strong>Admin:</strong> POST /api/admin/auth/create-super-admin (Initial setup)</p>
              </div>
            </body>
          </html>
        `);
      }
    });
  } else {
    res.status(404).json({ error: "API endpoint not found" });
  }
});

// ================================================================================================
// ERROR HANDLING MIDDLEWARE
// ================================================================================================

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server error:', err);
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack })
  });
});

// ================================================================================================
// DATABASE CONNECTION & SERVER STARTUP
// ================================================================================================

const startServer = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // Initialize notification system
    initializeNotificationSystem();
    
    // Start the server
    app.listen(PORT, () => {
      console.log('');
      console.log('🎯 ================================================================================================');
      console.log('🔥 WHISTLE ENHANCED ADMIN SERVER RUNNING');
      console.log('🎯 ================================================================================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`📊 Admin Dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin`);
      console.log(`🔐 Health Check: http://localhost:${PORT}/health`);
      console.log('');
      console.log('📋 Admin Setup:');
      console.log(`   1. Create super admin: POST /api/admin/auth/create-super-admin`);
      console.log(`   2. Login: POST /api/admin/auth/login`);
      console.log(`   3. Manage reports: GET /api/admin/reports`);
      console.log('');
      console.log('🔧 Environment Status:');
      console.log(`   📧 Email notifications: ${process.env.SMTP_USER ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`   🔐 JWT Secret: ${process.env.JWT_SECRET ? '✅ SET' : '❌ USING DEFAULT'}`);
      console.log(`   🗄️ Database: ${process.env.MONGODB_URI ? '✅ CONFIGURED' : '❌ NOT SET'}`);
      console.log('🎯 ================================================================================================');
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Server termination requested...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

export default app;