/**
 * Test endpoint for debugging notification issues
 */

import { RequestHandler } from "express";
import { broadcastToAdmins, notifyNewReport } from "../utils/realtime";
import { sendUrgentReportNotifications } from "../utils/notifications";
import { smsService } from "../sms-service";
import { checkEnvironmentVariables } from "../utils/env-checker";

export const testNotifications: RequestHandler = async (req, res) => {
  console.log("🧪 Testing notification systems...");
  
  // First, check environment variables
  const envCheck = checkEnvironmentVariables();
  
  const results = {
    environment: envCheck,
    realTime: { status: 'unknown', error: null },
    sms: { status: 'unknown', error: null, config: null },
    email: { status: 'unknown', error: null },
    overall: 'testing'
  };

  // Test 1: Real-time notifications
  try {
    console.log("📡 Testing real-time notifications...");
    
    const testNotificationData = {
      shortId: 'TEST123',
      priority: 'medium',
      severity: 'medium',
      category: 'test',
      timestamp: new Date().toISOString(),
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        address: 'Test Location, San Francisco, CA'
      },
      hasMedia: false,
      isEncrypted: false
    };

    // Test notifyNewReport function
    await notifyNewReport(testNotificationData);
    results.realTime.status = 'success';
    console.log("✅ Real-time notification test passed");
    
  } catch (error) {
    console.error("❌ Real-time notification test failed:", error);
    results.realTime.status = 'failed';
    results.realTime.error = error.message;
  }

  // Test 2: SMS Service
  try {
    console.log("📱 Testing SMS service...");
    
    // Get SMS service status
    const smsStatus = smsService.getStatus();
    results.sms.config = smsStatus;
    
    if (smsStatus.configured) {
      // Test SMS sending
      const testSMSResult = await smsService.testSMS();
      results.sms.status = testSMSResult ? 'success' : 'failed';
      console.log("✅ SMS service test:", testSMSResult ? 'passed' : 'failed');
    } else {
      results.sms.status = 'not_configured';
      console.log("⚠️ SMS service not configured");
    }
    
  } catch (error) {
    console.error("❌ SMS service test failed:", error);
    results.sms.status = 'failed';
    results.sms.error = error.message;
  }

  // Test 3: Email notifications
  try {
    console.log("📧 Testing email notifications...");
    
    const testReportData = {
      _id: 'test-report-id',
      shortId: 'TEST123',
      category: 'test',
      severity: 'medium',
      message: 'This is a test email notification',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: 'San Francisco',
        country: 'USA'
      },
      timestamp: new Date()
    };

    await sendUrgentReportNotifications(testReportData);
    results.email.status = 'success';
    console.log("✅ Email notification test passed");
    
  } catch (error) {
    console.error("❌ Email notification test failed:", error);
    results.email.status = 'failed';
    results.email.error = error.message;
  }

  // Overall result
  const hasFailures = [results.realTime, results.sms, results.email].some(result => 
    result.status === 'failed'
  );
  
  results.overall = hasFailures ? 'partial_failure' : 'success';

  console.log("🧪 Notification test results:", results);

  res.json({
    success: true,
    message: "Notification systems tested",
    results,
    recommendations: {
      realTime: results.realTime.status === 'failed' ? 
        "Check Socket.io server configuration and client connections" : null,
      sms: results.sms.status === 'not_configured' ? 
        "Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, ADMIN_PHONE_NUMBER" : 
        results.sms.status === 'failed' ? "Check Twilio credentials and account balance" : null,
      email: results.email.status === 'failed' ? 
        "Check email service configuration and credentials" : null
    }
  });
};

export default testNotifications;