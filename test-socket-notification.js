// Test Socket.io notification manually
console.log('🧪 Testing Socket.io notification with sound...');

// Simulate what the server sends when a new report is submitted
const testNotification = {
  type: 'new_report',
  data: {
    shortId: 'TEST123',
    priority: 'high',
    timestamp: new Date().toISOString(),
    reportType: 'harassment',
    location: 'Test Location',
    hasMedia: true
  }
};

// Check if socket.io client is available
if (typeof io !== 'undefined') {
  console.log('✅ Socket.io client found');
  
  // Connect to the server
  const socket = io();
  
  socket.on('connect', () => {
    console.log('🔗 Connected to server');
    
    // Test 1: Trigger a regular notification
    setTimeout(() => {
      console.log('📨 Sending test notification...');
      socket.emit('test_notification', testNotification);
    }, 2000);
    
    // Test 2: Trigger an urgent notification
    setTimeout(() => {
      const urgentNotification = {
        ...testNotification,
        data: {
          ...testNotification.data,
          shortId: 'URGENT789',
          priority: 'urgent'
        }
      };
      console.log('🚨 Sending urgent test notification...');
      socket.emit('test_notification', urgentNotification);
    }, 4000);
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Socket.io connection error:', error);
  });
  
} else {
  console.error('❌ Socket.io client not available');
  
  // Alternative: Direct test using notification service
  if (typeof notificationService !== 'undefined') {
    console.log('🔧 Testing notification service directly...');
    
    // Test default sound
    setTimeout(() => {
      console.log('🔔 Testing default notification sound...');
      notificationService.triggerNewReportNotification({
        reportId: 'TEST123',
        category: 'harassment',
        severity: 'medium'
      });
    }, 1000);
    
    // Test urgent sound
    setTimeout(() => {
      console.log('🚨 Testing urgent notification sound...');
      notificationService.triggerNewReportNotification({
        reportId: 'URGENT789',
        category: 'emergency',
        severity: 'urgent'
      });
    }, 3000);
  } else {
    console.error('❌ Notification service not available');
  }
}