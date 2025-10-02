import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MessageSquare,
  ArrowLeft,
  Search,
  CheckCircle,
  Clock,
  Flag,
  Eye,
  Calendar,
  AlertCircle,
  Shield,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ReportStatusResponse, ReportStatus } from "@shared/api";

export default function CheckStatus() {
  const [reportId, setReportId] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportStatusResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reportId.trim()) {
      setError("Please enter a report ID");
      return;
    }

    setLoading(true);
    setError("");
    setReportStatus(null);

    try {
      console.log(`🔍 Checking status for report ID: ${reportId.trim()}`);
      const response = await fetch(`/api/reports/${reportId.trim()}/status`);

      if (response.ok) {
        const result = await response.json();
        console.log("📊 Status response:", result);
        
        if (result.success && result.data) {
          // Convert backend response to frontend format
          const statusData: ReportStatusResponse = {
            id: result.data.shortId || result.data.id,
            status: result.data.status,
            created_at: result.data.created_at,
            admin_response: result.data.admin_response,
            admin_response_at: result.data.admin_response_at,
            // Additional fields for better display
            message: result.data.message,
            category: result.data.category,
            severity: result.data.severity,
            location: result.data.location,
            is_encrypted: result.data.is_encrypted
          };
          setReportStatus(statusData);
        } else {
          setError("Invalid response format from server.");
        }
      } else if (response.status === 404) {
        setError(
          "Report not found. Please check your report ID and try again.",
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || "Failed to fetch report status. Please try again.");
      }
    } catch (err) {
      console.error("Error checking status:", err);
      setError("Failed to check status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    const statusConfig = {
      pending: {
        variant: "secondary" as const,
        icon: Clock,
        text: "Under Review",
        description:
          "Your report has been received and is being reviewed by our team.",
      },
      reviewed: {
        variant: "default" as const,
        icon: Eye,
        text: "Reviewed",
        description: "Your report has been reviewed by an administrator.",
      },
      flagged: {
        variant: "destructive" as const,
        icon: Flag,
        text: "Flagged for Priority",
        description: "Your report has been flagged for priority attention.",
      },
      resolved: {
        variant: "outline" as const,
        icon: CheckCircle,
        text: "Resolved",
        description: "Action has been taken and your report is now resolved.",
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return {
      badge: (
        <Badge variant={config.variant} className="text-sm px-3 py-1">
          <Icon className="w-4 h-4 mr-2" />
          {config.text}
        </Badge>
      ),
      description: config.description,
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
              <p className="text-xs text-muted-foreground">Check Status</p>
            </div>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Status Check Content */}
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              <Shield className="w-4 h-4 mr-1" />
              Anonymous Status Check
            </Badge>
            <h2 className="text-3xl font-bold mb-4">Check Report Status</h2>
            <p className="text-muted-foreground">
              Enter your report ID to check the current status of your
              harassment complaint.
            </p>
          </div>

          {/* Status Check Form */}
          <Card className="shadow-lg mb-8">
            <CardHeader>
              <CardTitle>Report ID Lookup</CardTitle>
              <CardDescription>
                Enter the unique report ID you received when submitting your report.
                (like "ABCD1234") .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCheckStatus} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reportId">Report ID</Label>
                  <Input
                    id="reportId"
                    type="text"
                    placeholder="e.g., ABCD1234 or 60d5ec49f1b5c72b8c8e4b2a"
                    value={reportId}
                    onChange={(e) => setReportId(e.target.value)}
                    className="font-mono"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the ID you received after submitting your report
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking Status...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      Check Status
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Status Results */}
          {reportStatus && (
            <Card className="shadow-lg border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-success" />
                  Report Found
                </CardTitle>
                <CardDescription>
                  Status information for report ID:{" "}
                  <code className="bg-muted px-2 py-1 rounded">
                    {reportStatus.id}
                  </code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Report Details */}
                {reportStatus.message && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Report Content
                    </Label>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm">
                        {reportStatus.is_encrypted ? (
                          <span className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Encrypted Report Content
                          </span>
                        ) : (
                          reportStatus.message
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Category and Severity */}
                <div className="grid grid-cols-2 gap-4">
                  {reportStatus.category && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        Category
                      </Label>
                      <Badge variant="outline">{reportStatus.category}</Badge>
                    </div>
                  )}
                  {reportStatus.severity && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        Severity
                      </Label>
                      <Badge variant={reportStatus.severity === 'urgent' ? 'destructive' : 'secondary'}>
                        {reportStatus.severity}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Current Status */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Current Status
                  </Label>
                  <div className="flex items-start gap-3">
                    {getStatusBadge(reportStatus.status).badge}
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        {getStatusBadge(reportStatus.status).description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submission Date */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Submitted
                  </Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {formatDate(reportStatus.created_at)}
                  </div>
                </div>

                {/* Location */}
                {reportStatus.location && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Location
                    </Label>
                    <div className="text-sm text-muted-foreground">
                      {(() => {
                        // Get coordinates from location structure
                        const lat = reportStatus.location.latitude;
                        const lng = reportStatus.location.longitude;
                        
                        // If we have an address, use it preferentially
                        if (reportStatus.location.address && reportStatus.location.address.trim() !== '') {
                          return reportStatus.location.address;
                        }
                        
                        // Otherwise, format coordinates if available
                        if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
                          return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                        }
                        
                        return 'Location coordinates unavailable';
                      })()}
                    </div>
                  </div>
                )}

                {/* Admin Response */}
                {reportStatus.admin_response && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Admin Response
                    </Label>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap mb-2">
                        {reportStatus.admin_response}
                      </p>
                      {reportStatus.admin_response_at && (
                        <p className="text-xs text-muted-foreground">
                          Responded on{" "}
                          {formatDate(reportStatus.admin_response_at)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Privacy Notice */}
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    This status check is completely anonymous. No personal
                    information is stored or tracked during this lookup.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Help Section */}
          <Card className="mt-8 border-0 bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Need Help?</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • Report IDs can be either short format (8 characters like "ABCD1234") or long format (24+ characters)
                </p>
                <p>
                  • IDs are case-sensitive and must be entered exactly as provided
                </p>
                <p>
                  • Status updates may take time as reports are reviewed manually
                </p>
                <p>
                  • If you've lost your report ID, you'll need to submit a new
                  report
                </p>
                <p>• For urgent matters, contact local authorities directly</p>
              </div>
              <div className="flex gap-3 mt-4">
                <Link to="/report">
                  <Button variant="outline" size="sm">
                    Submit New Report
                  </Button>
                </Link>
                <Link to="/how-it-works">
                  <Button variant="outline" size="sm">
                    How It Works
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
