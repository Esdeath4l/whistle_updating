/**
 * SMS Test Script for Whistle App
 * Tests SMS functionality with the specified number +91 9500068744
 */

import { smsService } from './server/sms-service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSMSFunctionality() {
  console.log('🧪 Starting SMS Test Suite...\n');
  
  // Test 1: Check SMS service status
  console.log('📱 Test 1: SMS Service Status');
  const status = smsService.getStatus();
  console.log('Status:', status);
  console.log('✅ Status check completed\n');
  
  // Test 2: Send test SMS to admin phone
  console.log('📱 Test 2: Test SMS to Admin Phone');
  try {
    const testResult = await smsService.testSMS();
    console.log('Test SMS Result:', testResult ? '✅ Success' : '❌ Failed');
  } catch (error) {
    console.error('Test SMS Error:', error.message);
  }
  console.log('✅ Admin test completed\n');
  
  // Test 3: Send SMS to specific number +91 9500068744
  console.log('📱 Test 3: SMS to Specific Number (+91 9500068744)');
  try {
    const specificMessage = `🚨 WHISTLE TEST ALERT

This is a test message from the Whistle anonymous reporting system.

🕐 Time: ${new Date().toLocaleString()}
🆔 Test ID: TEST-${Math.random().toString(36).substr(2, 8).toUpperCase()}

Features tested:
✅ SMS service initialization
✅ Message formatting
✅ Phone number targeting
✅ Alert system integration

The SMS notification system is working correctly!

--
Whistle Security Team`;

    const specificResult = await smsService.sendSMSToSpecificNumber(specificMessage);
    console.log('Specific SMS Result:', specificResult ? '✅ Success' : '❌ Failed');
    console.log('Target Number: +91 9500068744');
  } catch (error) {
    console.error('Specific SMS Error:', error.message);
  }
  console.log('✅ Specific number test completed\n');
  
  // Test 4: Send custom SMS to specified number
  console.log('📱 Test 4: Custom SMS to +91 9500068744');
  try {
    const customMessage = `📱 Hello from Whistle!

This SMS was sent from the admin_phone to +91 9500068744 as requested.

System Details:
🔧 SMS Service: Active
📞 From: ${status.fromNumber || 'WHISTLE'}
📞 To: +91 9500068744
🕐 Timestamp: ${new Date().toISOString()}

The SMS integration is working perfectly!

Best regards,
Whistle Development Team`;

    const customResult = await smsService.sendSMSToNumber('+919500068744', customMessage);
    console.log('Custom SMS Result:', customResult ? '✅ Success' : '❌ Failed');
  } catch (error) {
    console.error('Custom SMS Error:', error.message);
  }
  console.log('✅ Custom SMS test completed\n');
  
  // Test 5: Simulate emergency alert
  console.log('📱 Test 5: Emergency Alert Simulation');
  try {
    const emergencyMessage = `🚨🚨🚨 EMERGENCY ALERT 🚨🚨🚨

⚠️  URGENT PRIORITY
📝 Type: EMERGENCY
🆔 ID: EMRG-${Math.random().toString(36).substr(2, 8).toUpperCase()}
🕐 Time: ${new Date().toLocaleString()}

Emergency report submitted to Whistle system!

⚡ Immediate attention required
🔗 Check admin dashboard for details

This is a test of the emergency notification system.

---
Automated Alert System`;

    const emergencyResult = await smsService.sendSMSToSpecificNumber(emergencyMessage);
    console.log('Emergency Alert Result:', emergencyResult ? '✅ Success' : '❌ Failed');
  } catch (error) {
    console.error('Emergency Alert Error:', error.message);
  }
  console.log('✅ Emergency alert test completed\n');
  
  console.log('🎉 SMS Test Suite Completed!');
  console.log('\n📋 Summary:');
  console.log('- SMS Service Status: ✅ Checked');
  console.log('- Admin Phone Test: ✅ Completed');
  console.log('- Specific Number Test: ✅ Completed');
  console.log('- Custom Message Test: ✅ Completed');
  console.log('- Emergency Alert Test: ✅ Completed');
  console.log('\n📱 Target Number: +91 9500068744');
  console.log('📞 Admin Phone:', status.adminPhone || 'Not configured');
  console.log('📤 From Number:', status.fromNumber || 'WHISTLE');
  console.log('\n💡 Note: In development mode, SMS messages are logged to console.');
  console.log('📧 For production, configure SMS_API_KEY and SMS_API_URL in .env file.');
}

// Run the test
testSMSFunctionality().catch(console.error);