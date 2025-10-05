import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  ArrowLeft,
  Lock,
  Eye,
  AlertCircle,
  Clock,
  CheckCircle,
  Flag,
  Image as ImageIcon,
  Calendar,
  Filter,
  Heart,
  AlertTriangle,
  Shield,
  MessageCircle,
  Settings,
  Video,
  MapPin,
  Bell,
  Wifi,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Report,
  ReportStatus,
  GetReportsResponse,
  UpdateReportRequest,
} from "@shared/api";
import { decryptReportData } from "@/lib/encryption";
import { notificationService } from "@/lib/notifications";
import AdminReportsList from "@/components/AdminReportsList";
// Enhanced AdminReportsList component with comprehensive media display (no geographic map)
// import { formatLocation } from "@/lib/geolocation";

// Stub function for formatLocation
const formatLocation = (location: any) => location?.address || `${location?.latitude || 0}, ${location?.longitude || 0}`;

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const seenReportIdsRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [authToken, setAuthToken] = useState<string>(""); // Store JWT token dynamically
  
  // Real-time notification states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false); // Start as disconnected, will be set to true when connection is established
  const [connectionMethod, setConnectionMethod] = useState<'socket' | 'polling' | 'none'>('none');
  const [unreadCount, setUnreadCount] = useState(0);

  // Check for stored auth token on component mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem('adminToken');
    if (storedToken) {
      setAuthToken(storedToken);
      setIsAuthenticated(true);
    }
    // Load seen report ids from sessionStorage to persist notification dedupe
    try {
      const seen = sessionStorage.getItem('seenReportIds');
      if (seen) {
        const arr = JSON.parse(seen) as string[];
        seenReportIdsRef.current = new Set(arr);
      }
    } catch (err) {
      console.warn('Failed to load seenReportIds from sessionStorage', err);
    }
  }, []);

  // Test initial connection when authenticated
  useEffect(() => {
    if (isAuthenticated && authToken) {
      const testConnection = async () => {
        try {
          const response = await fetch('/api/admin/reports?limit=1', {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          if (response.ok) {
            console.log('✅ Initial API connection test successful');
            // Connection will be properly set by the notification system
          } else {
            console.log('⚠️ Initial API connection test failed');
            setIsConnected(false);
            setConnectionMethod('none');
          }
        } catch (error) {
          console.log('⚠️ Initial API connection error:', error);
          setIsConnected(false);
          setConnectionMethod('none');
        }
      };
      
      testConnection();
    }
  }, [isAuthenticated, authToken]);

  // =======================================
  // REAL-TIME NOTIFICATIONS (WITH FALLBACK)
  // =======================================
  
  /**
   * Initialize real-time notifications
   * Uses Socket.io if available, falls back to polling
   */
  useEffect(() => {
    if (isAuthenticated && authToken) {
      let pollInterval: NodeJS.Timeout;
      let socketInstance: any = null;
      
      const initializeRealTime = async () => {
        try {
          // Try to use Socket.io if available
          try {
            console.log('🔄 Attempting Socket.io connection...');
            console.log('🌐 Client origin:', window.location.origin);
            const socketModule = await import('socket.io-client');
            const { io } = socketModule;
            
            socketInstance = io(window.location.origin, {
              transports: ['websocket', 'polling'],
              autoConnect: true,
              timeout: 5000, // 5 second timeout
              forceNew: true // Force new connection
            });

            let connectionTimeout = setTimeout(() => {
              console.log('⚠️ Socket.io connection timeout, falling back to polling');
              socketInstance.disconnect();
              startPollingFallback();
            }, 10000); // 10 second timeout

            socketInstance.on('connect', () => {
              console.log('🔗 Connected to real-time notifications via Socket.io');
              clearTimeout(connectionTimeout);
              setIsConnected(true);
              setConnectionMethod('socket');
              socketInstance.emit('authenticate', authToken);
            });

            socketInstance.on('disconnect', (reason) => {
              console.log('🔌 Disconnected from real-time notifications:', reason);
              setIsConnected(false);
              setConnectionMethod('none');
              
              // Auto-reconnect after 5 seconds if not intentional
              if (reason !== 'io client disconnect') {
                setTimeout(() => {
                  console.log('🔄 Attempting reconnection...');
                  startPollingFallback();
                }, 5000);
              }
            });

            socketInstance.on('authenticated', (data) => {
              console.log('✅ Socket.io authentication successful:', data);
              try {
                // Instruct server to add this socket to the admin room explicitly
                socketInstance.emit('join_admin_room', { requestedAt: new Date().toISOString() });
                console.log('🔁 Requested join to admin room');
              } catch (err) {
                console.warn('⚠️ Failed to request admin room join:', err);
              }
            });

            socketInstance.on('connect_error', (error) => {
              console.log('⚠️ Socket.io connection error:', error);
              clearTimeout(connectionTimeout);
              setIsConnected(false);
              setConnectionMethod('none');
              startPollingFallback();
            });

            // Enhanced notification handlers for our new structure
            socketInstance.on('new_report_notification', (notification) => {
              try {
                const id = notification?.data?.shortId || notification?.shortId;
                if (id && seenReportIdsRef.current.has(id)) {
                  console.log('📨 Duplicate notification ignored for', id);
                  return;
                }

                console.log('📨 NEW REPORT - INSTANT notification received:', notification);

                // Mark as seen locally to prevent duplicates
                if (id) {
                  seenReportIdsRef.current.add(id);
                  try { sessionStorage.setItem('seenReportIds', JSON.stringify(Array.from(seenReportIdsRef.current))); } catch (err) { /* ignore */ }
                }

                // IMMEDIATE UI update
                setNotifications(prev => [notification, ...prev.slice(0, 9)]);
                setUnreadCount(prev => prev + 1);

                // IMMEDIATE sound notification - NO await
                notificationService.triggerNewReportNotification({
                  reportId: notification.data.shortId,
                  category: notification.data.reportType,
                  severity: notification.data.priority,
                  priority: notification.data.priority
                });

                // IMMEDIATE browser notification
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`🆕 New Report: ${notification.data.shortId}`, {
                    body: `${notification.data.priority.toUpperCase()} priority ${notification.data.reportType} report\n${notification.data.location}`,
                    icon: '/favicon.ico',
                    tag: notification.data.shortId,
                    requireInteraction: notification.data.priority === 'urgent' || notification.data.priority === 'high'
                  });
                }

                // IMMEDIATE fetch of new reports - fire and forget
                fetchReports().catch(err => console.error('Failed to refresh reports:', err));
              } catch (err) {
                console.error('Error handling new_report_notification:', err);
              }
            });

            // Fallback listener in case server emitted a global notification when admin room was empty
            socketInstance.on('new_report_notification_fallback', (notification) => {
              try {
                const id = notification?.data?.shortId || notification?.shortId;
                if (id && seenReportIdsRef.current.has(id)) {
                  console.log('📨 Duplicate fallback notification ignored for', id);
                  return;
                }

                console.log('📨 NEW REPORT - FALLBACK notification received:', notification);

                if (id) {
                  seenReportIdsRef.current.add(id);
                  try { sessionStorage.setItem('seenReportIds', JSON.stringify(Array.from(seenReportIdsRef.current))); } catch (err) { /* ignore */ }
                }

                // Keep behavior same as primary handler
                setNotifications(prev => [notification, ...prev.slice(0, 9)]);
                setUnreadCount(prev => prev + 1);

                notificationService.triggerNewReportNotification({
                  reportId: notification.data?.shortId || notification.shortId,
                  category: notification.data?.reportType || notification.category,
                  severity: notification.data?.priority || notification.severity,
                  priority: notification.data?.priority || notification.severity
                });

                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`🆕 New Report (fallback): ${notification.data?.shortId || notification.shortId}`, {
                    body: `${(notification.data?.priority || notification.severity || '').toUpperCase()} priority ${(notification.data?.reportType || notification.category || '')} report\n${notification.data?.location || notification.location || ''}`,
                    icon: '/favicon.ico',
                    tag: notification.data?.shortId || notification.shortId
                  });
                }

                fetchReports().catch(err => console.error('Failed to refresh reports (fallback):', err));
              } catch (err) {
                console.error('Error handling fallback notification:', err);
              }
            });

            socketInstance.on('report_update_notification', (notification) => {
              console.log('🔄 Report update notification:', notification);
              
              setNotifications(prev => [notification, ...prev.slice(0, 9)]);
              setUnreadCount(prev => prev + 1);
              fetchReports();
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`📝 Report Updated: ${notification.data.shortId}`, {
                  body: notification.data.message,
                  icon: '/favicon.ico',
                  tag: `update_${notification.data.shortId}`
                });
              }
            });

            socketInstance.on('priority_escalation_notification', (notification) => {
              console.log('� Priority escalation notification:', notification);
              
              setNotifications(prev => [notification, ...prev.slice(0, 9)]);
              setUnreadCount(prev => prev + 1);
              fetchReports();
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`🚨 URGENT: ${notification.data.shortId}`, {
                  body: notification.data.message,
                  icon: '/favicon.ico',
                  tag: `escalation_${notification.data.shortId}`,
                  requireInteraction: true // Keep notification until user clicks
                });
              }
            });

            socketInstance.on('connection_status_update', (statusUpdate) => {
              console.log('📡 Connection status update:', statusUpdate);
              setIsConnected(statusUpdate.data.isOnline);
            });

            socketInstance.on('admin_notification', (notification) => {
              console.log('📢 Admin notification:', notification);
              
              setNotifications(prev => [notification, ...prev.slice(0, 9)]);
              setUnreadCount(prev => prev + 1);
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`📢 Admin Alert`, {
                  body: notification.data.message,
                  icon: '/favicon.ico',
                  tag: `admin_${notification.id}`
                });
              }
            });

            // Send heartbeat every 30 seconds to maintain connection
            const heartbeat = setInterval(() => {
              if (socketInstance.connected) {
                socketInstance.emit('ping');
              }
            }, 30000);

            return () => {
              clearTimeout(connectionTimeout);
              clearInterval(heartbeat);
              if (socketInstance) {
                socketInstance.disconnect();
              }
            };
            
          } catch (socketError) {
            console.log('⚠️ Socket.io not available, using polling fallback');
            startPollingFallback();
          }
          
        } catch (error) {
          console.log('⚠️ Real-time notifications unavailable:', error);
          startPollingFallback();
        }
      };

      // Polling fallback function
      const startPollingFallback = () => {
        console.log('🔄 Starting polling fallback...');
        setConnectionMethod('polling');
        setIsConnected(true); // Indicate we have some form of real-time updates
        
        pollInterval = setInterval(async () => {
          try {
            const response = await fetch('/api/admin/reports?limit=1', {
              headers: { Authorization: `Bearer ${authToken}` }
            });
            
            if (response.ok) {
              const data = await response.json();
              const latestReport = data.reports?.[0];
              
              if (latestReport && reports.length > 0) {
                const isNewReport = !reports.find(r => r.id === latestReport.id);
                if (isNewReport) {
                  setNotifications(prev => [{
                    type: 'NEW_REPORT',
                    data: {
                      shortId: latestReport.shortId,
                      priority: latestReport.severity || 'medium',
                      message: `New ${latestReport.severity} priority report received: ${latestReport.shortId}`
                    },
                    timestamp: new Date().toISOString()
                  }, ...prev.slice(0, 9)]);
                  
                  setUnreadCount(prev => prev + 1);
                  fetchReports();
                }
              }
            } else {
              // If API is failing, mark as disconnected
              setIsConnected(false);
              setConnectionMethod('none');
            }
          } catch (error) {
            console.error('Polling error:', error);
            setIsConnected(false);
            setConnectionMethod('none');
          }
        }, 30000); // Poll every 30 seconds
      };
      
      initializeRealTime();
      
      return () => {
        if (pollInterval) clearInterval(pollInterval);
        if (socketInstance) socketInstance.disconnect();
      };
    }
  }, [isAuthenticated, authToken]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchReports = useCallback(async () => {
    if (!authToken) {
      console.log("⚠️ No auth token available for fetching reports");
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      console.log("📊 Fetching admin reports...");
      // Use the admin-specific endpoint for better data retrieval
      const response = await fetch(`/api/admin/reports?${params}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        const data: GetReportsResponse = await response.json();
        setReports(data.reports);
        try {
          // Update seen IDs to avoid duplicate notifications for already loaded reports
          const ids = new Set<string>(data.reports.map(r => r.shortId || r.id));
          // Merge into existing seen set
          ids.forEach(id => seenReportIdsRef.current.add(id));
          console.log('🔁 Updated seenReportIds with fetched reports', ids.size);
        } catch (e) {
          console.warn('⚠️ Failed to update seenReportIds:', e);
        }
        console.log(`✅ Fetched ${data.reports.length} reports for admin dashboard`);
      } else if (response.status === 401) {
        console.log("❌ Authentication failed, logging out");
        setIsAuthenticated(false);
        setAuthToken("");
        sessionStorage.removeItem('adminToken');
      } else {
        console.error("❌ Failed to fetch reports:", response.status);
      }
    } catch (error) {
      console.error("❌ Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  }, [authToken, statusFilter]);

  // Fetch reports when auth token changes
  useEffect(() => {
    if (authToken && isAuthenticated) {
      fetchReports();
    }
  }, [authToken, isAuthenticated, fetchReports]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthToken("");
    setReports([]);
    sessionStorage.removeItem('adminToken');
    console.log("👋 Admin logged out");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      console.log("🔐 Attempting admin login...");
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Network error" }));
        setLoginError(
          errorData.error || "Login failed. Please check your credentials.",
        );
        return;
      }

      const data = await response.json();
      console.log("📊 Login response:", data);

      if (data.success && data.data?.accessToken) {
        const token = data.data.accessToken;
        setAuthToken(token);
        setIsAuthenticated(true);
        
        // Store token in sessionStorage for persistence
        sessionStorage.setItem('adminToken', token);
        console.log("✅ Admin authenticated successfully");
        
        fetchReports();

        // Setup real-time notifications with error handling
        try {
          notificationService.setupRealtimeNotifications(token);

          // Request notification permission
          if (
            "Notification" in window &&
            Notification.permission === "default"
          ) {
            await Notification.requestPermission();
          }
        } catch (notificationError) {
          console.warn("Failed to setup notifications:", notificationError);
          // Don't block login if notifications fail
        }
      } else {
        setLoginError(data.error || "Invalid username or password");
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("Login failed. Please try again.");
    }
  };

  const updateReportStatus = async (
    reportId: string,
    status: ReportStatus,
    response?: string,
  ) => {
    try {
      const updateData: UpdateReportRequest = { status };
      if (response) {
        updateData.admin_response = response; // Use admin_response as defined in the interface
      }
      // Prefer public PATCH endpoint by shortId (keeps route simple for clients)
      // If selectedReport has a shortId use it; otherwise fallback to admin endpoint
      const shortId = selectedReport?.shortId || undefined;
      let res: Response;

      if (shortId) {
        res = await fetch(`/api/reports/${shortId}/status`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ status })
        });
      } else {
        // Fall back to admin update when we only have internal id
        res = await fetch(`/api/admin/reports/${reportId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(updateData),
        });
      }

      if (res.ok) {
        const result = await res.json();
        console.log('✅ Report status updated:', result);

        // Optimistically update UI: update reports list and selectedReport
        setReports(prev => prev.map(r => r.shortId === (result.data?.shortId || selectedReport?.shortId) ? { ...r, status: result.data?.status || status } : r));
        if (selectedReport) setSelectedReport(prev => prev ? { ...prev, status } : prev);

        // Keep server-side sync as well
        fetchReports();
        setAdminResponse('');
        // persist seen ids to sessionStorage
        try {
          sessionStorage.setItem('seenReportIds', JSON.stringify(Array.from(seenReportIdsRef.current)));
        } catch (err) {
          console.warn('Failed to persist seenReportIds', err);
        }
      } else {
        console.error('Failed to update report:', res.status);
      }
    } catch (error) {
      console.error("Error updating report:", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchReports();
    }
  }, [statusFilter, isAuthenticated]);

  const getCategoryBadge = (category: string) => {
    const categoryConfig = {
      harassment: {
        variant: "destructive" as const,
        icon: Flag,
        text: "Harassment",
      },
      medical: { variant: "default" as const, icon: Heart, text: "Medical" },
      emergency: {
        variant: "destructive" as const,
        icon: AlertTriangle,
        text: "Emergency",
      },
      safety: { variant: "secondary" as const, icon: Shield, text: "Safety" },
      feedback: {
        variant: "outline" as const,
        icon: MessageCircle,
        text: "Feedback",
      },
    };

    const config =
      categoryConfig[category as keyof typeof categoryConfig] ||
      categoryConfig.feedback;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="text-xs">
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  const getStatusBadge = (status: ReportStatus) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, icon: Clock, text: "Pending" },
      reviewed: {
        variant: "default" as const,
        icon: CheckCircle,
        text: "Reviewed",
      },
      flagged: { variant: "destructive" as const, icon: Flag, text: "Flagged" },
      resolved: {
        variant: "outline" as const,
        icon: CheckCircle,
        text: "Resolved",
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      low: { color: "text-muted-foreground", bg: "bg-muted" },
      medium: { color: "text-yellow-700", bg: "bg-yellow-100" },
      high: { color: "text-orange-700", bg: "bg-orange-100" },
      urgent: { color: "text-red-700", bg: "bg-red-100" },
    };

    const config =
      severityConfig[severity as keyof typeof severityConfig] ||
      severityConfig.medium;

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color} ${config.bg}`}
      >
        {severity?.toUpperCase() || "MEDIUM"}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDecryptedReport = (report: Report) => {
    if (report.is_encrypted && report.encrypted_data) {
      try {
        return decryptReportData(report.encrypted_data);
      } catch (error) {
        console.error("Failed to decrypt report:", error);
        return {
          message: "[DECRYPTION ERROR]",
          category: "encrypted",
          video_metadata: undefined,
        };
      }
    }
    return {
      message: report.message,
      category: report.category,
      video_metadata: report.video_metadata,
    };
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl whistle-gradient flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Whistle</h1>
                <p className="text-xs text-muted-foreground">Admin Dashboard</p>
              </div>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </header>

        {/* Login Form */}
        <div className="py-20 px-4">
          <div className="container mx-auto max-w-md">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <CardTitle>
                  <p>Admin Access</p>
                </CardTitle>
                <CardDescription>
                  Enter your admin credentials to access the harassment
                  reporting dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter admin username"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter admin password"
                      required
                    />
                  </div>

                  {loginError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full">
                    Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl whistle-gradient flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Whistle</h1>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {/* Real-time Notification Panel */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setUnreadCount(0)}
                className="relative"
              >
                <Bell className="w-4 h-4 mr-2" />
                Notifications
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
              
              {/* Real-time Status Indicator */}
              <div className="flex items-center gap-1 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected 
                    ? connectionMethod === 'socket' 
                      ? 'bg-green-500' 
                      : 'bg-yellow-500'
                    : 'bg-red-400'
                }`} />
                <span className="text-xs text-muted-foreground">
                  {isConnected 
                    ? connectionMethod === 'socket' 
                      ? 'Live (Real-time)' 
                      : connectionMethod === 'polling'
                        ? 'Live (Polling)'
                        : 'Connected'
                    : 'Offline'
                  }
                </span>
              </div>
            </div>
            
            <Link to="/admin/settings">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAuthenticated(false);
                handleLogout();
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Stats and Filters */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Reports Dashboard
              </h2>
              <p className="text-muted-foreground">
                {reports.length} total reports
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as ReportStatus | "all")
                }
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={async () => {
                  await fetchReports();
                  try {
                    // After fetching, identify any reports not previously seen and replay local notifications
                    const newlyFetched = reports.filter(r => !seenReportIdsRef.current.has(r.shortId || r.id));
                    if (newlyFetched.length > 0) {
                      console.log('🔁 Replaying unseen notifications for fetched reports:', newlyFetched.map(r => r.shortId || r.id));
                      for (const r of newlyFetched) {
                        const nid = r.shortId || r.id;
                        seenReportIdsRef.current.add(nid);
                        const notification = {
                          type: 'NEW_REPORT',
                          data: {
                            shortId: r.shortId || r.id,
                            priority: r.severity || r.priority || 'medium',
                            message: `New ${r.severity || r.priority} priority report received: ${r.shortId || r.id}`
                          },
                          timestamp: new Date().toISOString()
                        };
                        setNotifications(prev => [notification, ...prev.slice(0,9)]);
                        setUnreadCount(prev => prev + 1);
                        notificationService.triggerNewReportNotification({
                          reportId: r.shortId || r.id,
                          category: r.category || 'report',
                          severity: r.severity || r.priority || 'medium',
                          priority: r.severity || r.priority || 'medium'
                        });
                      }
                    }
                  } catch (err) {
                    console.error('Error replaying unseen notifications after refresh:', err);
                  }
                }}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>

              <Button
                onClick={async () => {
                  // Test urgent notification
                  const urgentReport = {
                    message:
                      "URGENT TEST: Immediate threat in building - security needed now!",
                    category: "emergency",
                    severity: "urgent",
                    location: {
                      latitude: 37.7749,
                      longitude: -122.4194,
                      accuracy: 2, // Very precise GPS for emergency (2m)
                      timestamp: Date.now(),
                      address: "Emergency Test Location, San Francisco, CA",
                    },
                    share_location: true,
                  };

                  try {
                    const response = await fetch("/api/reports", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(urgentReport),
                    });

                    if (response.ok) {
                      alert(
                        "🚨 Urgent test report created! You should receive notifications.",
                      );
                      fetchReports();
                    } else {
                      alert("Failed to create urgent test report");
                    }
                  } catch (error) {
                    alert("Error creating urgent test report: " + error);
                  }
                }}
                variant="destructive"
                size="sm"
              >
                🚨 Test Urgent Alert
              </Button>

              <Button
                onClick={async () => {
                  // Add demo data for testing
                  const demoReports = [
                    {
                      message:
                        "Someone was using offensive language and making threats in the office",
                      category: "harassment",
                      severity: "high",
                      location: {
                        latitude: 37.7749,
                        longitude: -122.4194,
                        accuracy: 5, // High accuracy GPS (5m)
                        timestamp: Date.now(),
                        address: "123 Market Street, San Francisco, CA",
                      },
                      share_location: true,
                    },
                    {
                      message: "Emergency medical situation in building lobby",
                      category: "medical",
                      severity: "urgent",
                      location: {
                        latitude: 37.7849,
                        longitude: -122.4094,
                        accuracy: 3, // Very high accuracy GPS (3m)
                        timestamp: Date.now(),
                        address: "456 Mission Street, San Francisco, CA",
                      },
                      share_location: true,
                    },
                    {
                      message:
                        "Great feedback about the new lunch menu options",
                      category: "feedback",
                      severity: "low",
                      location: {
                        latitude: 37.7649,
                        longitude: -122.4294,
                        accuracy: 8, // Good accuracy GPS (8m)
                        timestamp: Date.now(),
                        address: "789 Howard Street, San Francisco, CA",
                      },
                      share_location: true,
                    },
                  ];

                  for (const report of demoReports) {
                    await fetch("/api/reports", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(report),
                    });
                  }

                  fetchReports();
                }}
                variant="secondary"
                size="sm"
              >
                Add Demo Data
              </Button>
            </div>
          </div>

          {/* Reports Dashboard */}
          <div className="w-full">
            {/* Reports List */}
              {/* Reports List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
                <p className="text-muted-foreground">
                  {statusFilter === "all"
                    ? "No reports have been submitted yet."
                    : `No ${statusFilter} reports found.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {formatDate(report.created_at)}
                        </div>
                        {getCategoryBadge(
                          report.is_encrypted
                            ? getDecryptedReport(report).category
                            : report.category,
                        )}
                        {getSeverityBadge(report.severity)}
                        {report.is_encrypted ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 border-green-300"
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            E2E Encrypted
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-300"
                          >
                            <Lock className="w-3 h-3 mr-1 opacity-50" />
                            Plain Text
                          </Badge>
                        )}
                        {/* Enhanced media file indicators - supports multiple formats */}
                        {((report.imageFileIds && report.imageFileIds.length > 0) || 
                          (report.photo_file_id) || 
                          (report.files?.photo) || 
                          (report.photo_url)) && (
                          <Badge variant="outline">
                            <ImageIcon className="w-3 h-3 mr-1" />
                            Photo
                          </Badge>
                        )}
                        {((report.videoFileIds && report.videoFileIds.length > 0) || 
                          (report.video_file_id) || 
                          (report.files?.video) || 
                          (report.video_url)) && (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-300"
                          >
                            <Video className="w-3 h-3 mr-1" />
                            Video
                          </Badge>
                        )}
                        {report.moderation?.isFlagged && (
                          <Badge
                            variant="secondary"
                            className="bg-yellow-100 text-yellow-800 border-yellow-300"
                          >
                            ⚠️ AI Flagged
                          </Badge>
                        )}
                        {report.location && (
                          <Badge variant="outline">
                            <MapPin className="w-3 h-3 mr-1" />
                            Location
                          </Badge>
                        )}
                        {report.is_offline_sync && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 border-blue-300"
                          >
                            📱 Offline Sync
                          </Badge>
                        )}
                      </div>
                      {getStatusBadge(report.status)}
                    </div>

                    <p className="text-foreground mb-4 line-clamp-3">
                      {report.is_encrypted ? (
                        <span className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-primary" />
                          {getDecryptedReport(report).message}
                        </span>
                      ) : (
                        report.message
                      )}
                    </p>

                    <div className="flex items-center justify-between">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {report.id}
                      </code>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              console.log("🔍 Opening report modal for:", report.shortId);
                              console.log("📊 Report media data:", {
                                photo_file_id: report.photo_file_id,
                                video_file_id: report.video_file_id,
                                imageFileIds: report.imageFileIds,
                                videoFileIds: report.videoFileIds,
                                files: report.files,
                                photo_url: report.photo_url,
                                video_url: report.video_url
                              });
                              setSelectedReport(report);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Report Details</DialogTitle>
                            <DialogDescription>
                              Report ID: {selectedReport?.id}
                            </DialogDescription>
                          </DialogHeader>

                          {selectedReport && (
                            <div className="space-y-6 overflow-y-auto pr-2 flex-1">
                              <div>
                                <Label className="text-sm font-medium">
                                  Status
                                </Label>
                                <div className="mt-1">
                                  {getStatusBadge(selectedReport.status)}
                                </div>
                                {/* AI classification summary */}
                                {((selectedReport as any).ai_classification || (selectedReport as any).moderation) && (
                                  <div className="mt-2 text-sm text-gray-600">
                                    {((selectedReport as any).ai_classification?.primaryLabel || (selectedReport as any).moderation?.primaryLabel) && (
                                      <span className="inline-block mr-2 px-2 py-0.5 rounded bg-gray-100">AI: {((selectedReport as any).ai_classification?.primaryLabel || (selectedReport as any).moderation?.primaryLabel)}</span>
                                    )}
                                    {typeof (selectedReport as any).ai_classification?.confidence === 'number' && (
                                      <span className="text-xs text-gray-500">Confidence: {Math.round((selectedReport as any).ai_classification.confidence * 100)}%</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div>
                                <Label className="text-sm font-medium">
                                  Submitted
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {formatDate(selectedReport.created_at)}
                                </p>
                              </div>

                              <div>
                                <Label className="text-sm font-medium">
                                  Message
                                  {selectedReport.is_encrypted && (
                                    <Badge variant="outline" className="ml-2">
                                      <Lock className="w-3 h-3 mr-1" />
                                      Encrypted
                                    </Badge>
                                  )}
                                </Label>
                                <div className="mt-2 p-4 bg-muted rounded-lg">
                                  <p className="whitespace-pre-wrap">
                                    {selectedReport.is_encrypted
                                      ? getDecryptedReport(selectedReport)
                                          .message
                                      : selectedReport.message}
                                  </p>
                                </div>
                              </div>

                              {/* Enhanced Photo Evidence Display - supports multiple formats */}
                              {((selectedReport.imageFileIds && selectedReport.imageFileIds.length > 0) || 
                                selectedReport.photo_file_id || 
                                selectedReport.files?.photo || 
                                selectedReport.photo_url) && (
                                <div>
                                  <Label className="text-sm font-medium">
                                    Photo Evidence
                                    {selectedReport.is_encrypted && (
                                      <Badge variant="outline" className="ml-2">
                                        <Lock className="w-3 h-3 mr-1" />
                                        Encrypted
                                      </Badge>
                                    )}
                                  </Label>
                                  <div className="mt-2 space-y-2">
                                    {/* Handle GridFS imageFileIds array */}
                                    {selectedReport.imageFileIds && selectedReport.imageFileIds.map((fileId, index) => (
                                      <div key={fileId} className="border rounded-lg p-2">
                                        <img
                                          src={`/api/files/images/${fileId}`}
                                          alt={`Report evidence ${index + 1}`}
                                          className="max-w-full h-auto rounded-lg border mb-2"
                                          style={{ maxHeight: "400px" }}
                                          onLoad={() => {
                                            console.log(`✅ Image ${index + 1} loaded successfully from GridFS`);
                                          }}
                                          onError={(e) => {
                                            console.error("❌ Failed to load photo from GridFS:", fileId);
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = "none";
                                            
                                            // Add error placeholder with retry option
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = "p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 text-center";
                                            errorDiv.innerHTML = `
                                              <p>❌ Failed to load image ${index + 1}</p>
                                              <p class="text-sm">GridFS File ID: ${fileId}</p>
                                              <button onclick="this.parentElement.nextElementSibling.style.display='block'; this.parentElement.style.display='none'" class="mt-2 px-2 py-1 bg-red-100 border border-red-300 rounded text-xs hover:bg-red-200">
                                                🔄 Retry
                                              </button>
                                            `;
                                            target.parentNode?.insertBefore(errorDiv, target);
                                          }}
                                        />
                                        <p className="text-xs text-muted-foreground">Image {index + 1} - ID: {fileId}</p>
                                      </div>
                                    ))}
                                    
                                    {/* Handle single photo_file_id */}
                                    {selectedReport.photo_file_id && !selectedReport.imageFileIds && (
                                      <div className="border rounded-lg p-2">
                                        <img
                                          src={`/api/files/${selectedReport.photo_file_id}`}
                                          alt="Report photo evidence"
                                          className="max-w-full h-auto rounded-lg border mb-2"
                                          style={{ maxHeight: "400px" }}
                                          onLoad={() => {
                                            console.log(`✅ Photo loaded successfully from GridFS: ${selectedReport.photo_file_id}`);
                                          }}
                                          onError={(e) => {
                                            console.error("❌ Failed to load photo from GridFS:", selectedReport.photo_file_id);
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = "none";
                                            
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = "p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 text-center";
                                            errorDiv.innerHTML = `
                                              <p>❌ Failed to load photo</p>
                                              <p class="text-sm">File ID: ${selectedReport.photo_file_id}</p>
                                              <p class="text-xs">Check server logs or try refreshing</p>
                                            `;
                                            target.parentNode?.insertBefore(errorDiv, target);
                                          }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                          Photo - ID: {selectedReport.photo_file_id}
                                          {selectedReport.files?.photo && (
                                            <span> • {selectedReport.files.photo.filename} ({(selectedReport.files.photo.size / 1024).toFixed(1)} KB)</span>
                                          )}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Handle legacy photo_url */}
                                    {selectedReport.photo_url && !selectedReport.photo_file_id && !selectedReport.imageFileIds && (
                                      <div className="border rounded-lg p-2">
                                        <img
                                          src={selectedReport.photo_url}
                                          alt="Report photo evidence"
                                          className="max-w-full h-auto rounded-lg border mb-2"
                                          style={{ maxHeight: "400px" }}
                                          onLoad={() => console.log("✅ Legacy photo loaded successfully")}
                                          onError={() => console.error("❌ Failed to load legacy photo")}
                                        />
                                        <p className="text-xs text-muted-foreground">Legacy Photo URL</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Enhanced Video Evidence Display - supports multiple formats */}
                              {((selectedReport.videoFileIds && selectedReport.videoFileIds.length > 0) || 
                                selectedReport.video_file_id || 
                                selectedReport.files?.video || 
                                selectedReport.video_url) && (
                                <div>
                                  <Label className="text-sm font-medium">
                                    Video Evidence
                                    {selectedReport.video_metadata && (
                                      <Badge variant="outline" className="ml-2">
                                        {(
                                          selectedReport.video_metadata.size /
                                          1024 /
                                          1024
                                        ).toFixed(1)}
                                        MB •{" "}
                                        {Math.floor(
                                          (selectedReport.video_metadata
                                            .duration || 0) / 60,
                                        )}
                                        :
                                        {String(
                                          Math.floor(
                                            (selectedReport.video_metadata
                                              .duration || 0) % 60,
                                          ),
                                        ).padStart(2, "0")}
                                        {selectedReport.video_metadata
                                          .isRecorded && " • Recorded"}
                                      </Badge>
                                    )}
                                  </Label>
                                  <div className="mt-2 space-y-2">
                                    {/* Handle GridFS videoFileIds array */}
                                    {selectedReport.videoFileIds && selectedReport.videoFileIds.map((fileId, index) => (
                                      <div key={fileId} className="border rounded-lg p-2">
                                        <video
                                          src={`/api/files/videos/${fileId}`}
                                          controls
                                          preload="metadata"
                                          className="max-w-full h-auto rounded-lg border bg-black mb-2"
                                          style={{ maxHeight: "400px" }}
                                          onLoadStart={() => {
                                            console.log(`🎥 Loading video ${index + 1}...`);
                                          }}
                                          onLoadedData={() => {
                                            console.log(`✅ Video ${index + 1} loaded successfully`);
                                          }}
                                          onError={(e) => {
                                            console.error("❌ Failed to load video:", fileId);
                                            const target = e.target as HTMLVideoElement;
                                            target.style.display = "none";
                                            
                                            // Add error placeholder
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = "p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 text-center";
                                            errorDiv.innerHTML = `<p>Failed to load video ${index + 1}</p><p class="text-sm">File ID: ${fileId}</p><p class="text-xs">Try refreshing or check server logs</p>`;
                                            target.parentNode?.insertBefore(errorDiv, target);
                                          }}
                                        >
                                          Your browser does not support video playback.
                                        </video>
                                        <p className="text-xs text-muted-foreground">Video {index + 1} - ID: {fileId}</p>
                                      </div>
                                    ))}
                                    
                                    {/* Handle single video_file_id */}
                                    {selectedReport.video_file_id && !selectedReport.videoFileIds && (
                                      <div className="border rounded-lg p-2">
                                        <video
                                          src={`/api/files/${selectedReport.video_file_id}`}
                                          controls
                                          preload="metadata"
                                          className="max-w-full h-auto rounded-lg border bg-black mb-2"
                                          style={{ maxHeight: "400px" }}
                                          onLoadStart={() => {
                                            console.log(`🎥 Loading video: ${selectedReport.video_file_id}`);
                                          }}
                                          onLoadedData={() => {
                                            console.log(`✅ Video loaded successfully: ${selectedReport.video_file_id}`);
                                          }}
                                          onError={(e) => {
                                            console.error("❌ Failed to load video:", selectedReport.video_file_id);
                                            const target = e.target as HTMLVideoElement;
                                            target.style.display = "none";
                                            
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = "p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 text-center";
                                            errorDiv.innerHTML = `
                                              <p>❌ Failed to load video</p>
                                              <p class="text-sm">File ID: ${selectedReport.video_file_id}</p>
                                              <p class="text-xs">Check server logs or try refreshing</p>
                                              <button onclick="window.open('/api/files/${selectedReport.video_file_id}', '_blank')" class="mt-2 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs hover:bg-blue-200">
                                                🔗 Open Direct Link
                                              </button>
                                            `;
                                            target.parentNode?.insertBefore(errorDiv, target);
                                          }}
                                        >
                                          Your browser does not support video playback.
                                        </video>
                                        <p className="text-xs text-muted-foreground">
                                          Video - ID: {selectedReport.video_file_id}
                                          {selectedReport.files?.video && (
                                            <span> • {selectedReport.files.video.filename} ({(selectedReport.files.video.size / 1024 / 1024).toFixed(1)} MB)</span>
                                          )}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Handle legacy video_url */}
                                    {selectedReport.video_url && !selectedReport.video_file_id && !selectedReport.videoFileIds && (
                                      <div className="border rounded-lg p-2">
                                        <video
                                          src={selectedReport.video_url}
                                          controls
                                          preload="metadata"
                                          className="max-w-full h-auto rounded-lg border bg-black mb-2"
                                          style={{ maxHeight: "400px" }}
                                          onLoadStart={() => console.log("🎥 Loading legacy video...")}
                                          onLoadedData={() => console.log("✅ Legacy video loaded successfully")}
                                          onError={() => console.error("❌ Failed to load legacy video")}
                                        >
                                          Your browser does not support video playback.
                                        </video>
                                        <p className="text-xs text-muted-foreground">Legacy Video URL</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Location Information */}
                              {selectedReport.location && (selectedReport.location.latitude || (selectedReport.location as any).lat) && (selectedReport.location.longitude || (selectedReport.location as any).lng) && (
                                <div>
                                  <Label className="text-sm font-medium">
                                    Geographic Location
                                    <Badge variant="outline" className="ml-2">
                                      <MapPin className="w-3 h-3 mr-1" />
                                      {(selectedReport.location as any).source || 'GPS'}
                                    </Badge>
                                  </Label>
                                  <div className="mt-2 space-y-3">
                                    {/* Location Details */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                      <div className="flex items-center gap-2 mb-2">
                                        <MapPin className="w-4 h-4 text-blue-600" />
                                        <span className="font-medium text-sm">
                                          {formatLocation(selectedReport.location)}
                                        </span>
                                      </div>
                                      {selectedReport.location.address && (
                                        <p className="text-sm text-muted-foreground mb-1">
                                          📍 {selectedReport.location.address}
                                        </p>
                                      )}
                                      {(selectedReport.location as any).city && (
                                        <p className="text-sm text-muted-foreground mb-1">
                                          🏙️ {(selectedReport.location as any).city}
                                          {(selectedReport.location as any).region && `, ${(selectedReport.location as any).region}`}
                                          {(selectedReport.location as any).country && ` - ${(selectedReport.location as any).country}`}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                                        <span>Accuracy: ±{Math.round(selectedReport.location.accuracy || 0)}m</span>
                                        {selectedReport.location.timestamp && (
                                          <span>• Captured: {new Date(selectedReport.location.timestamp).toLocaleString()}</span>
                                        )}
                                        {(selectedReport.location as any).isp && (
                                          <span>• ISP: {(selectedReport.location as any).isp}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Complete Report Details */}
                              <div>
                                <Label className="text-sm font-medium">
                                  📋 Report Information
                                </Label>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Basic Info */}
                                  <div className="space-y-3">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                      <h4 className="font-medium text-sm mb-2">Report Details</h4>
                                      <div className="space-y-1 text-xs">
                                        <div><span className="font-medium">Report ID:</span> {selectedReport.shortId || selectedReport.id}</div>
                                        <div><span className="font-medium">Severity:</span> {selectedReport.severity || 'Not set'}</div>
                                        <div><span className="font-medium">Status:</span> {selectedReport.status}</div>
                                      </div>
                                    </div>
                                    
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                      <h4 className="font-medium text-sm mb-2">Timestamps</h4>
                                      <div className="space-y-1 text-xs">
                                        <div><span className="font-medium">Created:</span> {formatDate(selectedReport.created_at)}</div>
                                        <div><span className="font-medium">Updated:</span> {formatDate(selectedReport.updated_at)}</div>
                                        {selectedReport.resolved_at && (
                                          <div><span className="font-medium">Resolved:</span> {formatDate(selectedReport.resolved_at)}</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Technical Info */}
                                  <div className="space-y-3">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                      <h4 className="font-medium text-sm mb-2">Security</h4>
                                      <div className="space-y-1 text-xs">
                                        <div><span className="font-medium">Encryption:</span> {selectedReport.is_encrypted ? '🔒 E2E Encrypted' : '📝 Plain Text'}</div>
                                        {selectedReport.reporter_email && (
                                          <div><span className="font-medium">Reporter Email:</span> {selectedReport.reporter_email}</div>
                                        )}
                                        {selectedReport.is_offline_sync && (
                                          <div><span className="font-medium">Offline Sync:</span> ✅ Yes</div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {selectedReport.location && (
                                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <h4 className="font-medium text-sm mb-2">Location</h4>
                                        <div className="space-y-1 text-xs">
                                          <div><span className="font-medium">Has Location:</span> ✅ Yes</div>
                                          <div><span className="font-medium">Coordinates:</span> {selectedReport.location.latitude?.toFixed(4)}, {selectedReport.location.longitude?.toFixed(4)}</div>
                                          {selectedReport.location.accuracy && (
                                            <div><span className="font-medium">Accuracy:</span> ±{selectedReport.location.accuracy}m</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* AI Moderation Results */}
                              {selectedReport.moderation && (
                                <div>
                                  <Label className="text-sm font-medium">
                                    AI Moderation Analysis
                                  </Label>
                                  <div
                                    className={`mt-2 p-4 rounded-lg border ${
                                      selectedReport.moderation.isFlagged
                                        ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
                                        : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      {selectedReport.moderation.isFlagged ? (
                                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                      )}
                                      <span
                                        className={`font-medium text-sm ${
                                          selectedReport.moderation.isFlagged
                                            ? "text-yellow-800"
                                            : "text-green-800"
                                        }`}
                                      >
                                        {selectedReport.moderation.isFlagged
                                          ? "Content Flagged"
                                          : "Content Cleared"}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {Math.round(
                                          selectedReport.moderation.confidence *
                                            100,
                                        )}
                                        % confidence
                                      </Badge>
                                    </div>
                                    {selectedReport.moderation.reason && (
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {selectedReport.moderation.reason}
                                      </p>
                                    )}
                                    {selectedReport.moderation.detectedTerms
                                      .length > 0 && (
                                      <div className="text-xs">
                                        <span className="text-muted-foreground">
                                          Detected terms:{" "}
                                        </span>
                                        <span className="font-mono">
                                          {selectedReport.moderation.detectedTerms
                                            .slice(0, 5)
                                            .join(", ")}
                                          {selectedReport.moderation
                                            .detectedTerms.length > 5 &&
                                            ` +${selectedReport.moderation.detectedTerms.length - 5} more`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {selectedReport.admin_response && (
                                <div>
                                  <Label className="text-sm font-medium">
                                    Admin Response
                                  </Label>
                                  <div className="mt-2 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                                    <p className="whitespace-pre-wrap">
                                      {selectedReport.admin_response}
                                    </p>
                                    {selectedReport.admin_response_at && (
                                      <p className="text-xs text-muted-foreground mt-2">
                                        Responded on{" "}
                                        {formatDate(
                                          selectedReport.admin_response_at,
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div>
                                <Label
                                  htmlFor="admin-response"
                                  className="text-sm font-medium"
                                >
                                  Add Response
                                </Label>
                                <Textarea
                                  id="admin-response"
                                  placeholder="Add an administrative response..."
                                  value={adminResponse}
                                  onChange={(e) => {
                                    // Prevent event bubbling that might cause hangs
                                    e.stopPropagation();
                                    setAdminResponse(e.target.value);
                                  }}
                                  onKeyDown={(e) => {
                                    // Prevent event bubbling for keyboard events
                                    e.stopPropagation();
                                  }}
                                  onFocus={(e) => {
                                    // Prevent event bubbling for focus events
                                    e.stopPropagation();
                                  }}
                                  className="mt-2"
                                  rows={4}
                                />
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateReportStatus(
                                      selectedReport.id,
                                      "reviewed",
                                      adminResponse,
                                    )
                                  }
                                >
                                  Mark as Reviewed
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    updateReportStatus(
                                      selectedReport.id,
                                      "flagged",
                                      adminResponse,
                                    )
                                  }
                                >
                                  Flag for Attention
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateReportStatus(
                                      selectedReport.id,
                                      "resolved",
                                      adminResponse,
                                    )
                                  }
                                >
                                  Mark as Resolved
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
