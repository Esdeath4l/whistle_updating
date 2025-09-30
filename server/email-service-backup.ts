import nodemailer from "nodemailer";
import { Report } from "@shared/api";

// Email configuration - these should be environment variables in production
const EMAIL_CONFIG = {
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_APP_PASSWORD, // App-specific password required
  },
};

// Create transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

/**
 * Send actual email notification for urgent reports
 */
export async function sendEmailAlert(report: Report): Promise<boolean> {
  try {
    // Check if email is configured
    if (!EMAIL_CONFIG.auth.pass) {
      console.warn(
        "❌ Email service not configured - EMAIL_APP_PASSWORD missing",
      );
      console.log(
        "📧 Would send email for report:",
        report.id,
      );
      return false;
    }

    const emailOptions = {
      from: {
        name: "Whistle Security System",
        address: EMAIL_CONFIG.auth.user,
      },
      to: process.env.EMAIL_TO,
      subject: `🚨 URGENT: New ${report.category} Report - ${report.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Urgent Harassment Report</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .urgent { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚨 URGENT HARASSMENT REPORT</h1>
            <p>Immediate Administrative Action Required</p>
          </div>
          
          <div class="content">
            <div class="urgent">
              <strong>⚠️ This is an urgent report requiring immediate attention</strong>
            </div>
            
            <div class="details">
              <h3>Report Details</h3>
              <ul>
                <li><strong>Report ID:</strong> ${report.id}</li>
                <li><strong>Category:</strong> ${report.category}</li>
                <li><strong>Severity:</strong> ${report.severity?.toUpperCase()}</li>
                <li><strong>Submitted:</strong> ${new Date(report.created_at).toLocaleString()}</li>
                <li><strong>Status:</strong> ${report.status}</li>
                ${report.is_encrypted ? "<li><strong>Security:</strong> 🔒 End-to-End Encrypted</li>" : ""}
              </ul>
            </div>
            
            <div class="details">
              <h3>Required Actions</h3>
              <ol>
                <li>Log into the admin dashboard immediately</li>
                <li>Review the full report details</li>
                <li>Take appropriate administrative action</li>
                <li>Respond within your organization's SLA timeframe</li>
              </ol>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.ADMIN_DASHBOARD_URL }" class="button">
                🔐 Access Admin Dashboard
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated alert from the Whistle Harassment Reporting System</p>
            <p>For technical support, contact your system administrator</p>
            <p>Report ID: ${report.id} | Timestamp: ${new Date().toISOString()}</p>
          </div>
        </body>
        </html>
      `,
      text: `
��� URGENT HARASSMENT REPORT - IMMEDIATE ACTION REQUIRED

A new urgent harassment report has been submitted and requires immediate administrative review.

Report Details:
- Report ID: ${report.id}
- Category: ${report.category}
- Severity: ${report.severity?.toUpperCase()}
- Submitted: ${new Date(report.created_at).toLocaleString()}
- Status: ${report.status}
${report.is_encrypted ? "- Security: 🔒 End-to-End Encrypted" : ""}

Required Actions:
1. Log into the admin dashboard immediately
2. Review the full report details  
3. Take appropriate administrative action
4. Respond within your organization's SLA timeframe

Admin Dashboard: ${process.env.ADMIN_DASHBOARD_URL }

This is an automated alert from the Whistle Harassment Reporting System.
Report ID: ${report.id} | Timestamp: ${new Date().toISOString()}
      `,
    };

    // Send the email
    const info = await transporter.sendMail(emailOptions);

    console.log("✅ Email sent successfully:", info.messageId);
    console.log("📧 Email sent to:", emailOptions.to);
    console.log("📬 Preview URL:", nodemailer.getTestMessageUrl(info));

    return true;
  } catch (error) {
    console.error("❌ Failed to send email notification:", error);

    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      if (error.message.includes("Invalid login")) {
        console.error(
          "💡 Tip: Make sure to use an App Password for Gmail, not your regular password",
        );
        console.error(
          "💡 Generate one at: https://myaccount.google.com/apppasswords",
        );
      }
    }

    return false;
  }
}

/**
 * Test email configuration
 */
export async function testEmailService(): Promise<boolean> {
  try {
    if (!EMAIL_CONFIG.auth.pass) {
      console.log("❌ Email not configured - missing EMAIL_APP_PASSWORD");
      return false;
    }

    await transporter.verify();
    console.log("✅ Email service is ready");
    return true;
  } catch (error) {
    console.error("❌ Email service test failed:", error);
    return false;
  }
}

/**
 * Send test email to verify configuration
 */
export async function sendTestEmail(): Promise<boolean> {
  const testReport: Report = {
    id: "test_" + Date.now(),
    shortId: "TEST" + Math.random().toString(36).substr(2, 6).toUpperCase(),
    message: "This is a test email from the Whistle system",
    category: "feedback",
    severity: "urgent",
    created_at: new Date().toISOString(),
    status: "pending",
    is_encrypted: false,
  };

  return sendEmailAlert(testReport);
}
