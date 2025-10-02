import nodemailer from 'nodemailer';
import ReportModel from '../../shared/models/report.js';
import AdminModel from '../models/admin.js';

/**
 * Enhanced Notification Service for Whistle
 * Supports email notifications with escalation workflows
 */

// Initialize email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

interface NotificationData {
  report: any;
  type: 'new_report' | 'urgent_report' | 'escalation' | 'status_update';
  recipient?: string;
  adminNotes?: string;
}

/**
 * Send email notification
 */
export const sendEmailNotification = async (data: NotificationData): Promise<boolean> => {
  try {
    const transporter = createEmailTransporter();
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ Email credentials not configured, skipping email notification');
      return false;
    }

    const { report, type, recipient, adminNotes } = data;
    
    // Determine recipient email
    const toEmail = recipient || process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    
    // Generate email content based on notification type
    let subject = '';
    let htmlContent = '';
    
    switch (type) {
      case 'new_report':
        subject = `🚨 New Report Submitted - ${report.shortId}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">New Report Submitted</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Report ID:</strong> ${report.shortId}</p>
              <p><strong>Type:</strong> ${report.type}</p>
              <p><strong>Priority:</strong> <span style="color: ${report.priority === 'urgent' ? '#dc3545' : '#6c757d'}">${report.priority}</span></p>
              <p><strong>Submitted:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
              ${report.location ? `<p><strong>Location:</strong> ${report.location.lat}, ${report.location.lng}</p>` : ''}
            </div>
            <div style="background: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <h4>Message:</h4>
              <p>${report.message || 'No message provided'}</p>
            </div>
            <div style="margin-top: 20px;">
              <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}/reports/${report._id}" 
                 style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Report
              </a>
            </div>
          </div>
        `;
        break;
        
      case 'urgent_report':
        subject = `🚨 URGENT Report - Immediate Attention Required - ${report.shortId}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: white;">🚨 URGENT REPORT</h2>
              <p style="margin: 5px 0 0 0; color: white;">Immediate attention required</p>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
              <p><strong>Report ID:</strong> ${report.shortId}</p>
              <p><strong>Type:</strong> ${report.type}</p>
              <p><strong>Priority:</strong> <span style="color: #dc3545; font-weight: bold;">URGENT</span></p>
              <p><strong>Submitted:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
              ${report.location ? `<p><strong>Location:</strong> ${report.location.lat}, ${report.location.lng}</p>` : ''}
            </div>
            <div style="background: #fff; border: 1px solid #dee2e6; padding: 20px; margin-top: 10px;">
              <h4 style="color: #dc3545;">Urgent Message:</h4>
              <p>${report.message || 'No message provided'}</p>
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}/reports/${report._id}" 
                 style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                RESPOND NOW
              </a>
            </div>
          </div>
        `;
        break;
        
      case 'escalation':
        subject = `⚠️ Report Escalated - ${report.shortId}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ffc107;">Report Escalated</h2>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Report ID:</strong> ${report.shortId}</p>
              <p><strong>Type:</strong> ${report.type}</p>
              <p><strong>Priority:</strong> ${report.priority}</p>
              <p><strong>Escalated At:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Age:</strong> ${Math.floor((Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60))} hours</p>
            </div>
            <div style="background: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <h4>Original Message:</h4>
              <p>${report.message || 'No message provided'}</p>
              ${adminNotes ? `<h4>Admin Notes:</h4><p>${adminNotes}</p>` : ''}
            </div>
            <div style="margin-top: 20px;">
              <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}/reports/${report._id}" 
                 style="background: #ffc107; color: #212529; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Review Report
              </a>
            </div>
          </div>
        `;
        break;
        
      case 'status_update':
        subject = `📋 Report Status Updated - ${report.shortId}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Report Status Updated</h2>
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Report ID:</strong> ${report.shortId}</p>
              <p><strong>New Status:</strong> <span style="color: #155724; font-weight: bold;">${report.status}</span></p>
              <p><strong>Updated At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            ${adminNotes ? `
              <div style="background: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
                <h4>Admin Notes:</h4>
                <p>${adminNotes}</p>
              </div>
            ` : ''}
          </div>
        `;
        break;
    }
    
    const mailOptions = {
      from: `"Whistle Alerts" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html: htmlContent
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email notification sent: ${type} for report ${report.shortId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Email notification failed:', error);
    return false;
  }
};

/**
 * Send SMS notification (placeholder - SMS service not implemented)
 */
export const sendSMSNotification = async (data: NotificationData): Promise<boolean> => {
  console.warn('⚠️ SMS service not implemented, skipping SMS notification');
  return false;
};

/**
 * Send notification to all relevant admins
 */
export const notifyAdmins = async (data: NotificationData): Promise<void> => {
  try {
    const { report, type } = data;
    
    // Get relevant admins based on notification type
    let adminQuery: any = { is_active: true };
    
    if (type === 'urgent_report' || type === 'escalation') {
      // Notify admins who can resolve reports
      adminQuery['permissions.can_resolve_reports'] = true;
    } else {
      // Notify all admins who can view reports
      adminQuery['permissions.can_view_reports'] = true;
    }
    
    const admins = await AdminModel.find(adminQuery);
    
    // Send email notifications to each admin
    const emailPromises = admins.map(admin => 
      sendEmailNotification({
        ...data,
        recipient: admin.email
      })
    );
    
    await Promise.allSettled(emailPromises);
    
    // Send SMS for urgent reports
    if (type === 'urgent_report' || type === 'escalation') {
      await sendSMSNotification(data);
    }
    
    console.log(`✅ Notifications sent to ${admins.length} admin(s) for ${type}`);
    
  } catch (error) {
    console.error('❌ Failed to notify admins:', error);
  }
};

/**
 * Automated escalation check - run this periodically
 */
export const checkAndEscalateReports = async (): Promise<void> => {
  try {
    // Find urgent reports older than 2 hours that haven't been escalated
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const reportsNeedingEscalation = await ReportModel.find({
      priority: 'urgent',
      status: 'pending',
      createdAt: { $lt: twoHoursAgo },
      escalated_at: { $exists: false }
    });
    
    for (const report of reportsNeedingEscalation) {
      // Mark as escalated
      await ReportModel.findByIdAndUpdate(report._id, {
        status: 'escalated',
        escalated_at: new Date()
      });
      
      // Send escalation notifications
      await notifyAdmins({
        report,
        type: 'escalation'
      });
      
      const ageInHours = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60));
      console.log(`🚨 Auto-escalated report: ${report.shortId} (${ageInHours} hours old)`);
    }
    
  } catch (error) {
    console.error('❌ Auto-escalation check failed:', error);
  }
};

/**
 * Initialize notification system with periodic checks
 */
export const initializeNotificationSystem = (): void => {
  // Check for escalations every 30 minutes
  setInterval(checkAndEscalateReports, 30 * 60 * 1000);
  
  console.log('📧 Notification system initialized');
  console.log(`📧 Email notifications: ${process.env.SMTP_USER ? 'ENABLED' : 'DISABLED'}`);
  console.log(`📱 SMS notifications: DISABLED (not implemented)`);
};