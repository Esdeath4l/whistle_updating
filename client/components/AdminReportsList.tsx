import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye,
  Image as ImageIcon,
  Video,
  Download,
  RefreshCw,
  AlertCircle,
  MapPin,
  Lock
} from 'lucide-react';
import LocationMapView from './LocationMapView';

interface Report {
  id: string;
  shortId: string;
  message: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'escalated' | 'reviewed' | 'flagged';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
    city?: string;
    country?: string;
    source?: string;
  };
  // GridFS media fields
  imageFileIds?: string[];
  videoFileIds?: string[];
  photo_file_id?: string;
  video_file_id?: string;
  additional_media?: string[];
  // Enhanced media from API
  media?: {
    images: Array<{
      id: string;
      filename: string;
      contentType: string;
      size: number;
      base64Data?: string;
      url: string;
      displayName: string;
      uploadDate: string;
      isEncrypted: boolean;
      error?: string;
    }>;
    videos: Array<{
      id: string;
      filename: string;
      contentType: string;
      size: number;
      base64Data?: string;
      url: string;
      displayName: string;
      uploadDate: string;
      duration?: number;
      isEncrypted: boolean;
      error?: string;
    }>;
    totalCount: number;
    hasMedia: boolean;
  };
}

interface AdminReportsListProps {
  reports: Report[];
  onUpdateReport?: (reportId: string, updates: Partial<Report>) => void;
  onRefresh?: () => void;
}

