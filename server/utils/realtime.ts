/**
 * Enhanced Real-time Dashboard Notifications using Socket.IO
 * 
 * Features:
 * - Real-time report submission notifications with shortId, priority, timestamp
 * - Status updates and escalations
 * - Admin dashboard live updates
 * - Proper connection/disconnection handling
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
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log('👥 Admin client connected:', socket.id);
    try {
      const origin = socket.handshake.headers.origin || socket.handshake.headers.referer || 'unknown-origin';
      const remoteAddress = socket.handshake.address || socket.conn?.remoteAddress || 'unknown-address';
      console.log(`🔎 Socket handshake origin: ${origin}; remote address: ${remoteAddress}`);
    } catch (err) {
      console.warn('⚠️ Could not read socket handshake info:', err);
    }
    
    // Join admin room for notifications
    socket.join('admin');
    // Log current admin room size after join
    try {
      const adminRoom = io.sockets.adapter.rooms.get('admin');
      const adminCount = adminRoom ? adminRoom.size : 0;
      console.log(`👥 Admin room size after join: ${adminCount}`);
      // Broadcast connection status to connected admins
      try {
        notifyConnectionStatus(true, adminCount);
      } catch (statusErr) {
        console.warn('⚠️ Failed to send connection status after join:', statusErr);
      }
    } catch (err) {
      console.warn('⚠️ Could not read admin room after join:', err);
    }
    
    // Send connection confirmation
    socket.emit('connected', {
      message: 'Connected to real-time notifications',
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });
    
    // Handle admin authentication for secure notifications
    socket.on('authenticate', (token) => {
      socket.data.isAuthenticated = true;
      socket.data.token = token;
      console.log(`🔐 Admin client authenticated: ${socket.id}`);
      
      // Send authentication confirmation
      socket.emit('authenticated', {
        message: 'Authentication successful',
        timestamp: new Date().toISOString()
      });
    });

    // Allow client to explicitly join admin room after authentication to avoid race conditions
    socket.on('join_admin_room', (payload) => {
      try {
        socket.join('admin');
        console.log(`🔁 Socket ${socket.id} joined admin room on client request`, payload ? payload : 'no-payload');
        // Notify updated connection status
        try {
          const adminRoom = io?.sockets.adapter.rooms.get('admin');
          const adminCount = adminRoom ? adminRoom.size : 0;
          notifyConnectionStatus(true, adminCount);
        } catch (e) {
          console.warn('⚠️ Could not send connection status after client join:', e);
        }
      } catch (err) {
        console.warn('⚠️ Failed to join admin room on request:', err);
      }
    });
    
    // Handle heartbeat for connection monitoring
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString()
      });
    });

    // Test handler for simulating new report notifications
    socket.on('simulate_new_report', (testData) => {
      console.log('🧪 Simulating new report notification:', testData.data.shortId);
      
      // Broadcast to all admin clients (including the sender)
      io.emit('new_report_notification', testData);
      
      console.log(`📤 Test notification sent for report ${testData.data.shortId}`);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('👋 Admin client disconnected:', socket.id, 'Reason:', reason);
      try {
        const adminRoom = io.sockets.adapter.rooms.get('admin');
        const adminCount = adminRoom ? adminRoom.size : 0;
        console.log(`👥 Admin room size after disconnect: ${adminCount}`);
        try {
          notifyConnectionStatus(adminCount > 0, adminCount);
        } catch (statusErr) {
          console.warn('⚠️ Failed to send connection status after disconnect:', statusErr);
        }
      } catch (err) {
        console.warn('⚠️ Could not read admin room after disconnect:', err);
      }
    });

    socket.on('error', (error) => {
      console.error('🔥 Socket.IO error:', error);
    });
  });

  console.log('🔗 Socket.IO initialized for real-time dashboard notifications');
  return io;
};

/**
 * Broadcast new report submission notification to all admin clients
 * Includes shortId, priority, and timestamp as requested
 */
