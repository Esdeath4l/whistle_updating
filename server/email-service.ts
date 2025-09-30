import nodemailer from 'nodemailer';
import { IAlert } from '../shared/models/Alert';
import { IReport } from '../shared/models/report';

/**
 * Enhanced Email Service for Whistle App
 * Sends alert notifications for urgent/emergency reports
 */

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      console.warn('✉️ Email service not configured. Missing SMTP environment variables.');
      return;
    }

    const emailConfig: EmailConfig = {
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      secure: parseInt(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    };

    this.transporter = nodemailer.createTransport(emailConfig);
    this.isConfigured = true;

    console.log('✉️ Email service initialized');
  }

  async sendAlertNotification(alert: IAlert, report?: IReport): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('Email service not configured. Skipping notification.');
      return false;
    }

    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.error('ADMIN_EMAIL not configured.');
        return false;
      }

      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
      const fromName = process.env.FROM_NAME || 'Whistle Security';
      
      const urgencyBadge = alert.alertType === 'emergency' ? 'EMERGENCY' : 'URGENT';
      const urgencyColor = alert.alertType === 'emergency' ? '#dc3545' : '#fd7e14';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${urgencyColor}; color: white; padding: 20px; text-align: center;">
            <h1>🚨 Security Alert</h1>
            <p>Immediate Attention Required</p>
          </div>
          
          <div style="padding: 30px; background: white;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="background: ${urgencyColor}; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                ${urgencyBadge} ALERT
              </span>
            </div>
            
            <p><strong>Type:</strong> ${alert.alertType.toUpperCase()}</p>
            <p><strong>Severity:</strong> ${alert.severity}</p>
            <p><strong>Created:</strong> ${new Date(alert.created_at).toLocaleString()}</p>
            <p><strong>Report ID:</strong> ${alert.reportId.toString()}</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <strong>Alert Message:</strong><br>
              ${alert.message}
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:8080/admin" 
                 style="background: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                🔗 Access Admin Panel
              </a>
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: adminEmail,
        subject: `🚨 ${urgencyBadge} Alert - Whistle Security`,
        html: htmlContent,
        priority: (alert.alertType === 'emergency' ? 'high' : 'normal') as 'high' | 'normal' | 'low'
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✉️ Alert email sent: ${alert.alertType} to ${adminEmail}`);
      return true;
    } catch (error) {
      console.error('Failed to send alert email:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter?.verify();
      console.log('✅ Email service connection test passed');
      return true;
    } catch (error) {
      console.log('❌ Email service connection test failed');
      return false;
    }
  }
}

export const emailService = new EmailService();