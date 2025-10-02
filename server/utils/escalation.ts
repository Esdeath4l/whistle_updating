/**
 * Automated Escalation System for Unprocessed Reports
 * 
 * Features:
 * - Automatically send email to admin if reports remain unprocessed for 2-3 hours
 * - Include shortId, priority, and creation timestamp
 * - Avoid sending repeated escalations for the same report
 * - Track escalation history to prevent spam
 */

import ReportModel from "../../shared/models/report";
import { sendUrgentReportNotifications } from "./notifications";
import { notifyEscalation } from "./realtime";

interface EscalationTracker {
  [shortId: string]: {
    lastEscalated: Date;
    escalationCount: number;
  };
}

// In-memory tracker to prevent repeated escalations
const escalationTracker: EscalationTracker = {};

/**
 * Check for reports that need escalation and send notifications
 * Should be called periodically (e.g., every 30 minutes)
 */
export async function checkAndEscalateUnprocessedReports(): Promise<void> {
  try {
    console.log("🔍 Checking for reports needing escalation...");
    
    // Find pending reports older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const unprocessedReports = await ReportModel.find({
      status: 'pending',
      createdAt: { $lt: twoHoursAgo }
    }).select('shortId priority severity category createdAt message_encrypted message_iv message_salt location_encrypted location_iv location_salt');
    
    console.log(`📊 Found ${unprocessedReports.length} unprocessed reports older than 2 hours`);
    
    for (const report of unprocessedReports) {
      await processEscalation(report);
    }
    
  } catch (error) {
    console.error("❌ Error checking for escalations:", error);
  }
}

/**
 * Process escalation for a specific report
 */
async function processEscalation(report: any): Promise<void> {
  try {
    const shortId = report.shortId;
    const now = new Date();
    const hoursUnprocessed = Math.floor((now.getTime() - report.createdAt.getTime()) / (1000 * 60 * 60));
    
    // Check if we've already escalated this report recently (within 24 hours)
    const tracker = escalationTracker[shortId];
    if (tracker) {
      const hoursSinceLastEscalation = Math.floor((now.getTime() - tracker.lastEscalated.getTime()) / (1000 * 60 * 60));
      
      // Don't escalate again if we've done so within 24 hours, unless it's been 48+ hours
      if (hoursSinceLastEscalation < 24 && hoursUnprocessed < 48) {
        console.log(`⏭️ Skipping escalation for ${shortId} - last escalated ${hoursSinceLastEscalation} hours ago`);
        return;
      }
      
      // Don't escalate more than 3 times total
      if (tracker.escalationCount >= 3) {
        console.log(`⚠️ Maximum escalations reached for ${shortId}`);
        return;
      }
    }
    
    // Decrypt basic report info for escalation email
    let decryptedMessage = "Encrypted message";
    let priority = report.priority || report.severity || 'medium';
    let category = report.category || 'harassment';
    
    try {
      if (report.message_encrypted && report.message_iv && report.message_salt) {
        const { DataEncryption } = await import("./encryption");
        const encryptedData = {
          encrypted: report.message_encrypted,
          iv: report.message_iv,
          salt: report.message_salt
        };
        decryptedMessage = DataEncryption.decrypt(encryptedData);
      }
    } catch (decryptError) {
      console.warn(`⚠️ Could not decrypt message for escalation ${shortId}:`, decryptError);
    }
    
    // Send escalation email using urgent notification system
    await sendUrgentReportNotifications({
      shortId,
      _id: report._id.toString(),
      category: category as any,
      severity: priority as any,
      message: `ESCALATION: Report ${shortId} has been unprocessed for ${hoursUnprocessed} hours. Preview: ${decryptedMessage.substring(0, 100)}`,
      location: undefined,
      timestamp: report.createdAt
    });
    
    // Send real-time escalation notification
    notifyEscalation({
      shortId,
      priority,
      hoursUnprocessed,
      timestamp: now.toISOString(),
      category
    });
    
    // Update escalation tracker
    escalationTracker[shortId] = {
      lastEscalated: now,
      escalationCount: (tracker?.escalationCount || 0) + 1
    };
    
    console.log(`🚨 Escalation processed for report ${shortId} (${hoursUnprocessed} hours unprocessed)`);
    
  } catch (error) {
    console.error(`❌ Failed to process escalation for ${report.shortId}:`, error);
  }
}

/**
 * Initialize escalation monitoring
 * Sets up periodic checks for unprocessed reports
 */
export function initializeEscalationMonitoring(): void {
  console.log("🚀 Initializing automated escalation monitoring...");
  
  // Check for escalations every 30 minutes
  const escalationInterval = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  // Initial check after 1 minute
  setTimeout(checkAndEscalateUnprocessedReports, 60 * 1000);
  
  // Regular interval checks
  setInterval(checkAndEscalateUnprocessedReports, escalationInterval);
  
  console.log(`✅ Escalation monitoring active - checking every ${escalationInterval / 60000} minutes`);
}

/**
 * Manual escalation check (for testing or admin trigger)
 */
export async function manualEscalationCheck(): Promise<{ escalated: number; total: number }> {
  console.log("🔍 Manual escalation check triggered");
  
  const before = Object.keys(escalationTracker).length;
  await checkAndEscalateUnprocessedReports();
  const after = Object.keys(escalationTracker).length;
  
  return {
    escalated: after - before,
    total: after
  };
}

/**
 * Clear escalation history for a specific report (when it gets processed)
 */
export function clearEscalationHistory(shortId: string): void {
  if (escalationTracker[shortId]) {
    delete escalationTracker[shortId];
    console.log(`🧹 Cleared escalation history for ${shortId}`);
  }
}