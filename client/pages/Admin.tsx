import { useState, useEffect, useCallback } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Map,
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
import ReportsMap from "@/components/ReportsMap";
// import ReportsMap from "@/components/ReportsMap"; // REMOVED: Interactive map display
// import { formatLocation } from "@/lib/geolocation";

// Enhanced function for formatLocation with better error handling
const formatLocation = (location: any) => {
  if (!location) return 'Location not available';
  
  // Try to get coordinates from different possible structures
  const lat = location.latitude || location.lat;
  const lng = location.longitude || location.lng;
  
  // If we have an address, use it preferentially
  if (location.address && location.address.trim() !== '') {
    return location.address;
  }
  
  // Otherwise, format coordinates if available
  if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  
  return 'Location coordinates unavailable';
};

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [authToken, setAuthToken] = useState<string>(""); // Store JWT token dynamically
  
  // Real-time notification states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check for stored auth token on component mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem('adminToken');
    if (storedToken) {
      setAuthToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

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
      
      const initializeRealTime = async () => {
        try {
          // Try to use Socket.io if available
          try {
            const socketModule = await import('socket.io-client');
            const { io } = socketModule;
            
            const socket = io(window.location.origin, {
              transports: ['websocket', 'polling'],
              autoConnect: true
            });

            socket.on('connect', () => {
              console.log('🔗 Connected to real-time notifications via Socket.io');
              setIsConnected(true);
              socket.emit('authenticate', authToken);
            });

            socket.on('disconnect', () => {
              console.log('🔌 Disconnected from real-time notifications');
              setIsConnected(false);
            });

            socket.on('notification', (notification) => {
              console.log('📨 Received notification:', notification);
              
              setNotifications(prev => [notification, ...prev.slice(0, 9)]);
              setUnreadCount(prev => prev + 1);
              
              if (notification.type === 'NEW_REPORT') {
                fetchReports();
              }
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Whistle Admin: ${notification.data.message}`, {
                  icon: '/favicon.ico',
                  tag: notification.data.shortId
                });
              }
            });

            return () => socket.disconnect();
            
          } catch (socketError) {
            console.log('⚠️ Socket.io not available, using polling fallback');
            
            // Fallback: Poll for new reports every 30 seconds
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
                }
              } catch (error) {
                console.error('Polling error:', error);
              }
            }, 30000); // Poll every 30 seconds
          }
          
        } catch (error) {
          console.log('⚠️ Real-time notifications unavailable:', error);
        }
      };
      
      initializeRealTime();
      
      return () => {
        if (pollInterval) clearInterval(pollInterval);
      };
    }
  }, [isAuthenticated, authToken, reports]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Function to mark report as viewed by current admin
  const markReportAsViewed = async (reportId: string) => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      await fetch(`/api/reports/${reportId}/viewed`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      console.log(`📋 Report ${reportId} marked as viewed`);
    } catch (error) {
      console.error("Error marking report as viewed:", error);
    }
  };

  // Function to mark report as resolved by current admin
  const markReportAsResolved = async (reportId: string) => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`/api/reports/${reportId}/resolve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        console.log(`✅ Report ${reportId} marked as resolved`);
        // Refresh reports to show updated status
        fetchReports();
      }
    } catch (error) {
      console.error("Error marking report as resolved:", error);
    }
  };

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

      // Use the admin-specific update endpoint
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const result = await res.json();
        console.log("✅ Report status updated:", result);
        fetchReports();
        setSelectedReport(null);
        setAdminResponse("");
      } else {
        console.error("Failed to update report:", res.status);
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
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Live' : 'Offline'}
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
                Harassment Reports Dashboard
              </h2>
              <p className="text-muted-foreground">
                {reports.length} total harassment complaints received
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                All reports are forwarded here for admin review and response
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

              <Button onClick={fetchReports} variant="outline" size="sm">
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
              
              {/* Test Notifications Button */}
              <Button
                onClick={async () => {
                  try {
                    console.log("🧪 Testing notification systems...");
                    
                    const response = await fetch("/api/test/notifications", {
                      method: "GET",
                      headers: {
                        "Authorization": `Bearer ${localStorage.getItem("adminToken")}`,
                        "Content-Type": "application/json"
                      }
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                      console.log("🧪 Notification test results:", result.results);
                      
                      // Show detailed results
                      let message = "Notification Test Results:\n\n";
                      
                      if (result.results.realTime.status === 'success') {
                        message += "✅ Real-time notifications: Working\n";
                      } else {
                        message += `❌ Real-time notifications: Failed (${result.results.realTime.error || 'Unknown error'})\n`;
                      }
                      
                      if (result.results.sms.status === 'success') {
                        message += "✅ SMS notifications: Working\n";
                      } else if (result.results.sms.status === 'not_configured') {
                        message += "⚠️ SMS notifications: Not configured\n";
                      } else {
                        message += `❌ SMS notifications: Failed (${result.results.sms.error || 'Unknown error'})\n`;
                      }
                      
                      if (result.results.email.status === 'success') {
                        message += "✅ Email notifications: Working\n";
                      } else {
                        message += `❌ Email notifications: Failed (${result.results.email.error || 'Unknown error'})\n`;
                      }
                      
                      // Add recommendations
                      if (result.recommendations) {
                        message += "\nRecommendations:\n";
                        Object.entries(result.recommendations).forEach(([key, rec]) => {
                          if (rec) message += `• ${key}: ${rec}\n`;
                        });
                      }
                      
                      alert(message);
                    } else {
                      console.error("Notification test failed:", result);
                      alert("Notification test failed. Check console for details.");
                    }
                  } catch (error) {
                    console.error("Error testing notifications:", error);
                    alert("Error testing notifications. Check console for details.");
                  }
                }}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Bell className="w-4 h-4" />
                Test Notifications
              </Button>
            </div>
          </div>

          {/* Reports Dashboard with Tabs */}
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Reports List
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="w-4 h-4" />
                Geographic Map
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list">
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
                        {(report.imageFileIds && report.imageFileIds.length > 0) && (
                          <Badge variant="outline">
                            <ImageIcon className="w-3 h-3 mr-1" />
                            Photo
                          </Badge>
                        )}
                        {(report.videoFileIds && report.videoFileIds.length > 0) && (
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
                              setSelectedReport(report);
                              markReportAsViewed(report.id);
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

                              {/* Photo Evidence */}
                              {((selectedReport.imageFileIds && selectedReport.imageFileIds.length > 0) || 
                                (selectedReport.photo_file_id) || 
                                (selectedReport.files?.photo)) && (
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
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Handle multiple image file IDs */}
                                    {selectedReport.imageFileIds?.map((fileId, index) => (
                                      <div key={fileId} className="relative">
                                        <img
                                          src={`/api/reports/file/${fileId}`}
                                          alt={`Report evidence ${index + 1}`}
                                          className="w-full h-auto rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                          onError={(e) => {
                                            console.error("Failed to load photo:", e);
                                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                                          }}
                                          onClick={() => window.open(`/api/reports/file/${fileId}`, '_blank')}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Photo {index + 1} - Click to view full size
                                        </p>
                                      </div>
                                    ))}
                                    
                                    {/* Handle single photo file ID */}
                                    {selectedReport.photo_file_id && !selectedReport.imageFileIds && (
                                      <div className="relative">
                                        <img
                                          src={`/api/reports/file/${selectedReport.photo_file_id}`}
                                          alt="Report evidence"
                                          className="w-full h-auto rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                          onError={(e) => {
                                            console.error("Failed to load photo:", e);
                                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                                          }}
                                          onClick={() => window.open(`/api/reports/file/${selectedReport.photo_file_id}`, '_blank')}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Click to view full size
                                        </p>
                                      </div>
                                    )}

                                    {/* Handle files.photo structure */}
                                    {selectedReport.files?.photo && !selectedReport.photo_file_id && !selectedReport.imageFileIds && (
                                      <div className="relative">
                                        <img
                                          src={`/api/reports/file/${selectedReport.files.photo.id}`}
                                          alt={selectedReport.files.photo.filename || "Report evidence"}
                                          className="w-full h-auto rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                          onError={(e) => {
                                            console.error("Failed to load photo:", e);
                                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                                          }}
                                          onClick={() => window.open(`/api/reports/file/${selectedReport.files.photo.id}`, '_blank')}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {selectedReport.files.photo.filename} - Click to view full size
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Video Evidence */}
                              {((selectedReport.videoFileIds && selectedReport.videoFileIds.length > 0) || 
                                (selectedReport.video_file_id) || 
                                (selectedReport.files?.video)) && (
                                <div>
                                  <Label className="text-sm font-medium">
                                    Video Evidence
                                    {selectedReport.video_metadata && (
                                      <Badge variant="outline" className="ml-2">
                                        {(selectedReport.video_metadata.size / 1024 / 1024).toFixed(1)}MB •{" "}
                                        {Math.floor((selectedReport.video_metadata.duration || 0) / 60)}:
                                        {String(Math.floor((selectedReport.video_metadata.duration || 0) % 60)).padStart(2, "0")}
                                        {selectedReport.video_metadata.isRecorded && " • Recorded"}
                                      </Badge>
                                    )}
                                  </Label>
                                  <div className="mt-2 space-y-4">
                                    {/* Handle multiple video file IDs */}
                                    {selectedReport.videoFileIds?.map((fileId, index) => (
                                      <div key={fileId} className="relative">
                                        <video
                                          src={`/api/reports/file/${fileId}`}
                                          controls
                                          preload="metadata"
                                          className="w-full h-auto rounded-lg border bg-black"
                                          style={{ maxHeight: "400px" }}
                                          onError={(e) => {
                                            console.error("Failed to load video:", e);
                                            const videoElement = e.target as HTMLVideoElement;
                                            videoElement.style.display = "none";
                                            const errorDiv = document.createElement("div");
                                            errorDiv.className = "flex items-center justify-center h-32 bg-muted rounded-lg border";
                                            errorDiv.innerHTML = `<p class="text-sm text-muted-foreground">Failed to load video ${index + 1}</p>`;
                                            videoElement.parentNode?.insertBefore(errorDiv, videoElement);
                                          }}
                                        >
                                          Your browser does not support video playback.
                                        </video>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Video {index + 1}
                                        </p>
                                      </div>
                                    ))}
                                    
                                    {/* Handle single video file ID */}
                                    {selectedReport.video_file_id && !selectedReport.videoFileIds && (
                                      <div className="relative">
                                        <video
                                          src={`/api/reports/file/${selectedReport.video_file_id}`}
                                          controls
                                          preload="metadata"
                                          className="w-full h-auto rounded-lg border bg-black"
                                          style={{ maxHeight: "400px" }}
                                          onError={(e) => {
                                            console.error("Failed to load video:", e);
                                            const videoElement = e.target as HTMLVideoElement;
                                            videoElement.style.display = "none";
                                            const errorDiv = document.createElement("div");
                                            errorDiv.className = "flex items-center justify-center h-32 bg-muted rounded-lg border";
                                            errorDiv.innerHTML = `<p class="text-sm text-muted-foreground">Failed to load video</p>`;
                                            videoElement.parentNode?.insertBefore(errorDiv, videoElement);
                                          }}
                                        >
                                          Your browser does not support video playback.
                                        </video>
                                      </div>
                                    )}

                                    {/* Handle files.video structure */}
                                    {selectedReport.files?.video && !selectedReport.video_file_id && !selectedReport.videoFileIds && (
                                      <div className="relative">
                                        <video
                                          src={`/api/reports/file/${selectedReport.files.video.id}`}
                                          controls
                                          preload="metadata"
                                          className="w-full h-auto rounded-lg border bg-black"
                                          style={{ maxHeight: "400px" }}
                                          onError={(e) => {
                                            console.error("Failed to load video:", e);
                                            const videoElement = e.target as HTMLVideoElement;
                                            videoElement.style.display = "none";
                                            const errorDiv = document.createElement("div");
                                            errorDiv.className = "flex items-center justify-center h-32 bg-muted rounded-lg border";
                                            errorDiv.innerHTML = `<p class="text-sm text-muted-foreground">Failed to load video</p>`;
                                            videoElement.parentNode?.insertBefore(errorDiv, videoElement);
                                          }}
                                        >
                                          Your browser does not support video playback.
                                        </video>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {selectedReport.files.video.filename}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Location Information */}
                              {selectedReport.location && (
                                <div>
                                  <Label className="text-sm font-medium">
                                    Location Information
                                  </Label>
                                  <div className="mt-2 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                      <MapPin className="w-4 h-4 text-blue-600" />
                                      <span className="font-medium text-sm">
                                        {formatLocation(
                                          selectedReport.location,
                                        )}
                                      </span>
                                    </div>
                                    {selectedReport.location.address && (
                                      <p className="text-sm text-muted-foreground">
                                        📍 {selectedReport.location.address}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Accuracy: ±
                                      {Math.round(
                                        selectedReport.location.accuracy,
                                      )}
                                      m • Captured:{" "}
                                      {new Date(
                                        selectedReport.location.timestamp,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              )}

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
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => {
                                    markReportAsResolved(selectedReport.id);
                                    setSelectedReport(null); // Close modal after resolving
                                  }}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Mark as Resolved
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
            </TabsContent>

            <TabsContent value="map">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Map className="w-5 h-5" />
                      Geographic Distribution of Reports
                    </CardTitle>
                    <CardDescription>
                      Interactive map showing all reports with location data. Click on pins to view report details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReportsMap reports={reports} authToken={authToken} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