export const notifyNewReport = (reportData: {
  shortId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: string;
  timestamp: string;
  location?: { latitude: number; longitude: number; address?: string };
  description?: string;
  submittedBy?: string;
  hasMedia: boolean;
}) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized - cannot send notification');
    return;
  }

  const notification = {
    type: 'new_report',
    data: {
      shortId: reportData.shortId,
      priority: reportData.priority,
      timestamp: reportData.timestamp,
      reportType: reportData.type,
      location: reportData.location ? 
        `${reportData.location.latitude.toFixed(6)}, ${reportData.location.longitude.toFixed(6)}` : 
        'Location not provided',
      description: reportData.description?.substring(0, 100) || 'No description',
      submittedBy: reportData.submittedBy || 'Anonymous',
      hasMedia: reportData.hasMedia,
      message: `New ${reportData.priority} priority ${reportData.type} report: ${reportData.shortId}`
    },
    id: `notification_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  try {
    // Inspect admin room and log connected admin count for diagnostics
    let adminCount = 0;
    try {
      const adminRoom = io.sockets.adapter.rooms.get('admin');
      adminCount = adminRoom ? adminRoom.size : 0;
    } catch (countErr) {
      console.warn('⚠️ Could not determine admin room size:', countErr);
    }

    console.log(`📡 Preparing to send new report notification to admins (connected admins: ${adminCount})`);

    // If there are admins connected in the admin room, emit immediately
    if (adminCount > 0) {
      io.to('admin').emit('new_report_notification', notification);
      console.log(`✅ New report notification sent to admin room: ${reportData.shortId}`);
      return;
    }

    // If there are socket connections but no one in the admin room, give clients a short window
    // to finish authentication and join the room (race condition). Retry once after a short delay.
    const totalClients = io.engine ? io.engine.clientsCount : 0;
    if (totalClients > 0) {
      console.log('⏳ No admins in room but sockets connected; retrying emit after 250ms');
      setTimeout(() => {
        try {
          let retryAdminCount = 0;
          try {
            const adminRoom = io.sockets.adapter.rooms.get('admin');
            retryAdminCount = adminRoom ? adminRoom.size : 0;
          } catch (cErr) {
            console.warn('⚠️ Could not determine admin room size on retry:', cErr);
          }

          if (retryAdminCount > 0) {
            io.to('admin').emit('new_report_notification', notification);
            console.log(`✅ New report notification sent to admin room on retry: ${reportData.shortId}`);
            return;
          }

          // Still no admins - emit fallback global event
          console.log('⚠️ Still no clients in admin room after retry - sending global fallback notification');
          io.emit('new_report_notification_fallback', notification);
        } catch (emitErr) {
          console.error('❌ Error during retry emit for new report notification:', emitErr);
        }
      }, 250);
      return;
    }

    // No clients at all - emit fallback (or simply log)
    console.log('⚠️ No connected sockets detected - sending global fallback notification');
    io.emit('new_report_notification_fallback', notification);
    console.log(`✅ New report notification fallback sent: ${reportData.shortId} [${reportData.priority}]`);
  } catch (emitError) {
    console.error('❌ Error while emitting new report notification:', emitError);
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
  comment?: string;
}) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized - cannot send status update');
    return;
  }

  const notification = {
    type: 'report_update',
    data: {
      shortId: updateData.shortId,
      oldStatus: updateData.oldStatus,
      newStatus: updateData.newStatus,
      adminUser: updateData.adminUser,
      timestamp: updateData.timestamp,
      comment: updateData.comment || 'Status updated',
      message: `Report ${updateData.shortId} status: ${updateData.oldStatus} → ${updateData.newStatus}`
    },
    id: `update_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  io.to('admin').emit('report_update_notification', notification);
  
  console.log(`� Report update notification sent: ${updateData.shortId} (${updateData.oldStatus} → ${updateData.newStatus})`);
};

/**
 * Broadcast escalation notification for high-priority reports
 */
export const notifyEscalation = (escalationData: {
  shortId: string;
  priority: string;
  hoursUnprocessed: number;
  timestamp: string;
  type: string;
  reason: string;
}) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized - cannot send escalation notification');
    return;
  }

  const notification = {
    type: 'priority_escalation',
    data: {
      shortId: escalationData.shortId,
      priority: escalationData.priority,
      hoursUnprocessed: escalationData.hoursUnprocessed,
      timestamp: escalationData.timestamp,
      reportType: escalationData.type,
      reason: escalationData.reason,
      message: `🚨 URGENT: ${escalationData.type} report ${escalationData.shortId} requires immediate attention (${escalationData.hoursUnprocessed}h unprocessed)`
    },
    id: `escalation_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  io.to('admin').emit('priority_escalation_notification', notification);
  
  console.log(`🚨 Escalation notification sent: ${escalationData.shortId} (${escalationData.hoursUnprocessed}h unprocessed)`);
};

/**
 * Send connection status updates to admin dashboard
 */
export const notifyConnectionStatus = (isOnline: boolean, adminCount: number) => {
  if (!io) return;

  const statusNotification = {
    type: 'connection_status',
    data: {
      isOnline,
      adminCount,
      timestamp: new Date().toISOString(),
      message: isOnline ? `Dashboard Live - ${adminCount} admin(s) connected` : 'Dashboard Offline'
    },
    id: `status_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  io.to('admin').emit('connection_status_update', statusNotification);
  console.log(`📡 Connection status update: ${isOnline ? 'Online' : 'Offline'} (${adminCount} admins)`);
};

/**
 * Get connected admin clients count for dashboard status
 */
export const getConnectedAdminsCount = async (): Promise<number> => {
  if (!io) return 0;
  
  try {
    const adminRoom = io.sockets.adapter.rooms.get('admin');
    return adminRoom ? adminRoom.size : 0;
  } catch (error) {
    console.error('Error getting admin count:', error);
    return 0;
  }
};

/**
 * Check if Socket.IO server is active and responding
 */
export const isSocketIOActive = (): boolean => {
  return io !== null && io.engine.clientsCount >= 0;
};

/**
 * Generic broadcast function for admin notifications
 */
export const broadcastToAdmins = (event: string, data: any) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized - cannot broadcast to admins');
    return;
  }
  
  io.to('admin').emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
    broadcastId: `broadcast_${Date.now()}`
  });
  console.log(`📡 Broadcasting to admins: ${event}`);
};

/**
 * Send general admin notification with different severity levels
 */
export const notifyAdmins = (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized - cannot send admin notification');
    return;
  }

  const notification = {
    type: 'admin_notification',
    data: {
      message,
      level: type,
      timestamp: new Date().toISOString()
    },
    id: `admin_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  io.to('admin').emit('admin_notification', notification);
  
  console.log(`📣 Admin notification sent: ${message} [${type}]`);
};

export const getSocketIO = () => io;