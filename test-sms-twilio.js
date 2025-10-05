#!/usr/bin/env node
/**
 * Test Twilio SMS functionality for Whistle app
 * This script tests if SMS can be sent through Twilio
 */

require('dotenv').config();

async function testTwilioSMS() {
  console.log('📱 Testing Twilio SMS functionality...');
  
  // Check environment variables
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 
    'TWILIO_FROM_NUMBER',
    'ADMIN_PHONE_NUMBER'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    return;
  }
  
  console.log('✅ All required environment variables are set');
  console.log(`📞 From: ${process.env.TWILIO_FROM_NUMBER}`);
  console.log(`📞 To: ${process.env.ADMIN_PHONE_NUMBER}`);
  
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    const message = await client.messages.create({
      body: '🚨 TEST: Whistle SMS notification system is working! This is a test message.',
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.ADMIN_PHONE_NUMBER
    });
    
    console.log('✅ SMS sent successfully!');
    console.log(`📱 Message SID: ${message.sid}`);
    console.log(`📍 Status: ${message.status}`);
    console.log(`🕐 Created: ${message.dateCreated}`);
    
  } catch (error) {
    console.error('❌ Failed to send SMS:', error.message);
    
    if (error.code) {
      console.error(`🔢 Error code: ${error.code}`);
    }
    
    if (error.moreInfo) {
      console.error(`ℹ️  More info: ${error.moreInfo}`);
    }
  }
}

// Run the test
testTwilioSMS().catch(console.error);