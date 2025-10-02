import React, { useState, useEffect } from 'react';
import { MapPin, Eye, AlertCircle, Calendar, MessageSquare, Clock, CheckCircle, Image as ImageIcon, Video, Navigation, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Report } from '@shared/api';

interface ReportsMapProps {
  reports: Report[];
  authToken: string;
}

interface ReportModalData extends Report {
  _id?: string;
  admin_notes?: string;
  resolved_at?: string;
  updated_at?: string;
  // Enhanced properties for comprehensive media and location display
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  mediaFiles?: {
    images: Array<{
      id: string;
      type: 'image';
      url: string;
      filename: string;
      displayName: string;
    }>;
    videos: Array<{
      id: string;
      type: 'video';
      url: string;
      filename: string;
      displayName: string;
    }>;
    hasMedia: boolean;
  };
  files?: {
    photo?: {
      id: string;
      filename: string;
      url: string;
    };
    video?: {
      id: string;
      filename: string;
      url: string;
    };
  };
}

/**
 * Interactive map component showing report locations with clickable pins
 * Displays shortId on pins and opens modal with decrypted report details
 */
const ReportsMap: React.FC<ReportsMapProps> = ({ reports, authToken }) => {
  const [selectedReport, setSelectedReport] = useState<ReportModalData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter reports that have location data
  const reportsWithLocation = reports.filter(report => 
    report.location && 
    report.location.latitude && 
    report.location.longitude
  );

  /**
   * Enhanced fetch for detailed report data with comprehensive media support
   * Includes decrypted content, precise coordinates, and all associated media files
   */
  const fetchReportDetails = async (shortId: string) => {
    if (!authToken) {
      console.error("No auth token available for fetching report details");
      return;
    }

    setLoading(true);
    try {
      console.log(`🗺️ Fetching comprehensive report details for map modal: ${shortId}`);
      
      const response = await fetch(`/api/admin/reports/${shortId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.report) {
          // Enhance the report data with additional media information
          const enhancedReport = {
            ...result.report,
            // Extract precise coordinates
            coordinates: {
              latitude: result.report.location?.latitude || result.report.location?.lat,
              longitude: result.report.location?.longitude || result.report.location?.lng,
              accuracy: result.report.location?.accuracy,
              address: result.report.location?.address
            },
            // Organize media files for display
            mediaFiles: {
              images: [],
              videos: [],
              hasMedia: false
            }
          };

          // Process image files
          if (result.report.photo_file_id || result.report.imageFileIds) {
            const imageIds = result.report.imageFileIds || [result.report.photo_file_id].filter(Boolean);
            enhancedReport.mediaFiles.images = imageIds.map((id: string, index: number) => ({
              id,
              type: 'image',
              url: `/api/reports/file/${id}`,
              filename: `Image ${index + 1}`,
              displayName: `Photo ${index + 1}`
            }));
          }

          // Process video files
          if (result.report.video_file_id || result.report.videoFileIds) {
            const videoIds = result.report.videoFileIds || [result.report.video_file_id].filter(Boolean);
            enhancedReport.mediaFiles.videos = videoIds.map((id: string, index: number) => ({
              id,
              type: 'video',
              url: `/api/reports/file/${id}`,
              filename: `Video ${index + 1}`,
              displayName: `Video ${index + 1}`
            }));
          }

          enhancedReport.mediaFiles.hasMedia = 
            enhancedReport.mediaFiles.images.length > 0 || 
            enhancedReport.mediaFiles.videos.length > 0;

          setSelectedReport(enhancedReport);
          setModalOpen(true);
          console.log(`✅ Enhanced report details loaded for modal: ${shortId}`, {
            coordinates: enhancedReport.coordinates,
            mediaCount: {
              images: enhancedReport.mediaFiles.images.length,
              videos: enhancedReport.mediaFiles.videos.length
            }
          });
        } else {
          console.error("Failed to load report details:", result.error);
        }
      } else {
        console.error("Failed to fetch report details:", response.status);
      }
    } catch (error) {
      console.error("Error fetching comprehensive report details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, text: "Pending", icon: Clock },
      reviewed: { variant: "default" as const, text: "Reviewed", icon: Eye },
      flagged: { variant: "destructive" as const, text: "Flagged", icon: AlertCircle },
      resolved: { variant: "outline" as const, text: "Resolved", icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'urgent': return 'bg-red-500 hover:bg-red-600';
      case 'high': return 'bg-orange-500 hover:bg-orange-600';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'low': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-blue-500 hover:bg-blue-600';
    }
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

  const formatLocation = (location: any) => {
    if (!location) return 'Location not available';
    
    if (location.address) {
      return location.address;
    }
    
    return `${location.latitude?.toFixed(6) || 0}, ${location.longitude?.toFixed(6) || 0}`;
  };

  return (
    <div className="space-y-4">
      {/* Map Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          Reports Map ({reportsWithLocation.length} located)
        </h3>
      </div>

      {reportsWithLocation.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No reports with location data found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Simple visual map representation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Geographic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportsWithLocation.map((report, index) => (
                  <div
                    key={report.shortId || report.id}
                    className={`p-4 rounded-lg text-white cursor-pointer transition-colors ${getSeverityColor(report.severity)}`}
                    onClick={() => fetchReportDetails(report.shortId)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">
                        ID: {report.shortId}
                      </span>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="text-xs opacity-90">
                      {formatLocation(report.location)}
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      {report.severity?.toUpperCase()} • {report.category}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Report Details Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Report Details - {selectedReport?.shortId}
                </DialogTitle>
                <DialogDescription>
                  Detailed information for this report location
                </DialogDescription>
              </DialogHeader>

              {selectedReport && (
                <div className="space-y-6">
                  {/* Status and Metadata */}
                  <div className="flex flex-wrap gap-2">
                    {getStatusBadge(selectedReport.status)}
                    <Badge variant="outline">
                      {selectedReport.severity?.toUpperCase() || 'MEDIUM'}
                    </Badge>
                    <Badge variant="secondary">
                      {selectedReport.category || 'General'}
                    </Badge>
                  </div>

                  {/* Report Content */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Report Message
                      </h4>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedReport.message}
                        </p>
                        {selectedReport.is_encrypted && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            🔓 Content decrypted for admin view
                          </p>
                        )}
                      </div>
                    </div>

                  {/* Enhanced Location Details with Precise Coordinates and Navigation */}
                  {selectedReport.coordinates && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        Precise Location Information
                      </h4>
                      <div className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Latitude:</span> 
                            <span className="ml-2 font-mono">{selectedReport.coordinates.latitude?.toFixed(6)}</span>
                          </div>
                          <div>
                            <span className="font-medium">Longitude:</span> 
                            <span className="ml-2 font-mono">{selectedReport.coordinates.longitude?.toFixed(6)}</span>
                          </div>
                          {selectedReport.coordinates.accuracy && (
                            <div className="col-span-2">
                              <span className="font-medium">GPS Accuracy:</span> 
                              <span className="ml-2">±{selectedReport.coordinates.accuracy}m</span>
                            </div>
                          )}
                          {selectedReport.coordinates.address && (
                            <div className="col-span-2">
                              <span className="font-medium">Address:</span> 
                              <span className="ml-2">{selectedReport.coordinates.address}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Navigation Buttons */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const lat = selectedReport.coordinates?.latitude;
                              const lng = selectedReport.coordinates?.longitude;
                              if (lat && lng) {
                                // Google Maps navigation
                                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                window.open(googleMapsUrl, '_blank');
                              }
                            }}
                            className="flex items-center"
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            Navigate (Google Maps)
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const lat = selectedReport.coordinates?.latitude;
                              const lng = selectedReport.coordinates?.longitude;
                              if (lat && lng) {
                                // Apple Maps navigation (works on iOS devices)
                                const appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}`;
                                window.open(appleMapsUrl, '_blank');
                              }
                            }}
                            className="flex items-center"
                          >
                            <MapPin className="w-3 h-3 mr-1" />
                            Apple Maps
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const lat = selectedReport.coordinates?.latitude;
                              const lng = selectedReport.coordinates?.longitude;
                              if (lat && lng) {
                                // OpenStreetMap
                                const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
                                window.open(osmUrl, '_blank');
                              }
                            }}
                            className="flex items-center"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            OpenStreetMap
                          </Button>
                          
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const lat = selectedReport.coordinates?.latitude;
                              const lng = selectedReport.coordinates?.longitude;
                              if (lat && lng) {
                                // Copy coordinates to clipboard
                                navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => {
                                  alert('Coordinates copied to clipboard!');
                                }).catch(() => {
                                  // Fallback for older browsers
                                  const textArea = document.createElement('textarea');
                                  textArea.value = `${lat}, ${lng}`;
                                  document.body.appendChild(textArea);
                                  textArea.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(textArea);
                                  alert('Coordinates copied to clipboard!');
                                });
                              }
                            }}
                            className="flex items-center"
                          >
                            📋 Copy Coordinates
                          </Button>
                        </div>
                        
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border">
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            📍 <strong>Map Coordinates:</strong> These precise coordinates are where the report was submitted from.
                            Click navigation buttons to get directions to this location.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Media Files Display */}
                  {selectedReport.mediaFiles?.hasMedia && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Attached Media Files
                      </h4>
                      <div className="space-y-4">
                        
                        {/* Images Section */}
                        {selectedReport.mediaFiles.images.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-2 text-muted-foreground">
                              📷 Images ({selectedReport.mediaFiles.images.length})
                            </h5>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {selectedReport.mediaFiles.images.map((image: any, index: number) => (
                                <div key={image.id} className="space-y-2">
                                  <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                                    <img
                                      src={image.url}
                                      alt={image.displayName}
                                      className="w-full h-full object-cover cursor-pointer hover:opacity-75 transition-opacity"
                                      onClick={() => window.open(image.url, '_blank')}
                                    />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">{image.displayName}</p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(image.url, '_blank')}
                                      className="mt-1 h-6 text-xs"
                                    >
                                      View Full Size
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Videos Section */}
                        {selectedReport.mediaFiles.videos.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-2 text-muted-foreground">
                              🎥 Videos ({selectedReport.mediaFiles.videos.length})
                            </h5>
                            <div className="space-y-3">
                              {selectedReport.mediaFiles.videos.map((video: any, index: number) => (
                                <div key={video.id} className="border rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm">{video.displayName}</span>
                                    <Badge variant="outline" className="text-xs">
                                      Video File
                                    </Badge>
                                  </div>
                                  <video
                                    controls
                                    className="w-full max-h-60 rounded bg-black"
                                    preload="metadata"
                                  >
                                    <source src={video.url} />
                                    Your browser does not support video playback.
                                  </video>
                                  <div className="mt-2 flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(video.url, '_blank')}
                                      className="text-xs"
                                    >
                                      Open in New Tab
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border">
                          <p className="text-xs text-green-700 dark:text-green-300">
                            📎 <strong>Media Files:</strong> All images and videos uploaded with this report are displayed above. Click to view full size or open in new tabs.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Legacy Location Fallback */}
                  {!selectedReport.coordinates && selectedReport.location && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          Location Information
                        </h4>
                        <div className="p-3 bg-muted rounded-lg space-y-2">
                          <p className="text-sm">
                            <strong>Address:</strong> {formatLocation(selectedReport.location)}
                          </p>
                          <p className="text-sm">
                            <strong>Coordinates:</strong>{' '}
                            {selectedReport.location.latitude?.toFixed(6)},{' '}
                            {selectedReport.location.longitude?.toFixed(6)}
                          </p>
                          {selectedReport.location.accuracy && (
                            <p className="text-sm">
                              <strong>Accuracy:</strong> ±{selectedReport.location.accuracy}m
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Media Files */}
                    {selectedReport.files && (
                      <div>
                        <h4 className="font-semibold mb-2">Attached Media</h4>
                        <div className="space-y-2">
                          {selectedReport.files.photo && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm font-medium">📷 Photo Evidence</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedReport.files.photo.filename}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => window.open(selectedReport.files?.photo?.url, '_blank')}
                              >
                                View Photo
                              </Button>
                            </div>
                          )}
                          {selectedReport.files.video && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm font-medium">🎥 Video Evidence</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedReport.files.video.filename}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => window.open(selectedReport.files?.video?.url, '_blank')}
                              >
                                View Video
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Timeline
                      </h4>
                      <div className="p-3 bg-muted rounded-lg space-y-1">
                        <p className="text-sm">
                          <strong>Submitted:</strong> {formatDate(selectedReport.created_at)}
                        </p>
                        <p className="text-sm">
                          <strong>Last Updated:</strong> {formatDate(selectedReport.updated_at)}
                        </p>
                        {selectedReport.resolved_at && (
                          <p className="text-sm">
                            <strong>Resolved:</strong> {formatDate(selectedReport.resolved_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Admin Notes */}
                    {selectedReport.admin_notes && (
                      <div>
                        <h4 className="font-semibold mb-2">Admin Notes</h4>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm">{selectedReport.admin_notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loading && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Loading report details...</p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default ReportsMap;