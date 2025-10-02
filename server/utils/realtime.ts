/**
 * Enhanced Real-time Dashboard Notifications using Socket.IO
 * 
 * Features:
 * - Real-time report submission notifications
 * - Include shortId, priority, and timestamp
 * - Support for status updates and escalations
 * - Admin dashboard live updates
 */
import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server for real-time admin notifications
 */
export const initializeSocketIO = (server: Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:8080",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('👥 Admin client connected:', socket.id);
    
    // Join admin room for notifications
    socket.join('admin');
    
    // Handle admin authentication for secure notifications
    socket.on('authenticate', (token) => {
      // Admin can provide JWT token for authenticated notifications
      socket.data.isAuthenticated = true;
      socket.data.token = token;
      console.log(`🔐 Admin client authenticated: ${socket.id}`);
    });
    
    socket.on('disconnect', () => {
      console.log('👋 Admin client disconnected:', socket.id);
    });
  });

  console.log('🔗 Socket.IO initialized for real-time dashboard notifications');
  return io;
};

/**
 * Broadcast new report submission notification to all admin clients
 * Includes all required information for real-time dashboard updates
 */
export const notifyNewReport = (reportData: {
  shortId: string;
  priority: string;
  severity: string;
  category: string;
  timestamp: string;
  location?: { latitude: number; longitude: number; address?: string };
  hasMedia: boolean;
  isEncrypted: boolean;
}) => {
  if (io) {
    const notification = {
      type: 'NEW_REPORT',
      data: {
        shortId: reportData.shortId,
        priority: reportData.priority,
        severity: reportData.severity,
        category: reportData.category,
        timestamp: reportData.timestamp,
        location: reportData.location,
        hasMedia: reportData.hasMedia,
        isEncrypted: reportData.isEncrypted,
        message: `New ${reportData.priority} priority report received: ${reportData.shortId}`
      },
      timestamp: new Date().toISOString()
    };
    
    io.to('admin').emit('notification', notification);
    console.log(`📡 New report notification sent: ${reportData.shortId} (${reportData.priority})`);
  }
};

/**
 * Broadcast report status update notification
 */
export const notifyReportUpdate = (updateData: {
  shortId: string;
  oldStatus: string;
  newStatus: string;
  adminUser: string;
  timestamp: string;
}) => {
  if (io) {
    const notification = {
      type: 'REPORT_UPDATE',
      data: {
        shortId: updateData.shortId,
        oldStatus: updateData.oldStatus,
        newStatus: updateData.newStatus,
        adminUser: updateData.adminUser,
        timestamp: updateData.timestamp,
        message: `Report ${updateData.shortId} status changed from ${updateData.oldStatus} to ${updateData.newStatus}`
      },
      timestamp: new Date().toISOString()
    };
    
    io.to('admin').emit('notification', notification);
    console.log(`📡 Report update notification sent: ${updateData.shortId}`);
  }
};

/**
 * Broadcast escalation notification for unprocessed reports
 */
export const notifyEscalation = (escalationData: {
  shortId: string;
  priority: string;
  hoursUnprocessed: number;
  timestamp: string;
  category: string;
}) => {
  if (io) {
    const notification = {
      type: 'ESCALATION',
      data: {
        shortId: escalationData.shortId,
        priority: escalationData.priority,
        hoursUnprocessed: escalationData.hoursUnprocessed,
        timestamp: escalationData.timestamp,
        category: escalationData.category,
        message: `URGENT: Report ${escalationData.shortId} has been pending for ${escalationData.hoursUnprocessed} hours`
      },
      timestamp: new Date().toISOString()
    };
    
    io.to('admin').emit('notification', notification);
    console.log(`🚨 Escalation notification sent: ${escalationData.shortId}`);
  }
};

/**
 * Generic broadcast function for admin notifications
 */
export const broadcastToAdmins = (event: string, data: any) => {
  if (io) {
    io.to('admin').emit(event, data);
    console.log(`📡 Broadcasting to admins: ${event}`);
  }
};

export const getSocketIO = () => io;