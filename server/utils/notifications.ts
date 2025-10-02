/**
 * Notification Service for Urgent Reports
 * Sends Email (Nodemailer) and SMS (Twilio) alerts
 */
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { broadcastToAdmins } from './realtime';

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail', // or use your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Twilio configuration
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export interface UrgentReportData {
  shortId: string;
  _id: string;
  message: string;
  category: string;
  severity: string;
  location?: {
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  timestamp: Date;
}

export const sendUrgentReportNotifications = async (reportData: UrgentReportData) => {
  console.log(`🚨 Sending urgent notifications for report: ${reportData.shortId}`);
  
  try {
    // Send real-time notification to admin dashboard
    broadcastToAdmins('urgent_report', {
      shortId: reportData.shortId,
      _id: reportData._id,
      message: reportData.message.substring(0, 100) + '...',
      category: reportData.category,
      severity: reportData.severity,
      location: reportData.location,
      timestamp: reportData.timestamp
    });

    // Send email notification
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.ADMIN_EMAIL) {
      await sendEmailNotification(reportData);
    }

    // Send SMS notification
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.ADMIN_PHONE_NUMBER) {
      await sendSMSNotification(reportData);
    }

    console.log(`✅ Urgent notifications sent for report: ${reportData.shortId}`);
  } catch (error) {
    console.error(`❌ Failed to send urgent notifications for ${reportData.shortId}:`, error);
  }
};

const sendEmailNotification = async (reportData: UrgentReportData) => {
  try {
    const locationText = reportData.location 
      ? `Location: ${reportData.location.city}, ${reportData.location.country} (${reportData.location.latitude}, ${reportData.location.longitude})`
      : 'Location: Not provided';

    const emailContent = `
      <h2>🚨 URGENT REPORT ALERT</h2>
      <p><strong>Report ID:</strong> ${reportData.shortId}</p>
      <p><strong>Category:</strong> ${reportData.category}</p>
      <p><strong>Severity:</strong> ${reportData.severity}</p>
      <p><strong>Time:</strong> ${reportData.timestamp.toLocaleString()}</p>
      <p><strong>Message Preview:</strong></p>
      <div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
        ${reportData.message.substring(0, 200)}${reportData.message.length > 200 ? '...' : ''}
      </div>
      <p><strong>${locationText}</strong></p>
      <hr>
      <p>Please review this urgent report immediately in the admin dashboard.</p>
      <p><strong>Report Reference:</strong> ${reportData.shortId}</p>
      <p><em>Whistle Security System</em></p>
    `;

    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `🚨 URGENT REPORT: ${reportData.category.toUpperCase()} - ${reportData.severity.toUpperCase()} - ${reportData.shortId}`,
      html: emailContent
    });

    console.log(`📧 Email notification sent for report: ${reportData.shortId}`);
  } catch (error) {
    console.error(`❌ Email notification failed for ${reportData.shortId}:`, error);
  }
};

const sendSMSNotification = async (reportData: UrgentReportData) => {
  try {
    const locationText = reportData.location 
      ? `${reportData.location.city}, ${reportData.location.country}`
      : 'Location unknown';

    const smsMessage = `🚨 URGENT REPORT ALERT
ID: ${reportData.shortId}
Category: ${reportData.category.toUpperCase()}
Severity: ${reportData.severity.toUpperCase()}
Location: ${locationText}
Time: ${reportData.timestamp.toLocaleTimeString()}

Review immediately in admin dashboard.`;

    await twilioClient.messages.create({
      body: smsMessage,
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.ADMIN_PHONE_NUMBER
    });

    console.log(`📱 SMS notification sent for report: ${reportData.shortId}`);
  } catch (error) {
    console.error(`❌ SMS notification failed for ${reportData.shortId}:`, error);
  }
};