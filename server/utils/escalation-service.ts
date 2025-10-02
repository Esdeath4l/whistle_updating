/**
 * Escalation Service for Multi-Admin Report Management
 * Handles automatic escalation emails based on report age and admin activity
 */

import nodemailer from 'nodemailer';
import { IReport } from '../../shared/models/report';
import { AdminService } from './admin-service';
import ReportModel from '../../shared/models/report';

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

export class EscalationService {
  private static transporter: nodemailer.Transporter | null = null;
  private static isInitialized = false;
  
  /**
   * Initialize email service
   */
  static initialize(): void {
    if (this.isInitialized) return;
    
    try {
      if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
        console.warn('⚠️ Email service not configured. Missing EMAIL_USER or EMAIL_PASS environment variables.');
        return;
      }
      
      this.transporter = nodemailer.createTransport(EMAIL_CONFIG);
      this.isInitialized = true;
      
      console.log('📧 Escalation email service initialized');
      
      // Test email configuration
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email service verification failed:', error);
        } else {
          console.log('✅ Email service ready for escalation notifications');
        }
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }
  
  /**
   * Start escalation monitoring
   * Checks for reports needing escalation every 30 minutes
   */
  static startEscalationMonitoring(): void {
    console.log('🔄 Starting escalation monitoring...');
    
    // Check immediately
    this.checkForEscalations();
    
    // Then check every 30 minutes
    setInterval(() => {
      this.checkForEscalations();
    }, 30 * 60 * 1000); // 30 minutes
    
    console.log('✅ Escalation monitoring started (checks every 30 minutes)');
  }
  
  /**
   * Check for reports needing escalation and send emails
   */
  static async checkForEscalations(): Promise<void> {
    try {
      console.log('🔍 Checking for reports needing escalation...');
      
      // Find reports needing escalation using the model's static method
      const reportsNeedingEscalation = await ReportModel.findNeedingEscalation();
      
      if (reportsNeedingEscalation.length === 0) {
        console.log('✅ No reports need escalation at this time');
        return;
      }
      
      console.log(`📋 Found ${reportsNeedingEscalation.length} reports needing escalation`);
      
      // Get primary admin for escalation emails
      const primaryAdmin = await AdminService.getPrimaryAdmin();
      
      if (!primaryAdmin) {
        console.error('❌ No primary admin found for escalation emails');
        return;
      }
      
      // Send escalation email for each report
      for (const report of reportsNeedingEscalation) {
        try {
          await this.sendEscalationEmail(report, primaryAdmin.email);
          
          // Update lastEscalationSentAt to prevent duplicate emails
          report.lastEscalationSentAt = new Date();
          await report.save();
          
          console.log(`✅ Escalation email sent for report ${report.shortId}`);
        } catch (error) {
          console.error(`❌ Failed to send escalation email for report ${report.shortId}:`, error);
          // Continue with other reports even if one fails
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking for escalations:', error);
    }
  }
  
  /**
   * Send escalation email to primary admin
   */
  static async sendEscalationEmail(report: IReport, adminEmail: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }
    
    const ageInHours = Math.floor((Date.now() - report.createdAt.getTime()) / (1000 * 60 * 60));
    const hasBeenViewed = report.viewedBy && report.viewedBy.length > 0;
    
    // Determine escalation type
    let escalationType = '';
    let escalationReason = '';
    
    if (report.status === 'pending' && !hasBeenViewed && ageInHours >= 2) {
      escalationType = 'FIRST ESCALATION';
      escalationReason = `Report has been pending for ${ageInHours} hours with no admin views`;
    } else if (report.status !== 'resolved' && ageInHours >= 5) {
      escalationType = 'SECOND ESCALATION';
      escalationReason = `Report has been unresolved for ${ageInHours} hours`;
    }
    
    // Create email content
    const subject = `🚨 ${escalationType}: Report ${report.shortId} Needs Attention`;
    
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .report-details { background-color: #f8f9fa; padding: 15px; border-left: 4px solid #e74c3c; margin: 20px 0; }
        .action-button { 
            background-color: #e74c3c; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 4px; 
            display: inline-block; 
            margin: 20px 0;
        }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .priority-urgent { color: #e74c3c; font-weight: bold; }
        .priority-high { color: #f39c12; font-weight: bold; }
        .priority-medium { color: #3498db; font-weight: bold; }
        .priority-low { color: #27ae60; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 ${escalationType}</h1>
        <p>Report ${report.shortId} Requires Immediate Attention</p>
    </div>
    
    <div class="content">
        <h2>Escalation Details</h2>
        <p><strong>Reason:</strong> ${escalationReason}</p>
        
        <div class="report-details">
            <h3>Report Information</h3>
            <p><strong>Report ID:</strong> ${report.shortId}</p>
            <p><strong>Type:</strong> ${report.type || report.category || 'Not specified'}</p>
            <p><strong>Priority:</strong> <span class="priority-${report.priority || 'medium'}">${(report.priority || report.severity || 'medium').toUpperCase()}</span></p>
            <p><strong>Status:</strong> ${report.status.toUpperCase()}</p>
            <p><strong>Created:</strong> ${report.createdAt.toLocaleString()}</p>
            <p><strong>Age:</strong> ${ageInHours} hours</p>
            
            ${hasBeenViewed ? 
              `<p><strong>Viewed by:</strong> ${report.viewedBy.join(', ')}</p>` : 
              '<p><strong>Viewed by:</strong> <span style="color: #e74c3c;">No admin has viewed this report</span></p>'
            }
            
            ${report.location ? 
              `<p><strong>Location:</strong> ${report.location.city || 'Unknown'}, ${report.location.country || 'Unknown'}</p>` : 
              ''
            }
        </div>
        
        <h3>Report Message</h3>
        <div class="report-details">
            <p>${report.message.substring(0, 500)}${report.message.length > 500 ? '...' : ''}</p>
        </div>
        
        <a href="${process.env.CLIENT_URL || 'http://localhost:8080'}/admin" class="action-button">
            🔗 View in Admin Dashboard
        </a>
        
        <h3>Next Steps</h3>
        <ul>
            <li>Review the report details in the admin dashboard</li>
            <li>Take appropriate action based on the report type and priority</li>
            <li>Mark the report as resolved when action is completed</li>
            <li>Escalate to authorities if necessary</li>
        </ul>
        
        <h3>Escalation Intervals</h3>
        <ul>
            <li><strong>2-3 hours:</strong> First escalation if report is pending with no admin views</li>
            <li><strong>5-6 hours:</strong> Second escalation if report is not resolved</li>
        </ul>
    </div>
    
    <div class="footer">
        <p>This is an automated message from the Whistle Admin System</p>
        <p>Report generated at: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
    `;
    
    const mailOptions = {
      from: `"Whistle Admin System" <${EMAIL_CONFIG.auth.user}>`,
      to: adminEmail,
      subject,
      html: emailBody
    };
    
    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Escalation email sent to ${adminEmail} for report ${report.shortId}`);
    } catch (error) {
      console.error(`❌ Failed to send escalation email:`, error);
      throw error;
    }
  }
  
  /**
   * Send test escalation email (for testing purposes)
   */
  static async sendTestEscalationEmail(adminEmail: string): Promise<{ success: boolean; message: string; }> {
    try {
      if (!this.transporter) {
        return {
          success: false,
          message: 'Email service not initialized'
        };
      }
      
      const testReport = {
        shortId: 'TEST123',
        type: 'test',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        viewedBy: [],
        message: 'This is a test escalation email to verify the email service is working correctly.',
        location: {
          city: 'Test City',
          country: 'Test Country'
        }
      } as any;
      
      await this.sendEscalationEmail(testReport, adminEmail);
      
      return {
        success: true,
        message: 'Test escalation email sent successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to send test escalation email:', error);
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`
      };
    }
  }
}

export default EscalationService;