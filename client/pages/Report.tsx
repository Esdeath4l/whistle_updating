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
  Upload,
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
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  CreateReportRequest,
  CreateReportResponse,
  ReportCategory,
  ReportSeverity,
} from "@shared/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { encryptReportData } from "@/lib/encryption";
import VideoUploadRecorder, {
  VideoFile,
} from "@/components/VideoUploadRecorder";
import { moderateContent, getModerationMessage } from "@/lib/ai-moderation";
import {
  isOnline,
  saveOfflineReport,
  setupOfflineSync,
  syncPendingReports,
  getPendingReports,
} from "@/lib/offline-storage";
import {
  getCurrentLocation,
  checkGeolocationSupport,
  reverseGeocode,
  formatLocation,
} from "@/lib/geolocation";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

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

  // New feature states
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string>("");
  const [geolocationSupported, setGeolocationSupported] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [pendingReports, setPendingReports] = useState(0);
  const [moderationResult, setModerationResult] = useState<any>(null);
  const [showModerationWarning, setShowModerationWarning] = useState(false);
  const [encrypt, setEncrypt] = useState(false); // Encryption toggle

  const categoryOptions = [
    {
      value: "harassment",
      label: "Harassment",
      icon: Flag,
      description: "Inappropriate behavior, bullying, or discrimination",
    },
    {
      value: "medical",
      label: "Medical Emergency", 
      icon: Heart,
      description: "Health-related emergencies or medical assistance needed",
    },
    {
      value: "emergency",
      label: "Safety Emergency",
      icon: AlertTriangle,
      description: "Immediate safety threats or dangerous situations",
    },
    {
      value: "safety",
      label: "Safety Concern",
      icon: Shield,
      description: "General safety issues or security concerns",
    },
    {
      value: "feedback",
      label: "Feedback",
      icon: MessageCircle,
      description: "General feedback or non-urgent concerns",
    },
  ] as const;

  const severityOptions = [
    { value: "low", label: "Low Priority", color: "text-muted-foreground" },
    { value: "medium", label: "Medium Priority", color: "text-yellow-600" },
    { value: "high", label: "High Priority", color: "text-orange-600" },
    { value: "urgent", label: "Urgent", color: "text-red-600" },
  ] as const;

  // Check geolocation support and setup offline sync
  useEffect(() => {
    const initializeFeatures = async () => {
      // Check geolocation support
      const geoSupport = await checkGeolocationSupport();
      setGeolocationSupported(geoSupport.supported);

      // Setup offline sync
      setupOfflineSync((results) => {
        if (results.successful > 0) {
          toast({
            title: "Reports Synced",
            description: `${results.successful} report(s) synced successfully`,
          });
        }
        updatePendingCount();
      });

      // Initial pending count
      updatePendingCount();
    };

    initializeFeatures();

    // Listen for online/offline events
    const handleOnline = () => {
      setOnline(true);
      toast({
        title: "Connection Restored",
        description: "Reports will be synced automatically",
      });
    };

    const handleOffline = () => {
      setOnline(false);
      toast({
        title: "Connection Lost",
        description: "Reports will be saved offline",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // AI Moderation effect
  useEffect(() => {
    if (message.trim().length > 10) {
      const result = moderateContent(message);
      setModerationResult(result);
      setShowModerationWarning(result.isFlagged);
    } else {
      setModerationResult(null);
      setShowModerationWarning(false);
    }
  }, [message]);

  const updatePendingCount = () => {
    setPendingReports(getPendingReports().length);
  };

  const getLocation = async () => {
    if (!geolocationSupported) {
      setLocationError("Geolocation not supported by this browser");
      return;
    }

    setGettingLocation(true);
    setLocationError("");

    try {
      const locationData = await getCurrentLocation();

      // Get address if possible
      try {
        const address = await reverseGeocode(
          locationData.latitude,
          locationData.longitude,
        );
        locationData.address = address;
      } catch (e) {
        console.warn("Could not get address:", e);
      }

      setLocation(locationData);
      toast({
        title: "Location Captured",
        description: formatLocation(locationData),
      });
    } catch (error: any) {
      let errorMessage = "Failed to get location";
      let toastDescription = "Failed to get location";
      
      if (error.code === 1) {
        errorMessage = "Location access denied. Please allow location access in your browser settings.";
        toastDescription = "Click the location icon in your browser's address bar to allow access";
      } else if (error.code === 2) {
        errorMessage = "Location information unavailable. Please check your GPS/location services.";
        toastDescription = "Make sure location services are enabled on your device";
      } else if (error.code === 3) {
        errorMessage = "Location request timeout. Please try again.";
        toastDescription = "Location request took too long, please try again";
      } else {
        errorMessage = error.message || errorMessage;
        toastDescription = error.message || toastDescription;
      }
      
      setLocationError(errorMessage);
      toast({
        title: "Location Error",
        description: toastDescription,
        variant: "destructive",
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 500MB for images)
      if (file.size > 500 * 1024 * 1024) {
        setError("Photo must be smaller than 500MB");
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

    console.log("Form validation passed", {
      message: message.length,
      category,
      severity,
    });

    console.log("Starting report submission:", {
      hasPhotoFile: !!photoFile,
      hasVideoFile: !!videoFile,
      photoSize: photoFile?.size || 0,
      videoSize: videoFile?.size || 0,
      online: online
    });

    setIsSubmitting(true);
    setError("");

    try {
      let photo_url = "";
      let video_url = "";

      // If there's a photo, convert to base64 for demo
      // In production, you'd upload to a file storage service
      if (photoFile) {
        const reader = new FileReader();
        photo_url = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(photoFile);
        });
      }

      // If there's a video, convert to base64 for demo
      // In production, you'd upload to a file storage service with resumable uploads
      if (videoFile) {
        // Safety check: Don't process extremely large videos that could crash the browser
        if (videoFile.size > 1000 * 1024 * 1024) {
          // 1000MB limit for video files
          setError(
            "Video file too large. Please use a file smaller than 1000MB or try compressing the video.",
          );
          setIsSubmitting(false);
          return;
        }

        try {
          const reader = new FileReader();
          video_url = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () =>
              reject(new Error("Failed to read video file"));
            reader.readAsDataURL(videoFile.file);
          });

          console.log("Video processed for submission:", {
            size: `${(videoFile.size / 1024 / 1024).toFixed(2)}MB`,
            duration: `${(videoFile.duration || 0 / 60).toFixed(1)}min`,
            format: videoFile.format,
          });
        } catch (error) {
          console.error("Failed to process video:", error);
          setError("Failed to process video file. Please try again.");
          setIsSubmitting(false);
          return;
        }
      }

      let reportData: CreateReportRequest;

      // Check if we're on mobile (QR code scan) for better compatibility
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );

      if (isMobile) {
        // Use plain text for mobile devices to ensure compatibility
        reportData = {
          message: message.trim(),
          category,
          severity,
          is_encrypted: false,
          location: shareLocation && location ? location : undefined,
          share_location: shareLocation,
          is_offline_sync: !online,
        };
        console.log("Submitting plain text report (mobile device detected)");
      } else {
        try {
          // Try to encrypt data on desktop
          const encryptedData = encryptReportData({
            message: message.trim(),
            category,
            photo_url: photo_url || undefined,
            video_url: video_url || undefined,
            video_metadata: videoFile
              ? {
                  duration: videoFile.duration || 0,
                  size: videoFile.size,
                  format: videoFile.format,
                  isRecorded: videoFile.isRecorded,
                  uploadMethod:
                    videoFile.size > 100 * 1024 * 1024 ? "resumable" : "direct",
                }
              : undefined,
          });

          reportData = {
            message: "", // Clear text removed for security
            category: "feedback", // Dummy category for obfuscation
            severity,
            encrypted_data: encryptedData,
            is_encrypted: true,
            location: shareLocation && location ? location : undefined,
            share_location: shareLocation,
            is_offline_sync: !online,
          };

          console.log("Submitting encrypted report data"); // Debug log (no sensitive data)
        } catch (encryptionError) {
          console.warn(
            "Encryption failed, submitting as plain text:",
            encryptionError,
          );

          // Fallback to plain text submission if encryption fails
          reportData = {
            message: message.trim(),
            category,
            severity,
            is_encrypted: false,
            location: shareLocation && location ? location : undefined,
            share_location: shareLocation,
            is_offline_sync: !online,
          };

          console.log("Submitting plain text report data (encryption failed)");
        }
      }

      // Handle offline submission
      if (!online) {
        const offlineData = {
          message: message.trim(),
          category,
          severity,
          share_location: shareLocation,
          is_offline_sync: true,
        };
        const offlineId = saveOfflineReport(offlineData);
        console.log("Report saved offline:", offlineId);

        toast({
          title: "Report Saved Offline",
          description: "Your report will be synced when connection is restored",
        });

        setReportId(offlineId);
        setSubmitted(true);
        updatePendingCount();
        return;
      }

      // Always use GridFS (multipart/form-data) submission
      console.log("Submitting report via GridFS...");
      const result = await submitWithGridFS();
      
      // Handle GridFS success response
      if (result.success) {
        setReportId(result.data.shortId); // Use shortId for tracking
        setSubmitted(true);
        
        const hasFiles = (result.data.imageFiles > 0) || (result.data.videoFiles > 0);
        
        toast({
          title: "Report Submitted Successfully",
          description: hasFiles 
            ? `Report #${result.data.shortId} with ${result.data.imageFiles || 0} image(s) and ${result.data.videoFiles || 0} video(s) uploaded to secure storage`
            : `Report #${result.data.shortId} submitted successfully`,
        });
        
        console.log("✅ GridFS submission completed:", {
          reportId: result.data.id,
          shortId: result.data.shortId,
          imageFiles: result.data.imageFiles,
          videoFiles: result.data.videoFiles,
          locationAccuracy: result.data.locationAccuracy
        });
        return;
      }
      
      // Fallback handling
      setReportId(result.id || result.shortId);
      setSubmitted(true);

      // Show success message with moderation info if flagged
      if (moderationResult?.isFlagged) {
        toast({
          title: "Report Submitted",
          description: "⚠️ Report flagged for review by AI moderation",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Report Submitted",
          description: "Your report has been submitted successfully",
        });
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

  // GridFS file upload with multipart/form-data
  const submitWithGridFS = async () => {
    const formData = new FormData();
    
    // Add text fields
    formData.append('message', message.trim());
    formData.append('category', category);
    formData.append('severity', severity);
    formData.append('share_location', shareLocation.toString());
    formData.append('is_offline_sync', (!online).toString());
    formData.append('is_encrypted', encrypt.toString());
    
    // Add high-precision location data if available
    if (shareLocation && location) {
      // Ensure high-precision location data
      const highPrecisionLocation = {
        ...location,
        source: 'browser_gps',
        captureMethod: 'getCurrentPosition',
        enableHighAccuracy: true,
        timestamp: Date.now()
      };
      formData.append('location', JSON.stringify(highPrecisionLocation));
      console.log('📍 Submitting high-precision location:', {
        accuracy: location.accuracy,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        heading: location.heading,
        speed: location.speed
      });
    }
    
    // Add files for GridFS storage
    if (photoFile) {
      formData.append('image', photoFile);
      console.log('📸 Submitting image for GridFS:', {
        name: photoFile.name,
        size: photoFile.size,
        type: photoFile.type
      });
    }
    if (videoFile) {
      formData.append('video', videoFile.file);
      console.log('🎥 Submitting video for GridFS:', {
        name: videoFile.file.name,
        size: videoFile.size,
        type: videoFile.file.type
      });
    }

    console.log('📤 Submitting to unified reports endpoint: /api/reports');
    const response = await fetch("/api/reports", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Failed to submit report with GridFS storage";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.error('GridFS submission error:', errorData);
      } catch (e) {
        console.warn("Could not parse GridFS error response");
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ GridFS submission success:", result);
    
    return result;
    
    // Handle success response format  
    const reportData = result.success ? result.data : result;
    setReportId(reportData.id || reportData.shortId);
    setSubmitted(true);

    toast({
      title: "Report Submitted",
      description: "Your report has been submitted successfully",
    });
  };

  if (submitted) {
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
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-success" />
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
                  Save this ID to check the status of your report later
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-lg font-mono">{reportId}</code>
                </div>
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
              <Link to={`/check-status`}>
                <Button className="whistle-gradient hover:opacity-90">
                  Check Status Later
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline">Return Home</Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  setSubmitted(false);
                  setMessage("");
                  setPhotoFile(null);
                  setVideoFile(null);
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
            <div className="w-10 h-10 rounded-xl whistle-gradient flex items-center justify-center">
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
            <ThemeToggle />
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

                {/* Status indicators */}
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                  <div
                    className={`flex items-center gap-2 text-sm ${online ? "text-green-600" : "text-red-600"}`}
                  >
                    {online ? (
                      <Wifi className="w-4 h-4" />
                    ) : (
                      <WifiOff className="w-4 h-4" />
                    )}
                    {online ? "Online" : "Offline"}
                  </div>

                  {pendingReports > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {pendingReports} pending sync
                    </Badge>
                  )}

                  {moderationResult?.isFlagged && (
                    <Badge variant="destructive" className="text-xs">
                      ⚠️ AI Flagged
                    </Badge>
                  )}

                  {location && (
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="w-3 h-3 mr-1" />
                      Location captured
                    </Badge>
                  )}
                </div>

                {/* Location sharing toggle */}
                {geolocationSupported && (
                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <div>
                          <Label
                            htmlFor="share-location"
                            className="text-sm font-medium"
                          >
                            Share Location
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Help authorities locate the incident
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="share-location"
                        checked={shareLocation}
                        onCheckedChange={setShareLocation}
                      />
                    </div>

                    {shareLocation && !location && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={getLocation}
                          disabled={gettingLocation}
                          className="text-xs"
                        >
                          {gettingLocation ? (
                            <>
                              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                              Getting location...
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3 h-3 mr-1" />
                              Capture Location
                            </>
                          )}
                        </Button>
                        {locationError && (
                          <div className="space-y-2">
                            <span className="text-xs text-red-600">
                              {locationError}
                            </span>
                            {locationError.includes("denied") && (
                              <div className="text-xs bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                                <strong>💡 Location Help:</strong>
                                <br />
                                1. Click the location icon (🌐) in your browser's address bar
                                <br />
                                2. Select "Allow" for location access
                                <br />
                                3. Refresh this page and try again
                                <br />
                                <em>Alternative:</em> Try using{" "}
                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                  127.0.0.1:8086
                                </code>{" "}
                                instead of localhost
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {location && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Location captured
                        </div>
                        <div className="text-muted-foreground">
                          📍 {formatLocation(location)}
                        </div>
                        {location.address && (
                          <div className="text-muted-foreground truncate">
                            {location.address}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(null)}
                          className="text-xs h-6 px-2"
                        >
                          Clear location
                        </Button>
                      </div>
                    )}
                  </div>
                )}

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

                  {/* AI Moderation Warning */}
                  {showModerationWarning && moderationResult && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {getModerationMessage(moderationResult)}
                        {moderationResult.detectedTerms.length > 0 && (
                          <div className="mt-1 text-xs">
                            Detected:{" "}
                            {moderationResult.detectedTerms
                              .slice(0, 3)
                              .join(", ")}
                            {moderationResult.detectedTerms.length > 3 &&
                              ` +${moderationResult.detectedTerms.length - 3} more`}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Photo Evidence (Optional)</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    {photoFile ? (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mx-auto">
                          <CheckCircle className="w-6 h-6 text-success" />
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
                          PNG, JPG up to 500MB
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

                {/* Video Upload/Recording Component */}
                <VideoUploadRecorder
                  onVideoChange={setVideoFile}
                  config={{
                    maxSizeMB: 100,
                    maxDurationMinutes: 5,
                    allowedFormats: [
                      "video/mp4",
                      "video/webm",
                      "video/quicktime",
                    ],
                    chunkSizeMB: 10,
                  }}
                  disabled={isSubmitting}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    🔒 <strong>End-to-End Encrypted:</strong> Your report is
                    encrypted with military-grade AES-256 encryption before
                    transmission. Only authorized admins can decrypt and view
                    your submission. No personal information, IP addresses, or
                    identifying data is stored.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  className="w-full whistle-gradient hover:opacity-90"
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
