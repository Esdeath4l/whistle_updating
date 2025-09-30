import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmailNotification() {
  console.log('📧 Testing email notification system...');
  
  // Get email configuration from environment
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const FROM_EMAIL = process.env.FROM_EMAIL;
  const FROM_NAME = process.env.FROM_NAME;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  
  console.log('📋 Email Configuration:');
  console.log(`  SMTP Host: ${SMTP_HOST}`);
  console.log(`  SMTP Port: ${SMTP_PORT}`);
  console.log(`  SMTP User: ${SMTP_USER}`);
  console.log(`  From Email: ${FROM_EMAIL}`);
  console.log(`  From Name: ${FROM_NAME}`);
  console.log(`  Admin Email: ${ADMIN_EMAIL}`);
  console.log(`  SMTP Pass: ${SMTP_PASS ? '✅ Configured' : '❌ Not configured'}`);
  
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !FROM_EMAIL || !ADMIN_EMAIL) {
    console.error('❌ Missing email configuration. Please check environment variables.');
    return;
  }
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
    
    // Verify connection
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    // Send test email
    console.log('📤 Sending test email...');
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: '🧪 Whistle Email Test - System Configuration Verified',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">📧 Email System Test</h2>
          <p>This is a test email to verify that the Whistle notification system is working correctly.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #28a745; margin-top: 0;">✅ Configuration Status</h3>
            <ul>
              <li><strong>From Email:</strong> ${FROM_EMAIL}</li>
              <li><strong>Admin Email:</strong> ${ADMIN_EMAIL}</li>
              <li><strong>SMTP Host:</strong> ${SMTP_HOST}</li>
              <li><strong>Authentication:</strong> ✅ Working</li>
            </ul>
          </div>
          
          <p style="color: #6c757d; font-size: 14px;">
            Sent from Whistle Security System<br>
            ${new Date().toLocaleString()}
          </p>
        </div>
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
    console.log(`📬 Email sent from ${FROM_EMAIL} to ${ADMIN_EMAIL}`);
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
  }
}

testEmailNotification();