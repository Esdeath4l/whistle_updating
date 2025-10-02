import { Router } from 'express';
import { smsService } from '../sms-service';
import { AuthRequest, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

/**
 * Test SMS functionality
 * POST /api/admin/sms/test
 */
router.post('/test', requireAdmin, async (req: AuthRequest, res) => {
  try {
    console.log('📱 Testing SMS service...');
    
    const result = await smsService.testSMS();
    
    if (result) {
      res.json({
        success: true,
        message: 'SMS test sent successfully',
        status: smsService.getStatus()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'SMS test failed',
        status: smsService.getStatus()
      });
    }
  } catch (error) {
    console.error('SMS test error:', error);
    res.status(500).json({
      success: false,
      message: 'SMS test failed with error',
      error: error.message
    });
  }
});

/**
 * Send SMS to specific number
 * POST /api/admin/sms/send
 */
router.post('/send', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }
    
    console.log(`📱 Admin sending SMS to ${phoneNumber}`);
    
    const result = await smsService.sendSMSToNumber(phoneNumber, message);
    
    if (result) {
      res.json({
        success: true,
        message: `SMS sent successfully to ${phoneNumber}`
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to send SMS to ${phoneNumber}`
      });
    }
  } catch (error) {
    console.error('Admin SMS send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error: error.message
    });
  }
});

/**
 * Send SMS to the specific number +91 9500068744
 * POST /api/admin/sms/send-to-specific
 */
router.post('/send-to-specific', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }
    
    console.log('📱 Admin sending SMS to specific number +91 9500068744');
    
    const result = await smsService.sendSMSToSpecificNumber(message);
    
    if (result) {
      res.json({
        success: true,
        message: 'SMS sent successfully to +91 9500068744',
        targetNumber: '+91 9500068744'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send SMS to +91 9500068744'
      });
    }
  } catch (error) {
    console.error('Specific SMS send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS to specific number',
      error: error.message
    });
  }
});

/**
 * Get SMS service status
 * GET /api/admin/sms/status
 */
router.get('/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = smsService.getStatus();
    
    res.json({
      success: true,
      smsService: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SMS status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SMS service status',
      error: error.message
    });
  }
});

export default router;