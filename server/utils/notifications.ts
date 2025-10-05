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
  const lat = (reportData.location as any)?.latitude || (reportData.location as any)?.lat;
  const lng = (reportData.location as any)?.longitude || (reportData.location as any)?.lng;
    const mapLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';

    // Color-coded priority label
    const priorityColor = (reportData.severity || '').toLowerCase() === 'urgent' ? '#c9302c' : (reportData.severity || '').toLowerCase() === 'high' ? '#ff7a00' : (reportData.severity || '').toLowerCase() === 'low' ? '#2f9e44' : '#f0ad4e';

    const emailContent = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto;">
        <header style="display:flex; align-items:center; gap:12px; padding:16px 0;">
          <img src="https://unpkg.com/whistle@latest/logo.png" alt="Whistle" style="height:44px"/>
          <h2 style="margin:0">Whistle - Incident Notification</h2>
        </header>
        <section style="padding:12px; background:#fff; border-radius:8px; border:1px solid #e6e6e6">
          <p style="margin:6px 0"><strong>Report ID:</strong> ${reportData.shortId}</p>
          <p style="margin:6px 0"><strong>Priority:</strong> <span style="color:${priorityColor}; font-weight:700; padding:4px 8px; border-radius:4px; background:${priorityColor}22">${(reportData.severity||'').toUpperCase()}</span></p>
          <p style="margin:6px 0"><strong>Time:</strong> ${reportData.timestamp.toLocaleString()}</p>
          <p style="margin:6px 0"><strong>Location:</strong> ${reportData.location?.city || 'Unknown'} ${mapLink ? ` - <a href="${mapLink}">Open in Google Maps</a>` : ''}</p>
          <div style="background:#f9f9f9; padding:10px; border-radius:6px; margin-top:8px;">
            <strong>Message preview:</strong>
            <p style="margin:6px 0">${reportData.message ? reportData.message.substring(0,200) : ''}${reportData.message && reportData.message.length > 200 ? '...' : ''}</p>
          </div>
          <p style="margin-top:12px"><a href="${process.env.ADMIN_DASHBOARD_URL || '/admin'}" style="display:inline-block; padding:8px 12px; background:#0077cc; color:#fff; text-decoration:none; border-radius:6px">Open Admin Dashboard</a></p>
        </section>
        <footer style="margin-top:16px; font-size:12px; color:#888">Whistle Notification System</footer>
      </div>
    `;

    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `Whistle: ${reportData.shortId} - ${(reportData.severity||'').toUpperCase()} ${reportData.category}`,
      html: emailContent
    });

    console.log(`📧 Email notification sent for report: ${reportData.shortId}`);
  } catch (error) {
    console.error(`❌ Email notification failed for ${reportData.shortId}:`, error);
  }
};

const sendSMSNotification = async (reportData: UrgentReportData) => {
  try {
  const lat = (reportData.location as any)?.latitude || (reportData.location as any)?.lat;
  const lng = (reportData.location as any)?.longitude || (reportData.location as any)?.lng;
    const mapLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';

    const smsMessage = `🚨 Whistle Alert
ID: ${reportData.shortId}
Priority: ${(reportData.severity||'').toUpperCase()}
Category: ${reportData.category?.toUpperCase()}
Location: ${lat && lng ? `${lat},${lng}` : (reportData.location?.city || 'Unknown')}
${mapLink ? `Map: ${mapLink}` : ''}
Time: ${reportData.timestamp.toLocaleTimeString()}

Open admin dashboard to review.`;

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