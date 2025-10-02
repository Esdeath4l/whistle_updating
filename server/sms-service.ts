import twilio from 'twilio';
import { IAlert } from '../shared/models/Alert';
import { IReport } from '../shared/models/report';

/**
 * SMS Service for Whistle App - Twilio Integration
 * Sends SMS notifications for urgent/emergency reports using Twilio's official SDK
 * 
 * Environment Variables Required:
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Your Twilio Auth Token  
 * - TWILIO_FROM_NUMBER: Your Twilio phone number
 * - ADMIN_PHONE_NUMBER: Admin phone number to receive alerts
 */

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  adminPhoneNumber: string;
}

class SMSService {
  private client: twilio.Twilio | null = null;
  private isConfigured: boolean = false;
  private config: TwilioConfig | null = null;

  constructor() {
    this.initializeTwilioService();
  }

  /**
   * Initialize Twilio SMS service with required environment variables
   * Sets up Twilio client and validates configuration
   */
  private initializeTwilioService() {
    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER,
      ADMIN_PHONE_NUMBER
    } = process.env;

    // Validate required Twilio environment variables
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !ADMIN_PHONE_NUMBER) {
      console.warn('📱 Twilio SMS service not configured. Missing required environment variables.');
      console.warn('Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, ADMIN_PHONE_NUMBER');
      return;
    }

    try {
      // Initialize Twilio client
      this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      
      this.config = {
        accountSid: TWILIO_ACCOUNT_SID,
        authToken: TWILIO_AUTH_TOKEN,
        fromNumber: TWILIO_FROM_NUMBER,
        adminPhoneNumber: ADMIN_PHONE_NUMBER
      };

      this.isConfigured = true;
      console.log('📱 Twilio SMS service initialized successfully');
      console.log(`📞 Admin phone number: ${ADMIN_PHONE_NUMBER}`);
      console.log(`📱 From number: ${TWILIO_FROM_NUMBER}`);
    } catch (error) {
      console.error('❌ Failed to initialize Twilio SMS service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send SMS notification for urgent/emergency reports using Twilio
   * 
   * @param alert - Alert information containing details about the incident
   * @param report - Report data with priority, category, and location info
   * @returns Promise<boolean> - True if SMS sent successfully, false otherwise
   */
  async sendAlertNotification(alert: IAlert, report: IReport): Promise<boolean> {
    if (!this.isConfigured || !this.config || !this.client) {
      console.warn('📱 Twilio SMS service not configured, skipping SMS notification');
      return false;
    }

    try {
      const reportType = report.type || report.category || 'Unknown';
      const priority = report.priority || report.severity || 'Medium';
      const shortId = report.shortId;
      
      // Create formatted SMS message for the alert
      const message = this.formatAlertMessage(alert, report);
      
      console.log(`📱 Sending Twilio SMS alert for ${priority} ${reportType} report (${shortId})`);
      
      // Send SMS to admin phone using Twilio SDK
      const result = await this.sendTwilioSMS(this.config.adminPhoneNumber, message);

      if (result) {
        console.log(`✅ Twilio SMS sent successfully to ${this.config.adminPhoneNumber}`);
        return true;
      } else {
        console.error('❌ Failed to send Twilio SMS notification');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send Twilio SMS notification:', error);
      return false;
    }
  }

  /**
   * Send SMS to specific phone number using Twilio
   * 
   * @param phoneNumber - Target phone number (should include country code, e.g., +1234567890)
   * @param message - SMS message content to send
   * @returns Promise<boolean> - True if SMS sent successfully, false otherwise
   */
  async sendSMSToNumber(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isConfigured || !this.config || !this.client) {
      console.warn('📱 Twilio SMS service not configured');
      return false;
    }

    try {
      console.log(`📱 Sending Twilio SMS to ${phoneNumber}`);
      
      const result = await this.sendTwilioSMS(phoneNumber, message);

      if (result) {
        console.log(`✅ Twilio SMS sent successfully to ${phoneNumber}`);
        return true;
      } else {
        console.error(`❌ Failed to send Twilio SMS to ${phoneNumber}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to send Twilio SMS to ${phoneNumber}:`, error);
      return false;
    }
  }

  /**
   * Send SMS using Twilio SDK
   * 
   * @param phoneNumber - Target phone number with country code
   * @param message - SMS message content
   * @returns Promise<boolean> - True if sent successfully, false otherwise
   */
  private async sendTwilioSMS(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.client || !this.config) {
      console.error('❌ Twilio client not initialized');
      return false;
    }

    try {
      console.log('📱 === SENDING TWILIO SMS ===');
      console.log(`📞 To: ${phoneNumber}`);
      console.log(`📱 From: ${this.config.fromNumber}`);
      console.log(`📝 Message Length: ${message.length} characters`);
      console.log('============================');

      // Send SMS using Twilio's official SDK
      const messageResponse = await this.client.messages.create({
        body: message,
        from: this.config.fromNumber,
        to: phoneNumber
      });

      // Check if message was successfully queued/sent
      if (messageResponse.sid) {
        console.log(`✅ Twilio SMS sent successfully. SID: ${messageResponse.sid}`);
        console.log(`📊 Status: ${messageResponse.status}`);
        return true;
      } else {
        console.error('❌ Twilio SMS failed: No SID returned');
        return false;
      }
    } catch (error: any) {
      console.error('❌ Twilio SMS Error:', {
        message: error.message,
        code: error.code,
        moreInfo: error.moreInfo,
        status: error.status
      });
      
      // Handle common Twilio errors gracefully
      if (error.code === 21211) {
        console.error('❌ Invalid phone number format. Ensure number includes country code (+1234567890)');
      } else if (error.code === 21408) {
        console.error('❌ Permission denied. Check if sender number is verified in Twilio');
      } else if (error.code === 20003) {
        console.error('❌ Authentication failed. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
      }
      
      return false;
    }
  }

  /**
   * Send notification about report status update via Twilio SMS
   * 
   * @param reportId - Unique identifier for the report
   * @param status - New status of the report (pending, in_progress, resolved, etc.)
   * @param phoneNumber - Target phone number to receive the update
   * @returns Promise<boolean> - True if SMS sent successfully, false otherwise
   */
  async sendStatusUpdate(reportId: string, status: string, phoneNumber: string): Promise<boolean> {
    if (!this.isConfigured || !this.config || !this.client) {
      console.warn('📱 Twilio SMS service not configured for status updates');
      return false;
    }

    try {
      const message = `🔔 Whistle Alert Update\n\nReport ID: ${reportId}\nStatus: ${status.toUpperCase()}\n\nYour report has been updated. Check the dashboard for more details.`;
      
      const result = await this.sendTwilioSMS(phoneNumber, message);

      if (result) {
        console.log(`✅ Status update Twilio SMS sent to ${phoneNumber}`);
        return true;
      } else {
        console.error(`❌ Failed to send status update Twilio SMS`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to send status update Twilio SMS:`, error);
      return false;
    }
  }

  /**
   * Format alert message for SMS
   */
  private formatAlertMessage(alert: IAlert, report: IReport): string {
    const reportType = (report.type || report.category || 'Unknown').toUpperCase();
    const priority = (report.priority || report.severity || 'medium').toUpperCase();
    const shortId = report.shortId;
    const timestamp = new Date().toLocaleString();

    let urgencyEmoji = '🚨';
    if (priority === 'URGENT' || reportType.includes('EMERGENCY')) {
      urgencyEmoji = '🚨🚨🚨';
    } else if (priority === 'HIGH') {
      urgencyEmoji = '⚠️';
    }

    const message = `${urgencyEmoji} WHISTLE ALERT ${urgencyEmoji}

🔥 ${priority} PRIORITY
📝 Type: ${reportType}
🆔 ID: ${shortId}
🕐 Time: ${timestamp}

${alert.message}

⚡ Immediate attention required
🔗 Check admin dashboard for details`;

    return message;
  }

  /**
   * Test Twilio SMS functionality by sending a test message to admin
   * 
   * @returns Promise<boolean> - True if test SMS sent successfully, false otherwise
   */
  async testSMS(): Promise<boolean> {
    if (!this.isConfigured || !this.config || !this.client) {
      console.log('📱 Twilio SMS service not configured for testing');
      return false;
    }

    const testMessage = `🧪 Whistle SMS Test\n\nThis is a test message from the Whistle alert system using Twilio.\n\nTime: ${new Date().toLocaleString()}\n\n✅ Twilio SMS service is working correctly!`;
    
    console.log('📱 Running Twilio SMS test...');
    return await this.sendSMSToNumber(this.config.adminPhoneNumber, testMessage);
  }

  /**
   * Send SMS to the specific number +91 9500068744 using Twilio
   * This is a convenience method for sending messages to a predetermined number
   * 
   * @param message - SMS message content to send
   * @returns Promise<boolean> - True if SMS sent successfully, false otherwise
   */
  async sendSMSToSpecificNumber(message: string): Promise<boolean> {
    const targetNumber = '+919500068744';
    console.log(`📱 Sending Twilio SMS to specific number: ${targetNumber}`);
    
    return await this.sendSMSToNumber(targetNumber, message);
  }

  /**
   * Get Twilio SMS service configuration status
   * 
   * @returns Object containing service status and configuration details
   */
  getStatus(): { 
    configured: boolean; 
    adminPhone?: string; 
    fromNumber?: string; 
    provider: string;
    clientStatus?: string;
  } {
    return {
      configured: this.isConfigured,
      adminPhone: this.config?.adminPhoneNumber,
      fromNumber: this.config?.fromNumber,
      provider: 'twilio',
      clientStatus: this.client ? 'initialized' : 'not_initialized'
    };
  }
}

export const smsService = new SMSService();
export default smsService;