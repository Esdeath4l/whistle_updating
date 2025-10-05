import { toast } from "@/components/ui/use-toast";

export interface NotificationConfig {
  title: string;
  description: string;
  type: "info" | "success" | "warning" | "error";
  duration?: number;
}

export class NotificationService {
  private static instance: NotificationService;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private onNewReportCallback: (() => void) | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  setOnNewReportCallback(callback: () => void) {
    this.onNewReportCallback = callback;
  }

  /**
   * Show in-app toast notification
   */
  showToast(config: NotificationConfig) {
    toast({
      title: config.title,
      description: config.description,
      duration: config.duration || 5000,
      variant: config.type === "error" ? "destructive" : "default",
    });
  }

  /**
   * Send browser push notification (requires permission)
   */
  async sendPushNotification(title: string, body: string, icon?: string) {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return;
    }

    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission === "granted") {
      new Notification(title, {
        body,
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: "whistle-notification",
        requireInteraction: true,
      });
    }
  }

  /**
   * Play notification sound - Enhanced with multiple sound options
   */
  playNotificationSound(type: 'default' | 'urgent' | 'success' = 'default') {
    try {
      // Create audio context for notification sound
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different sound profiles for different notification types
      switch (type) {
        case 'urgent':
          // Higher pitched, more attention-grabbing sound
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(
            600,
            audioContext.currentTime + 0.4,
          );
          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.4,
          );
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.4);
          break;
        
        case 'success':
          // Pleasant ascending tone
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.3,
          );
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
          break;

        default:
          // Standard notification sound
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(
            400,
            audioContext.currentTime + 0.3,
          );
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.3,
          );
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
      }

      console.log(`🔊 Playing ${type} notification sound`);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
      
      // Fallback: Try to play a simple beep using HTML5 Audio
      try {
        const beepData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGm+DyvmMZAjuR2e7QdyYELIXK8dpWQAsObNTps21KGAVRr+bwMBsGOYTQ8ddZSAsWdM3j2WlPEQpSru35rWMZBznN5vbIaiwOBbPz9sBVGRECYLru9rVUEA1aqefqvmQeAjGT6vKnZRkCL2nN7LFlHw9Bp+fqw2YdByI=';
        const audio = new Audio(beepData);
        audio.volume = 0.3;
        audio.play().catch(() => console.warn('Fallback beep also failed'));
      } catch (fallbackError) {
        console.warn('Fallback notification sound failed:', fallbackError);
      }
    }
  }

  /**
   * Setup real-time notifications via Socket.io (SSE removed for cleaner architecture)
   */
  setupRealtimeNotifications(adminToken: string) {
    console.log("✅ Real-time notifications using Socket.io are active");
    
    this.showToast({
      title: "🔔 Notifications Active",
      description: "Real-time alerts enabled for new reports via Socket.io",
      type: "success",
    });

    // Play confirmation sound
    this.playNotificationSound('success');
  }

  /**
   * Trigger a new report notification with sound
   */
  triggerNewReportNotification(reportData: {
    reportId: string;
    category: string;
    severity: string;
    priority?: string;
  }) {
    const isUrgent = reportData.severity === 'urgent' || 
                     reportData.priority === 'urgent' ||
                     reportData.category === 'medical' || 
                     reportData.category === 'emergency';

    const notificationData = {
      type: isUrgent ? 'urgent_report' : 'new_report',
      reportId: reportData.reportId,
      category: reportData.category,
      severity: reportData.severity,
      timestamp: new Date().toISOString(),
      message: isUrgent ? 'URGENT: Immediate attention required' : 'New report received'
    };

    if (isUrgent) {
      this.handleUrgentReportNotification(notificationData);
    } else {
      this.handleNewReportNotification(notificationData);
    }
  }

  /**
   * Handle notification events (now public for Socket.io integration)
   */
  handleNotificationEvent(data: any) {
    console.log("🔔 Handling Socket.io notification event:", data);

    switch (data.type) {
      case "new_report":
        this.handleNewReportNotification(data);
        break;
      case "urgent_report":
        this.handleUrgentReportNotification(data);
        break;
      case "report_updated":
        this.handleReportUpdateNotification(data);
        break;
      default:
        console.log("Unknown notification type:", data.type);
    }
  }

  private handleReportUpdateNotification(data: any) {
    const { reportId, status } = data;
    
    this.showToast({
      title: "📝 Report Updated",
      description: `Report ${reportId} status changed to ${status}`,
      type: "info",
      duration: 5000,
    });

    this.playNotificationSound('default');

    // Refresh report list if callback is set
    if (this.onNewReportCallback) {
      this.onNewReportCallback();
    }
  }

  private handleNewReportNotification(data: any) {
    const { reportId, category, severity } = data;

    console.log("🚨 New report notification:", {
      reportId,
      category,
      severity,
    });

    // Show toast notification
    this.showToast({
      title: "🚨 New Report Received",
      description: `${category} report (${severity} priority) - ID: ${reportId}`,
      type: "info",
      duration: 8000,
    });

    // Send browser notification
    this.sendPushNotification(
      "New Harassment Report",
      `A new ${category} report has been submitted with ${severity} priority.`,
    );

    // Play notification sound based on severity
    const soundType = severity === 'urgent' ? 'urgent' : 'default';
    this.playNotificationSound(soundType);

    // Update document title for attention
    this.updateDocumentTitle("🚨 New Report");

    // Refresh report list if callback is set
    if (this.onNewReportCallback) {
      console.log("🔄 Refreshing report list due to new report");
      this.onNewReportCallback();
    }
  }

  private handleUrgentReportNotification(data: any) {
    const { reportId, category } = data;

    console.log("🚨 URGENT report notification:", { reportId, category });

    // Show urgent toast notification
    this.showToast({
      title: "🚨 URGENT REPORT",
      description: `Emergency ${category} report requires immediate attention - ID: ${reportId}`,
      type: "error",
      duration: 15000,
    });

    // Send urgent browser notification
    this.sendPushNotification(
      "🚨 URGENT: Harassment Report",
      `An emergency ${category} report requires immediate attention.`,
    );

    // Play urgent notification sound (multiple beeps)
    this.playUrgentSound();

    // Flash document title
    this.flashDocumentTitle("🚨 URGENT REPORT");

    // Refresh report list if callback is set
    if (this.onNewReportCallback) {
      console.log("🔄 Refreshing report list due to urgent report");
      this.onNewReportCallback();
    }
  }

  private playUrgentSound() {
    // Play 3 urgent sounds with increasing intensity
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.playNotificationSound('urgent'), i * 500);
    }
  }

  private updateDocumentTitle(prefix: string) {
    const originalTitle = document.title;
    document.title = `${prefix} - ${originalTitle}`;

    setTimeout(() => {
      document.title = originalTitle;
    }, 10000);
  }

  private flashDocumentTitle(urgentText: string) {
    const originalTitle = document.title;
    let flashCount = 0;
    const maxFlashes = 10;

    const flashInterval = setInterval(() => {
      document.title = flashCount % 2 === 0 ? urgentText : originalTitle;
      flashCount++;

      if (flashCount >= maxFlashes) {
        clearInterval(flashInterval);
        document.title = originalTitle;
      }
    }, 1000);
  }

  /**
   * Disconnect real-time notifications (Socket.io handled automatically)
   */
  disconnect() {
    console.log("🔇 Notification service disconnected (Socket.io will handle cleanup)");
  }

  /**
   * Send email notification (server-side implementation)
   */
  async sendEmailNotification(reportData: any) {
    try {
      await fetch("/api/notifications/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });
    } catch (error) {
      console.error("Failed to send email notification:", error);
    }
  }

  /**
   * Send SMS notification (server-side implementation)
   */
  async sendSMSNotification(reportData: any) {
    try {
      await fetch("/api/notifications/sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });
    } catch (error) {
      console.error("Failed to send SMS notification:", error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