const AdminReportsList: React.FC<AdminReportsListProps> = ({ 
  reports, 
  onUpdateReport, 
  onRefresh 
}) => {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'in-progress': return 'bg-blue-500';
      case 'resolved': return 'bg-green-500';
      case 'escalated': return 'bg-red-500';
      case 'reviewed': return 'bg-purple-500';
      case 'flagged': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderConfidentialityBadge = (score?: number) => {
    if (typeof score !== 'number' || Number.isNaN(score)) return null;
    const rounded = Math.round(score);
    if (rounded < 40) {
      return <Badge title={`Confidentiality score: ${rounded}%`} className="text-xs bg-emerald-100 text-emerald-800">{rounded}%</Badge>;
    } else if (rounded < 70) {
      return <Badge title={`Confidentiality score: ${rounded}%`} className="text-xs bg-orange-100 text-orange-800">{rounded}%</Badge>;
    } else {
      return <Badge title={`Confidentiality score: ${rounded}%`} className="text-xs bg-red-100 text-red-800">{rounded}%</Badge>;
    }
  };

  const fetchReportDetails = async (reportId: string) => {
    setIsLoading(true);
    try {
      console.log(`📊 Fetching report details for: ${reportId}`);
      
      // Try the enhanced endpoint first
      // Prefer sessionStorage where Admin page stores token
      const token = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
      let response = await fetch(`/api/admin/reports/enhanced-media/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // If enhanced endpoint doesn't exist, fall back to regular endpoint
      if (!response.ok && response.status === 404) {
        console.log(`⚠️ Enhanced endpoint not found, trying regular endpoint`);
        response = await fetch(`/api/admin/reports/${reportId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
        });
      }

      if (response.ok) {
        const result = await response.json();
        console.log('📊 Report details response:', result);
        
        if (result.success && result.report) {
          setSelectedReport(result.report);
        } else if (result.data) {
          // Handle different response formats
          setSelectedReport(result.data);
        } else {
          console.error('❌ Invalid response format:', result);
          alert('Failed to load report details: Invalid response format');
        }
      } else {
        console.error('❌ HTTP error loading report:', response.status);
        alert(`Failed to load report details: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Network error loading report:', error);
      alert('Failed to load report details: Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMediaSection = (media: Report['media']) => {
    if (!media || !media.hasMedia) {
      return (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p>No media files attached to this report</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Images Section */}
        {media.images && media.images.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Images ({media.images.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {media.images.map((image, index) => (
                <Card key={image.id || index} className="overflow-hidden">
                  <CardContent className="p-0">
                    {image.base64Data ? (
                      <img
                        src={image.base64Data}
                        alt={image.displayName}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          console.error('❌ Image load error:', e);
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <div className="text-center">
                          <ImageIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Loading...</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => window.open(image.url, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-medium text-sm truncate">{image.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(image.size)}</p>
                      {image.isEncrypted && (
                        <Badge variant="secondary" className="mt-1">
                          <Lock className="h-3 w-3 mr-1" />
                          Encrypted
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Videos Section */}
        {media.videos && media.videos.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Video className="h-5 w-5" />
              Videos ({media.videos.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {media.videos.map((video, index) => (
                <Card key={video.id || index} className="overflow-hidden">
                  <CardContent className="p-0">
                    {video.base64Data ? (
                      <video
                        src={video.base64Data}
                        controls
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          console.error('❌ Video load error:', e);
                        }}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <div className="text-center">
                          <Video className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Loading video...</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => window.open(video.url, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-medium text-sm truncate">{video.filename}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(video.size)}
                        {video.duration && ` • ${Math.round(video.duration)}s`}
                      </p>
                      {video.isEncrypted && (
                        <Badge variant="secondary" className="mt-1">
                          <Lock className="h-3 w-3 mr-1" />
                          Encrypted
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

    const renderAIClassification = (report: any) => {
    const ai = report.ai_classification || report.moderation || null;
    if (!ai) return null;
    const primary = ai.primaryLabel || (ai.labels && ai.labels[0]) || null;
    const confidence = typeof ai.confidence === 'number' ? Math.round(ai.confidence * 100) : null;
    return (
      <div className="mt-2 text-sm text-gray-600">
        {primary && <span className="inline-block mr-2 px-2 py-0.5 rounded bg-gray-100">AI: {primary}</span>}
        {confidence !== null && <span className="text-xs text-gray-500">Confidence: {confidence}%</span>}
      </div>
    );
  };

    const renderAIHistory = (report: any) => {
      const history = report.ai_history || report.aiHistory || [];
      if (!Array.isArray(history) || history.length === 0) return null;
      return (
        <div className="mt-3">
          <h4 className="font-semibold">AI Classification History</h4>
          <div className="mt-2 space-y-2 text-sm text-gray-600">
            {history.map((h: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{h.label || h.primaryLabel || 'label'}</div>
                  <div className="text-xs text-gray-500">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
                </div>
                <div className="text-sm">
                  {typeof h.score === 'number' ? Math.round(h.score) + '%' : ''}
                  {h.flagged ? <span className="ml-2 text-red-600">⚑</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reports Dashboard</h2>
        <Button 
          onClick={onRefresh} 
          variant="outline"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Reports List */}
      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                  <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>Report #{report.shortId}</span>
                    {report && (report as any).ai_classification && (report as any).ai_classification.flagged && (
                      <span className="text-red-600 font-bold text-sm">⚑</span>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    <div>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                      {renderAIClassification(report)}
                    </div>
                    <Badge variant="outline" className={getPriorityColor(report.priority || (report as any).severity || 'medium')}>
                      {report.priority || (report as any).severity || 'medium'}
                    </Badge>
                    {/* Confidentiality score badge (if available) */}
                    {(report as any).confidentialityScore !== undefined && (
                      <span className="ml-2">{renderConfidentialityBadge((report as any).confidentialityScore)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fetchReportDetails(report.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                      <DialogHeader>
                        <div className="flex items-center justify-between">
                          <DialogTitle>Report #{selectedReport?.shortId}</DialogTitle>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!selectedReport) return;
                                try {
                                  const adminToken = localStorage.getItem('adminToken');
                                  const res = await fetch(`/api/admin/reports/${selectedReport.id}/reclassify`, {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${adminToken}`,
                                      'Content-Type': 'application/json'
                                    }
                                  });
                                  if (res.ok) {
                                    const json = await res.json();
                                    console.log('🔁 Reclassification result:', json);
                                    // Refresh details
                                    await fetchReportDetails(selectedReport.id);
                                  } else {
                                    console.error('❌ Reclassify failed:', res.status);
                                    alert('Failed to reclassify report');
                                  }
                                } catch (err) {
                                  console.error('❌ Reclassify error:', err);
                                  alert('Reclassification request failed');
                                }
                              }}
                            >
                              Reclassify
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                if (!selectedReport) return;
                                if (!confirm('Unflag this report?')) return;
                                try {
                                  const adminToken = localStorage.getItem('adminToken');
                                  const res = await fetch(`/api/admin/reports/${selectedReport.id}/unflag`, {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${adminToken}`,
                                      'Content-Type': 'application/json'
                                    }
                                  });
                                  if (res.ok) {
                                    const json = await res.json();
                                    console.log('⚑ Unflag result:', json);
                                    await fetchReportDetails(selectedReport.id);
                                    // Also refresh list
                                    if (onUpdateReport) onUpdateReport(selectedReport.id, { status: 'in-progress' } as any);
                                  } else {
                                    alert('Failed to unflag report');
                                  }
                                } catch (err) {
                                  console.error('❌ Unflag error:', err);
                                  alert('Unflag request failed');
                                }
                              }}
                            >
                              Unflag
                            </Button>
                          </div>
                        </div>
                      </DialogHeader>
                      <ScrollArea className="max-h-[calc(90vh-120px)]">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-8 w-8 animate-spin" />
                            <span className="ml-2">Loading report details...</span>
                          </div>
                        ) : selectedReport ? (
                          <div className="space-y-6">
                            {/* Report Info */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="font-medium">Status</p>
                                  <Badge className={getStatusColor(selectedReport.status)}>
                                    {selectedReport.status}
                                  </Badge>
                              </div>
                              <div>
                                <p className="font-medium">Priority</p>
                                  <Badge className={getPriorityColor(selectedReport.priority || (selectedReport as any).severity || 'medium')}>
                                    {selectedReport.priority || (selectedReport as any).severity || 'medium'}
                                  </Badge>
                              </div>
                              {/* Confidentiality score shown in details if present */}
                              {(selectedReport as any)?.confidentialityScore !== undefined && (
                                <div className="col-span-2">
                                  <p className="font-medium">Confidentiality Score</p>
                                  <div className="mt-1">{renderConfidentialityBadge((selectedReport as any).confidentialityScore)}</div>
                                </div>
                              )}
                              {/* AI history */}
                              {renderAIHistory(selectedReport)}
                            </div>

                            {/* Message */}
                            <div>
                              <h3 className="font-semibold mb-2">Message</h3>
                              <p className="text-gray-700 whitespace-pre-wrap">{selectedReport.message}</p>
                            </div>

                            {/* Location */}
                            {selectedReport.location && (
                              <div>
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  Location
                                </h3>
                                <div className="space-y-3">
                                  <div className="text-gray-700">
                                    <p>
                                      {(() => {
                                        const lat = Number((selectedReport.location as any).lat);
                                        const lng = Number((selectedReport.location as any).lng);
                                        const acc = selectedReport.location.accuracy !== undefined ? Number(selectedReport.location.accuracy) : undefined;
                                        const latStr = Number.isFinite(lat) ? lat.toFixed(6) : 'n/a';
                                        const lngStr = Number.isFinite(lng) ? lng.toFixed(6) : 'n/a';
                                        return `Coordinates: ${latStr}, ${lngStr}` + (acc && Number.isFinite(acc) ? ` (±${Math.round(acc)}m)` : '');
                                      })()}
                                    </p>
                                    {selectedReport.location.city && (
                                      <p>
                                        Location: {selectedReport.location.city}, {selectedReport.location.country}
                                      </p>
                                    )}
                                  </div>
                                  <LocationMapView
                                    latitude={Number((selectedReport.location as any).lat)}
                                    longitude={Number((selectedReport.location as any).lng)}
                                    city={selectedReport.location.city}
                                    country={selectedReport.location.country}
                                    accuracy={selectedReport.location.accuracy !== undefined ? Number(selectedReport.location.accuracy) : undefined}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Media Files */}
                            <div>
                              <h3 className="font-semibold mb-4">Attached Media</h3>
                              {renderMediaSection(selectedReport.media)}
                            </div>

                            {/* Timestamps */}
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <p className="font-medium">Created</p>
                                <p>{new Date(selectedReport.created_at).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="font-medium">Updated</p>
                                <p>{new Date(selectedReport.updated_at).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 text-sm line-clamp-2 mb-3">{report.message}</p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                  {report.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Location Available
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {report.media?.hasMedia && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <ImageIcon className="h-4 w-4" />
                      <Video className="h-4 w-4" />
                      Media
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No reports found</p>
        </div>
      )}
    </div>
  );
};

export default AdminReportsList;