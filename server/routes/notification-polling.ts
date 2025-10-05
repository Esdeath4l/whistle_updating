import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * NOTIFICATION POLLING ENDPOINT FOR REAL-TIME FALLBACK
 * 
 * This endpoint provides a polling fallback when Socket.io is not available
 * or fails to connect. It allows the admin dashboard to still receive
 * notifications about new reports and updates.
 */

// In-memory notification store (in production, use Redis or database)
let notificationStore: Array<{
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  delivered: boolean;
}> = [];

/**
 * Add notification to the store
 */
export function addNotification(type: string, data: any) {
  const notification = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type,
    data,
    timestamp: new Date(),
    delivered: false
  };
  
  notificationStore.push(notification);
  
  // Keep only last 50 notifications to prevent memory issues
  if (notificationStore.length > 50) {
    notificationStore = notificationStore.slice(-50);
  }
  
  console.log(`📨 Notification added to store: ${type}`);
  return notification;
}

/**
 * Poll for new notifications
 * GET /api/notifications/poll
 */
export const pollNotifications: RequestHandler = async (req: AuthRequest, res) => {
  try {
    console.log('📡 Admin polling for notifications');
    
    // Get undelivered notifications
    const newNotifications = notificationStore.filter(notification => !notification.delivered);
    
    // Mark notifications as delivered
    newNotifications.forEach(notification => {
      notification.delivered = true;
    });
    
    console.log(`📊 Polling response: ${newNotifications.length} new notifications`);
    
    res.json({
      success: true,
      newNotifications,
      totalStored: notificationStore.length,
      serverTime: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error polling notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to poll notifications',
      message: error.message
    });
  }
};

/**
 * Get notification status
 * GET /api/notifications/status
 */
export const getNotificationStatus: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const totalNotifications = notificationStore.length;
    const undeliveredCount = notificationStore.filter(n => !n.delivered).length;
    const lastNotification = notificationStore[notificationStore.length - 1];
    
    res.json({
      success: true,
      status: {
        totalNotifications,
        undeliveredCount,
        lastNotification: lastNotification ? {
          type: lastNotification.type,
          timestamp: lastNotification.timestamp
        } : null,
        storeHealth: 'active'
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting notification status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status'
    });
  }
};

/**
 * Clear delivered notifications (cleanup)
 * POST /api/notifications/cleanup
 */
export const cleanupNotifications: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const beforeCount = notificationStore.length;
    notificationStore = notificationStore.filter(n => !n.delivered);
    const afterCount = notificationStore.length;
    
    console.log(`🧹 Notification cleanup: ${beforeCount - afterCount} delivered notifications removed`);
    
    res.json({
      success: true,
      cleaned: beforeCount - afterCount,
      remaining: afterCount
    });
    
  } catch (error) {
    console.error('❌ Error cleaning notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup notifications'
    });
  }
};