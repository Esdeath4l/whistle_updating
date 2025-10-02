/**
 * Test Urgent Notification System
 * Tests Socket.IO real-time updates and notification service
 */

import { sendUrgentReportNotifications } from './server/utils/notifications.js';
import { broadcastToAdmins, initializeSocketIO } from './server/utils/realtime.js';
import { createServer as createHTTPServer } from 'http';
import express from 'express';

async function testUrgentNotifications() {
  console.log('🧪 Testing Urgent Notification System...\n');

  // Test data
  const testReportData = {
    _id: '507f1f77bcf86cd799439011',
    shortId: 'TEST1234',
    message: 'Emergency situation requiring immediate attention!',
    category: 'emergency',
    severity: 'urgent',
    location: {
      city: 'Test City',
      country: 'Test Country',
      latitude: 40.7128,
      longitude: -74.0060
    },
    timestamp: new Date()
  };

  try {
    // 1. Test Socket.IO initialization
    console.log('1️⃣ Testing Socket.IO initialization...');
    const app = express();
    const httpServer = createHTTPServer(app);
    const io = initializeSocketIO(httpServer);
    console.log('✅ Socket.IO initialized successfully\n');

    // 2. Test real-time broadcast
    console.log('2️⃣ Testing real-time admin broadcast...');
    broadcastToAdmins('urgent-report', {
      reportId: testReportData._id,
      shortId: testReportData.shortId,
      category: testReportData.category,
      severity: testReportData.severity,
      message: testReportData.message,
      created_at: new Date().toISOString()
    });
    console.log('✅ Real-time broadcast test completed\n');

    // 3. Test notification service
    console.log('3️⃣ Testing urgent notification service...');
    
    // Check environment variables
    const hasEmailConfig = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    const hasTwilioConfig = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    
    console.log('📧 Email configuration:', hasEmailConfig ? '✅ Available' : '❌ Missing ENV vars');
    console.log('📱 SMS configuration:', hasTwilioConfig ? '✅ Available' : '❌ Missing ENV vars');
    
    if (hasEmailConfig || hasTwilioConfig) {
      await sendUrgentReportNotifications(testReportData);
      console.log('✅ Notification service test completed\n');
    } else {
      console.log('⚠️  Skipping notification test - missing configuration\n');
    }

    console.log('🎉 All tests completed successfully!');
    
    // Clean up
    httpServer.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (process.argv[1] === new URL(import.meta.url).pathname) {
  testUrgentNotifications();
}

export { testUrgentNotifications };