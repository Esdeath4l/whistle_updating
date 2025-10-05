import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Lock,
  ArrowLeft,
  Send,
  CheckCircle,
  AlertCircle,
  Camera,
  Shield,
  AlertTriangle,
  Heart,
  MessageCircle,
  Flag,
  MapPin,
  Loader2,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import VideoUploadRecorder, { VideoFile } from "@/components/VideoUploadRecorder";
import IPGeolocationPicker from "@/components/IPGeolocationPicker";

// Simplified types for demo
type ReportCategory = "harassment" | "emergency" | "safety" | "feedback" | "other";
type ReportSeverity = "low" | "medium" | "high" | "urgent";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  isp?: string;
  timestamp: number;
  source: 'ipgeolocation' | 'browser_gps' | 'manual';
}

interface CreateReportRequest {
  message: string;
  category: ReportCategory;
  severity: ReportSeverity;
  photo_url?: string;
  is_encrypted?: boolean;
  location?: LocationData;
  share_location?: boolean;
}

interface CreateReportResponse {
  id: string;
  message: string;
}

export default function Report() {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<ReportCategory>("harassment");
  const [severity, setSeverity] = useState<ReportSeverity>("medium");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  // Location state
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [ipGeolocation, setIPGeolocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // Get location when user opts in
  useEffect(() => {
    if (shareLocation && !location) {
      getCurrentLocation();
    }
  }, [shareLocation]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      return;
    }

    setGettingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setGettingLocation(false);
        console.log("High-precision GPS location captured:", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy + "m"
        });
      },
      (error) => {
        setGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access denied by user");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out");
            break;
          default:
            setLocationError("An unknown error occurred while getting location");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const categoryOptions = [
    {
      value: "harassment" as ReportCategory,
      label: "Harassment",
      icon: Flag,
      description: "Inappropriate behavior, bullying, or discrimination",
    },
    {
      value: "emergency" as ReportCategory,
      label: "Emergency",
      icon: AlertTriangle,
      description: "Immediate safety threats or dangerous situations",
    },
    {
      value: "safety" as ReportCategory,
      label: "Safety Concern",
      icon: Shield,
      description: "General safety issues or security concerns",
    },
    {
      value: "feedback" as ReportCategory,
      label: "Feedback",
      icon: MessageCircle,
      description: "General feedback or non-urgent concerns",
    },
    {
      value: "other" as ReportCategory,
      label: "Other",
      icon: MessageSquare,
      description: "Other concerns not listed above",
    },
  ];

  const severityOptions = [
    { value: "low" as ReportSeverity, label: "Low Priority", color: "text-muted-foreground" },
    { value: "medium" as ReportSeverity, label: "Medium Priority", color: "text-yellow-600" },
    { value: "high" as ReportSeverity, label: "High Priority", color: "text-orange-600" },
    { value: "urgent" as ReportSeverity, label: "Urgent", color: "text-red-600" },
  ];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Photo must be smaller than 5MB");
        return;
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file");
        return;
      }

      setPhotoFile(file);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setError("Please enter a message");
      return;
    }

    if (!category) {
      setError("Please select a category");
      return;
    }

    if (!severity) {
      setError("Please select a priority level");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('message', message.trim());
      formData.append('category', category);
      formData.append('severity', severity);
      formData.append('is_encrypted', 'false');
      formData.append('share_location', shareLocation.toString());

      // Add location data if available (prefer high-precision GPS over IP geolocation)
      const finalLocation = (shareLocation && location ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
        source: 'browser_gps' as const
      } : ipGeolocation);

      if (finalLocation) {
        formData.append('location', JSON.stringify(finalLocation));
      }

      // Add photo file if available
      if (photoFile) {
        formData.append('image', photoFile);  // Backend expects 'image' not 'photo'
      }

      // Add video file if available
      if (videoFile) {
        formData.append('video', videoFile.file);
        formData.append('video_metadata', JSON.stringify({
          duration: videoFile.duration || 0,
          size: videoFile.size,
          format: videoFile.format,
          isRecorded: videoFile.isRecorded,
          uploadMethod: "direct"
        }));
      }

      // Submit to API using FormData
      const response = await fetch("/api/reports/with-files", {
        method: "POST",
        body: formData, // Don't set Content-Type, let browser set it with boundary
      });

      if (!response.ok) {
        let errorMessage = `Failed to submit report (${response.status})`;
        try {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            errorMessage = `${errorMessage}: ${errorText}`;
          }
        } catch (e) {
          console.warn("Could not read error response");
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("❌ Failed to parse response as JSON:", parseError);
        throw new Error("Server returned invalid JSON response");
      }
      
      // Defensive check for response structure
      if (result && result.data && (result.data.shortId || result.data.id)) {
        // Prefer shortId if available, fallback to id for backward compatibility
        setReportId(result.data.shortId || result.data.id);
        setSubmitted(true);
      } else {
        console.error("❌ Unexpected response structure:", result);
        throw new Error("Server returned invalid response format");
      }

    } catch (err) {
      console.error("Error submitting report:", err);
      setError(
        `Failed to submit report: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Whistle</h1>
                <p className="text-xs text-muted-foreground">
                  Anonymous Reporting
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* Success Content */}
        <div className="py-20 px-4">
          <div className="container mx-auto max-w-2xl text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h2 className="text-3xl font-bold mb-4">
              Report Submitted Successfully
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Thank you for your report. It has been submitted anonymously and
              securely.
            </p>

            <Card className="text-left mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Your Report ID
                </CardTitle>
                <CardDescription>
                  Use this unique ID to check your report status. Copy and save it securely.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-lg font-mono">{reportId}</code>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  💡 This is your report tracking ID. You can use it on the "Check Status" page to see updates.
                </p>
              </CardContent>
            </Card>

            <Alert className="mb-8">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Your report has been submitted anonymously. No personal
                information was collected or stored.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/">
                <Button variant="outline">Return Home</Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  setSubmitted(false);
                  setMessage("");
                  setPhotoFile(null);
                  setReportId("");
                }}
              >
                Submit Another Report
              </Button>
            </div>
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Whistle</h1>
              <p className="text-xs text-muted-foreground">
                Anonymous Reporting
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              <Lock className="w-4 h-4 mr-1" />
              Anonymous & Secure
            </Badge>
            <h2 className="text-3xl font-bold mb-4">Submit Anonymous Report</h2>
            <p className="text-muted-foreground">
              Your privacy is protected. This form collects no personal
              information.
            </p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Report Details</CardTitle>
              <CardDescription>
                Describe the incident or concern you'd like to report. Be as
                specific as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="category">Report Category *</Label>
                    <Select
                      value={category}
                      onValueChange={(value) =>
                        setCategory(value as ReportCategory)
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">
                                    {option.label}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {option.description}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="severity">Priority Level *</Label>
                    <Select
                      value={severity}
                      onValueChange={(value) =>
                        setSeverity(value as ReportSeverity)
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {severityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className={option.color}>{option.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Your Report *</Label>
                  <Textarea
                    id="message"
                    placeholder="Please describe the incident, concern, or feedback you'd like to report. Include relevant details such as date, time, location, and people involved..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[120px] resize-none"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {message.length}/1000 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Photo Evidence (Optional)</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    {photoFile ? (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mx-auto">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="text-sm font-medium">{photoFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(photoFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPhotoFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto">
                          <Camera className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm">Click to upload a photo</p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG up to 5MB
                        </p>
                      </div>
                    )}
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* Video Evidence Section */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Video Evidence (Optional)
                  </Label>
                  <Card className="border-2 border-dashed border-muted-foreground/25">
                    <CardContent className="p-4">
                      <VideoUploadRecorder
                        onVideoChange={setVideoFile}
                        config={{
                          maxSizeMB: 50,
                          maxDurationMinutes: 3,
                          allowedFormats: ["video/mp4", "video/webm"],
                        }}
                        disabled={isSubmitting}
                      />
                      {videoFile && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Video ready for upload</span>
                          </div>
                          <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                            {videoFile.file.name} • {(videoFile.size / 1024 / 1024).toFixed(1)}MB
                            {videoFile.duration && ` • ${Math.round(videoFile.duration)}s`}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Location Sharing Section */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="share-location"
                      checked={shareLocation}
                      onCheckedChange={(checked) => {
                        setShareLocation(checked as boolean);
                        if (!checked) {
                          setLocation(null);
                          setIPGeolocation(null);
                          setLocationError("");
                        }
                      }}
                    />
                    <Label htmlFor="share-location" className="flex items-center gap-2 cursor-pointer">
                      <MapPin className="w-4 h-4" />
                      Share location (optional)
                    </Label>
                  </div>
                  
                  {shareLocation && (
                    <div className="ml-6 space-y-4">
                      {/* GPS Location */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">GPS Location</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={getCurrentLocation}
                            disabled={gettingLocation}
                            className="flex items-center gap-2"
                          >
                            {gettingLocation ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MapPin className="w-4 h-4" />
                            )}
                            {gettingLocation ? "Getting Location..." : "Use Current Location"}
                          </Button>
                          
                          {location && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(null)}
                            >
                              Clear GPS
                            </Button>
                          )}
                        </div>
                        
                        {location && (
                          <div className="text-sm text-green-600 flex items-center gap-2 p-2 bg-green-50 rounded">
                            <CheckCircle className="w-4 h-4" />
                            GPS location captured (±{Math.round(location.coords.accuracy)}m accuracy)
                          </div>
                        )}
                        
                        {locationError && (
                          <div className="text-sm text-red-600 flex items-center gap-2 p-2 bg-red-50 rounded">
                            <AlertCircle className="w-4 h-4" />
                            {locationError}
                          </div>
                        )}
                      </div>

                      {/* IPGeolocation Location Detection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Automatic Location Detection</Label>
                        <IPGeolocationPicker
                          onLocationSelect={setIPGeolocation}
                          currentLocation={ipGeolocation}
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Location Summary */}
                      {(location || ipGeolocation) && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            📍 Active Location: {ipGeolocation ? 
                              (ipGeolocation.source === 'ipgeolocation' ? 'IP Location' : 
                               ipGeolocation.source === 'browser_gps' ? 'GPS Location' : 'Manual Location') 
                              : 'GPS Location'}
                          </p>
                          {ipGeolocation && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              {ipGeolocation.address || `${ipGeolocation.latitude.toFixed(6)}, ${ipGeolocation.longitude.toFixed(6)}`}
                              {ipGeolocation.city && ipGeolocation.country && (
                                <span> - {ipGeolocation.city}, {ipGeolocation.country}</span>
                              )}
                            </p>
                          )}
                          {location && !ipGeolocation && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              GPS: {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        🌍 <strong>IP Location:</strong> Automatic city-level location detection (no permissions needed).<br/>
                        📱 <strong>GPS:</strong> Precise location from your device (requires permission).<br/>
                         All location data is encrypted and only accessible to authorized personnel.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    🔒 <strong>Anonymous & Secure:</strong> Your report is
                    submitted anonymously. No personal information, IP addresses, or
                    identifying data is stored.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90"
                  size="lg"
                  disabled={isSubmitting || !message.trim()}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Submit Anonymous Report
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
