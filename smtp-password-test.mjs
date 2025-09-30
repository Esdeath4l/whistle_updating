import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function checkSMTPPassword() {
  console.log('🔍 SMTP Password Verification Test');
  console.log('='.repeat(50));
  
  const config = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    FROM_EMAIL: process.env.FROM_EMAIL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL
  };
  
  console.log('📧 Current Configuration:');
  console.log(`   Host: ${config.SMTP_HOST}`);
  console.log(`   Port: ${config.SMTP_PORT}`);
  console.log(`   User: ${config.SMTP_USER}`);
  console.log(`   Pass: ${config.SMTP_PASS ? config.SMTP_PASS.substring(0, 4) + '*'.repeat(config.SMTP_PASS.length - 4) : 'NOT SET'}`);
  console.log(`   From: ${config.FROM_EMAIL}`);
  console.log(`   To:   ${config.ADMIN_EMAIL}`);
  console.log('');
  
  // Test 1: Check if all required fields are present
  console.log('🔸 Test 1: Configuration Completeness');
  const missingFields = [];
  if (!config.SMTP_HOST) missingFields.push('SMTP_HOST');
  if (!config.SMTP_USER) missingFields.push('SMTP_USER');
  if (!config.SMTP_PASS) missingFields.push('SMTP_PASS');
  if (!config.FROM_EMAIL) missingFields.push('FROM_EMAIL');
  if (!config.ADMIN_EMAIL) missingFields.push('ADMIN_EMAIL');
  
  if (missingFields.length > 0) {
    console.log('❌ Missing required fields:', missingFields.join(', '));
    return;
  } else {
    console.log('✅ All required fields are configured');
  }
  
  // Test 2: Validate email formats
  console.log('🔸 Test 2: Email Format Validation');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(config.SMTP_USER)) {
    console.log('❌ Invalid SMTP_USER email format');
    return;
  }
  if (!emailRegex.test(config.FROM_EMAIL)) {
    console.log('❌ Invalid FROM_EMAIL format');
    return;
  }
  if (!emailRegex.test(config.ADMIN_EMAIL)) {
    console.log('❌ Invalid ADMIN_EMAIL format');
    return;
  }
  console.log('✅ All email formats are valid');
  
  // Test 3: SMTP Connection Test
  console.log('🔸 Test 3: SMTP Connection Test');
  
  try {
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
      },
      debug: true, // Enable debug mode
      logger: true // Enable logging
    });
    
    console.log('🔄 Attempting SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    console.log('✅ Password is correct and authentication works');
    
    return true;
    
  } catch (error) {
    console.log('❌ SMTP connection failed');
    console.log('Error Details:');
    console.log(`   Message: ${error.message}`);
    console.log(`   Code: ${error.code || 'N/A'}`);
    console.log(`   Command: ${error.command || 'N/A'}`);
    
    // Analyze specific error types
    if (error.message.includes('Invalid login')) {
      console.log('');
      console.log('🔍 Analysis: Invalid Login Error');
      console.log('   This typically means:');
      console.log('   1. Wrong username or password');
      console.log('   2. Gmail requires App Password (not regular password)');
      console.log('   3. 2FA is enabled and App Password needed');
      console.log('   4. "Less secure app access" might be disabled');
    } else if (error.message.includes('Application-specific password required')) {
      console.log('');
      console.log('🔍 Analysis: App Password Required');
      console.log('   Gmail account has 2FA enabled.');
      console.log('   You need to generate an App Password:');
      console.log('   1. Go to Google Account settings');
      console.log('   2. Security → 2-Step Verification');
      console.log('   3. App passwords → Generate password for "Mail"');
      console.log('   4. Use that 16-character password instead');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('🔍 Analysis: Connection Refused');
      console.log('   1. Check SMTP host and port');
      console.log('   2. Firewall might be blocking connection');
      console.log('   3. Network connectivity issues');
    }
    
    return false;
  }
}

// Test 4: Password format analysis
function analyzePasswordFormat(password) {
  console.log('🔸 Test 4: Password Format Analysis');
  console.log(`   Length: ${password.length} characters`);
  console.log(`   Format: ${password}`);
  
  if (password.length === 16 && !/\s/.test(password)) {
    console.log('✅ Format matches Gmail App Password (16 chars, no spaces)');
  } else if (password.length > 16) {
    console.log('⚠️  Longer than typical App Password');
  } else {
    console.log('⚠️  Shorter than typical App Password');
  }
  
  if (/[A-Za-z0-9]/.test(password)) {
    console.log('✅ Contains alphanumeric characters');
  } else {
    console.log('⚠️  Unusual character set for App Password');
  }
}

async function main() {
  const password = process.env.SMTP_PASS;
  if (password) {
    analyzePasswordFormat(password);
    console.log('');
  }
  
  const result = await checkSMTPPassword();
  
  console.log('');
  console.log('='.repeat(50));
  if (result) {
    console.log('🎉 SMTP configuration is working correctly!');
  } else {
    console.log('❌ SMTP configuration needs to be fixed');
    console.log('');
    console.log('💡 Recommended Actions:');
    console.log('   1. Verify Gmail account has 2FA enabled');
    console.log('   2. Generate a new App Password for Mail');
    console.log('   3. Update SMTP_PASS in .env file');
    console.log('   4. Test again');
  }
}

main().catch(console.error);