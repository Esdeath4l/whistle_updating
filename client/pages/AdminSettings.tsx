import { useState, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  ArrowLeft,
  Settings,
  Mail,
  Send,
  CheckCircle,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

export default function AdminSettings() {
  const [emailSettings, setEmailSettings] = useState({
    emailEnabled: true,
    adminEmail: "ritisulo@gmail.com",
    fromEmail: "whistle.git@gmail.com",
  });
  const [emailStatus, setEmailStatus] = useState<
    "unknown" | "configured" | "error"
  >("unknown");
  const [testingEmail, setTestingEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  // Remove toast hook since we're using the direct import

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/notifications/settings");
      if (response.ok) {
        const data = await response.json();
        setEmailSettings({
          emailEnabled: data.emailEnabled,
          adminEmail: data.adminEmail,
          fromEmail: "whistle.git@gmail.com",
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const testEmailService = async () => {
    setTestingEmail(true);
    try {
      // Check both sessionStorage and localStorage for the token
      const token = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
      if (!token) {
        toast({
          title: "❌ Authentication Required",
          description: "Please login first - no admin token found",
          variant: "destructive",
        });
        setTestingEmail(false);
        return;
      }

      console.log('🧪 Testing email service with token...');
      const response = await fetch("/api/notifications/test-email", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient: emailSettings.adminEmail,
          subject: 'Whistle Email Service Test'
        })
      });

      console.log('Test email response status:', response.status);
      const data = await response.json();
      console.log('Test email response data:', data);

      if (response.ok) {
        setEmailStatus("configured");
        toast({
          title: "✅ Email Test Successful",
          description: `Test email sent to ${emailSettings.adminEmail}`,
          variant: "default",
        });
      } else {
        setEmailStatus("error");
        console.error('Email test failed:', data);
        
        // Show more detailed error message
        let errorMessage = data.error || data.message || "Email service not configured";
        if (response.status === 401) {
          errorMessage = "Authentication failed - please login again";
        } else if (response.status === 403) {
          errorMessage = "Access denied - admin privileges required";
        }
        
        toast({
          title: "❌ Email Test Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Email test error:', error);
      setEmailStatus("error");
      toast({
        title: "❌ Email Test Failed",
        description: "Failed to connect to email service",
        variant: "destructive",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const getEmailStatusBadge = () => {
    switch (emailStatus) {
      case "configured":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Configured
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Not Configured
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl whistle-gradient flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Whistle</h1>
              <p className="text-xs text-muted-foreground">Admin Settings</p>
            </div>
          </Link>
          <Link to="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Settings Content */}
      <div className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <Settings className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">System Settings</h2>
              <p className="text-muted-foreground">
                Configure notification delivery and system preferences
              </p>
            </div>
          </div>

          {/* Email Configuration */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Email Notifications</CardTitle>
                    <CardDescription>
                      Configure email delivery for urgent reports
                    </CardDescription>
                  </div>
                </div>
                {getEmailStatusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Admin Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={emailSettings.adminEmail}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Email where urgent notifications will be sent
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-email">From Email Address</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={emailSettings.fromEmail}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    System email address for sending notifications
                  </p>
                </div>
              </div>

              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Email Service Configuration Required:</strong> To
                  enable actual email delivery, set the{" "}
                  <code>EMAIL_APP_PASSWORD</code> environment variable with a
                  Gmail App Password. Without this, emails will only be logged
                  to the console.
                  <br />
                  <br />
                  <strong>Steps to configure:</strong>
                  <ol className="mt-2 ml-4 list-decimal">
                    <li>Enable 2FA on whistle.git@gmail.com</li>
                    <li>
                      Generate an App Password at{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Google Account Settings
                      </a>
                    </li>
                    <li>Set EMAIL_APP_PASSWORD environment variable</li>
                    <li>Test the configuration using the button below</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  onClick={testEmailService}
                  disabled={testingEmail}
                  variant="outline"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {testingEmail ? "Testing..." : "Test Email Service"}
                </Button>
                <Button onClick={fetchSettings} variant="ghost" size="sm">
                  Refresh Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* E2EE Status */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-primary" />
                <div>
                  <CardTitle>End-to-End Encryption</CardTitle>
                  <CardDescription>
                    Encryption status for report submissions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <strong className="text-green-800">
                        Desktop Browsers
                      </strong>
                    </div>
                    <p className="text-sm text-green-700">
                      Reports are encrypted with AES-256 before transmission
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <strong className="text-amber-800">Mobile/Legacy</strong>
                    </div>
                    <p className="text-sm text-amber-700">
                      Falls back to secure HTTPS transmission only
                    </p>
                  </div>
                </div>
                <Alert>
                  <AlertDescription>
                    <strong>E2EE Indicator Behavior:</strong> The green "E2E
                    Encrypted" badge appears only for reports that were
                    successfully encrypted client-side. Reports without this
                    badge used secure HTTPS but not client-side encryption. This
                    is expected behavior due to browser compatibility
                    limitations.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>Current System Status</CardTitle>
              <CardDescription>
                Overview of all system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    Real-time Notifications
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Report Encryption</span>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Email Service</span>
                  {getEmailStatusBadge()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
