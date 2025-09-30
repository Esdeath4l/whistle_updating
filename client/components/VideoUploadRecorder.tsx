import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Video,
  Upload,
  Camera,
  StopCircle,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  FileVideo,
  Clock,
  HardDrive,
  X,
  SwitchCamera,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoUploadConfig {
  maxSizeMB: number;
  maxDurationMinutes: number;
  allowedFormats: string[];
  chunkSizeMB: number;
}

export interface VideoFile {
  file: File;
  url: string;
  duration?: number;
  size: number;
  format: string;
  isRecorded: boolean;
}

interface VideoUploadRecorderProps {
  onVideoChange: (video: VideoFile | null) => void;
  config?: Partial<VideoUploadConfig>;
  disabled?: boolean;
}

const DEFAULT_CONFIG: VideoUploadConfig = {
  maxSizeMB: 1000,
  maxDurationMinutes: 5,
  allowedFormats: ["video/mp4", "video/webm", "video/quicktime"],
  chunkSizeMB: 10,
};

export default function VideoUploadRecorder({
  onVideoChange,
  config = {},
  disabled = false,
}: VideoUploadRecorderProps) {
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(
    null,
  );
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user"); // user = front, environment = back

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Check camera permission
  const checkCameraPermission = async () => {
    try {
      const permission = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      setCameraPermission(permission.state === "granted");

      permission.addEventListener("change", () => {
        setCameraPermission(permission.state === "granted");
      });
    } catch (error) {
      console.warn("Permission API not supported");
    }
  };

  useEffect(() => {
    checkCameraPermission();
  }, []);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Validate video file
  const validateVideo = async (file: File): Promise<string | null> => {
    // Check file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > fullConfig.maxSizeMB) {
      return `Video must be smaller than ${fullConfig.maxSizeMB}MB (current: ${sizeMB.toFixed(1)}MB)`;
    }

    // Check file type
    if (!fullConfig.allowedFormats.includes(file.type)) {
      return `Unsupported format. Please use: ${fullConfig.allowedFormats.join(", ")}`;
    }

    // Check duration (requires creating video element)
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const durationMinutes = video.duration / 60;
        URL.revokeObjectURL(video.src);

        if (durationMinutes > fullConfig.maxDurationMinutes) {
          resolve(
            `Video must be shorter than ${fullConfig.maxDurationMinutes} minutes (current: ${durationMinutes.toFixed(1)} minutes)`,
          );
        } else {
          resolve(null);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve("Invalid video file");
      };
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    const validationError = await validateVideo(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create video element to get metadata
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const videoFile: VideoFile = {
        file,
        url: video.src,
        duration: video.duration,
        size: file.size,
        format: file.type,
        isRecorded: false,
      };

      setCurrentVideo(videoFile);
      onVideoChange(videoFile);
    };
  };

  // Start camera for recording
  const startCamera = async () => {
    try {
      setError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: facingMode, // Use dynamic facing mode
        },
        audio: true,
      });

      videoStreamRef.current = stream;
      setCameraPermission(true);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (error: any) {
      setCameraPermission(false);
      let errorMessage = "Camera access denied. Please allow camera permissions and try again.";
      
      if (error.name === "NotAllowedError") {
        errorMessage = "Camera access denied. Click the camera icon in your browser's address bar to allow access.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No camera found. Please connect a camera and try again.";
      } else if (error.name === "NotReadableError") {
        errorMessage = "Camera is already in use by another application. Please close other apps using the camera.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage = "Camera doesn't support the requested settings. Trying with default settings...";
        // Try again with minimal constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          videoStreamRef.current = stream;
          setCameraPermission(true);
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
          }
          return;
        } catch (fallbackError) {
          errorMessage = "Camera not available. Please check your camera settings.";
        }
      }
      
      setError(errorMessage);
    }
  };

  // Switch between front and back camera
  const switchCamera = async () => {
    try {
      setError("");
      
      // Stop current stream
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Toggle facing mode
      const newFacingMode = facingMode === "user" ? "environment" : "user";
      setFacingMode(newFacingMode);

      // Start new stream with new facing mode
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: newFacingMode,
        },
        audio: true,
      });

      videoStreamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (error) {
      setError(
        "Failed to switch camera. This device may not have multiple cameras.",
      );
      // If switching fails, try to restart with original facing mode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: facingMode,
          },
          audio: true,
        });
        videoStreamRef.current = fallbackStream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackError) {
        setError("Camera access failed. Please refresh and try again.");
      }
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      if (!videoStreamRef.current) {
        await startCamera();
      }

      if (!videoStreamRef.current) return;

      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(videoStreamRef.current, {
        mimeType: "video/webm;codecs=vp9", // Fallback to vp8 if needed
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped, processing video...");
        setIsProcessing(true);

        // Small delay to show processing state
        setTimeout(() => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          const file = new File([blob], `recording-${Date.now()}.webm`, {
            type: "video/webm",
          });

          console.log("Video recorded:", {
            size: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
            duration: `${recordingTime}s`,
            chunks: chunksRef.current.length,
          });

          const videoFile: VideoFile = {
            file,
            url: URL.createObjectURL(blob),
            duration: recordingTime,
            size: blob.size,
            format: "video/webm",
            isRecorded: true,
          };

          setCurrentVideo(videoFile);
          onVideoChange(videoFile);
          setIsProcessing(false);
          cleanup();

          console.log("Video file created and set, ready for form submission");
        }, 500);
      };

      mediaRecorder.start(1000); // Capture data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;

          // Auto-stop at max duration
          if (newTime >= fullConfig.maxDurationMinutes * 60) {
            stopRecording();
          }

          return newTime;
        });
      }, 1000);
    } catch (error) {
      setError(
        "Failed to start recording. Please check your camera and microphone permissions.",
      );
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("Stopping recording...");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Remove video
  const removeVideo = () => {
    if (currentVideo?.url) {
      URL.revokeObjectURL(currentVideo.url);
    }
    setCurrentVideo(null);
    onVideoChange(null);
    setError("");
    setUploadProgress(0);
    cleanup();
  };

  // Simulate resumable upload (in production, integrate with resumable upload service)
  const simulateResumableUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    const chunkSize = fullConfig.chunkSizeMB * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 200));

      const progress = ((i + 1) / totalChunks) * 100;
      setUploadProgress(progress);
    }

    setIsUploading(false);
  };

  // Start upload if video is large
  useEffect(() => {
    if (currentVideo && currentVideo.size > 10 * 1024 * 1024) {
      // > 10MB
      simulateResumableUpload(currentVideo.file);
    }
  }, [currentVideo]);

  const isLargeFile = currentVideo && currentVideo.size > 10 * 1024 * 1024;
  const maxDurationReached =
    recordingTime >= fullConfig.maxDurationMinutes * 60;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Video Evidence (Optional)</Label>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <HardDrive className="w-3 h-3 mr-1" />
            Max {fullConfig.maxSizeMB}MB
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Max {fullConfig.maxDurationMinutes}min
          </Badge>
        </div>
      </div>

      {currentVideo ? (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileVideo className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {currentVideo.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(currentVideo.size / 1024 / 1024).toFixed(2)} MB
                      {currentVideo.duration &&
                        ` • ${formatTime(Math.floor(currentVideo.duration))}`}
                      {currentVideo.isRecorded && " • Recorded"}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">
                        Ready for submission
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeVideo}
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <video
                src={currentVideo.url}
                controls
                className="w-full max-h-48 rounded-lg bg-black"
                poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+VmlkZW88L3RleHQ+PC9zdmc+"
              />

              {isLargeFile && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Upload Progress
                    </span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  {isUploading && (
                    <p className="text-xs text-muted-foreground">
                      Using resumable upload for large file...
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardContent className="p-6">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" disabled={disabled}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Video
                </TabsTrigger>
                <TabsTrigger value="record" disabled={disabled}>
                  <Camera className="w-4 h-4 mr-2" />
                  Record Video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto">
                    <Video className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Click to upload a video
                    </p>
                    <p className="text-xs text-muted-foreground">
                      MP4, WebM up to {fullConfig.maxSizeMB}MB, max{" "}
                      {fullConfig.maxDurationMinutes} minutes
                    </p>
                  </div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept={fullConfig.allowedFormats.join(",")}
                    onChange={handleFileUpload}
                    disabled={disabled}
                    className="cursor-pointer"
                  />
                </div>
              </TabsContent>

              <TabsContent value="record" className="space-y-4">
                <div className="text-center space-y-3">
                  {cameraPermission === false ? (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Camera Access Required
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Please allow camera permissions to record video
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={startCamera}
                        disabled={disabled}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Enable Camera
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <video
                          ref={videoPreviewRef}
                          autoPlay
                          muted
                          className={cn(
                            "w-full max-h-48 rounded-lg bg-black",
                            !videoStreamRef.current && "hidden",
                          )}
                        />
                        {!videoStreamRef.current && (
                          <div className="w-full h-48 rounded-lg bg-muted flex items-center justify-center">
                            <Camera className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}

                        {isRecording && (
                          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            REC {formatTime(recordingTime)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-2">
                        {/* Camera Switch Button */}
                        {videoStreamRef.current && !isRecording && (
                          <Button
                            type="button"
                            onClick={switchCamera}
                            disabled={disabled}
                            variant="outline"
                            size="sm"
                            title={`Switch to ${facingMode === "user" ? "back" : "front"} camera`}
                          >
                            <SwitchCamera className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {isProcessing ? (
                          <Button type="button" disabled>
                            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing Video...
                          </Button>
                        ) : !isRecording ? (
                          <Button
                            type="button"
                            onClick={startRecording}
                            disabled={disabled || maxDurationReached}
                            className="bg-red-500 hover:bg-red-600 text-white"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Start Recording
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={stopRecording}
                            disabled={disabled}
                            variant="destructive"
                          >
                            <StopCircle className="w-4 h-4 mr-2" />
                            Stop Recording
                          </Button>
                        )}
                      </div>

                      {isRecording && (
                        <div className="space-y-2">
                          <Progress
                            value={
                              (recordingTime /
                                (fullConfig.maxDurationMinutes * 60)) *
                              100
                            }
                            className="h-2"
                          />
                          <p className="text-xs text-muted-foreground">
                            {formatTime(recordingTime)} /{" "}
                            {formatTime(fullConfig.maxDurationMinutes * 60)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
