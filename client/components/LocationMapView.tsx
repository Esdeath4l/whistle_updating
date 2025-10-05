/**
 * Location Map View Component
 * 
 * Displays a report location on an interactive map for better visualization
 * Shows the precise location with a marker and address details
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MapPin,
  ExternalLink,
  Navigation,
  Globe,
  Copy,
  Check,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LocationMapViewProps {
  latitude: number | string;
  longitude: number | string;
  address?: string;
  city?: string;
  country?: string;
  accuracy?: number;
}

const LocationMapView: React.FC<LocationMapViewProps> = ({
  latitude,
  longitude,
  address,
  city,
  country,
  accuracy
}) => {
  const [open, setOpen] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);

  // Format coordinates for display
  // Coerce coordinates to numbers safely
  const toNumber = (v: number | string) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : NaN;
  };

  const formatCoordinates = (lat: number | string, lng: number | string) => {
    const nlat = toNumber(lat);
    const nlng = toNumber(lng);
    if (Number.isNaN(nlat) || Number.isNaN(nlng)) return 'Location unavailable';
    return `${nlat.toFixed(6)}, ${nlng.toFixed(6)}`;
  };

  // Format location display
  const formatLocationDisplay = () => {
    if (address) return address;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    return formatCoordinates(latitude, longitude);
  };

  // Copy coordinates to clipboard
  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(formatCoordinates(latitude, longitude));
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    } catch (error) {
      console.error('Failed to copy coordinates:', error);
    }
  };

  // Open in external map services
  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps?q=${toNumber(latitude)},${toNumber(longitude)}`;
    window.open(url, '_blank');
  };

  const openInOpenStreetMap = () => {
    const url = `https://www.openstreetmap.org/?mlat=${toNumber(latitude)}&mlon=${toNumber(longitude)}&zoom=15`;
    window.open(url, '_blank');
  };

  // Initialize Leaflet map when modal is opened. We dynamically load Leaflet if not available
  const initializeLeaflet = async () => {
    const lat = toNumber(latitude);
    const lng = toNumber(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      console.warn('LocationMapView: invalid coordinates, skipping Leaflet init', { latitude, longitude });
      return;
    }

      try {
        // Try dynamic import first (works when leaflet is installed)
        // If types or package are not present in the build environment we fall back to CDN.
        // @ts-ignore - dynamic import of optional dependency may not have types installed in this workspace
        let L: any;
        try {
          // @ts-ignore
          L = (await import('leaflet')).default;
        } catch (e) {
        // Fallback: inject CDN script & css
        if (!document.querySelector('link[data-leaflet-css]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.setAttribute('data-leaflet-css', '1');
          document.head.appendChild(link);
        }
        if (!document.querySelector('script[data-leaflet-js]')) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            s.async = true;
            s.setAttribute('data-leaflet-js', '1');
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Leaflet from CDN'));
            document.body.appendChild(s);
          });
        }
        // @ts-ignore
        L = (window as any).L;
      }

      if (!L) {
        console.warn('Leaflet not available after dynamic load');
        return;
      }

      // Clean up existing map if present
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch (_) { /* ignore */ }
        leafletMapRef.current = null;
      }

      const container = mapContainerRef.current;
      if (!container) return;

      const map = L.map(container).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(formatLocationDisplay()).openPopup();

      leafletMapRef.current = map;
      console.log('✅ Leaflet map initialized for coordinates', { lat, lng });
    } catch (err) {
      console.error('❌ Leaflet initialization failed:', err);
    }
  };

  // Initialize Leaflet when the dialog is mounted/visible
  useEffect(() => {
    // no-op: keep effect to satisfy eslint about dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  // Initialize or refresh the map when the dialog opens
  useEffect(() => {
    if (!open) return;

    // If map already exists, invalidate size to ensure proper rendering
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.invalidateSize();
      } catch (err) {
        // ignore
      }
      return;
    }

    // Otherwise initialize
    (async () => {
      await initializeLeaflet();
      // Give browser a moment to layout, then ensure map sizes correctly
      setTimeout(() => {
        try {
          if (leafletMapRef.current && typeof leafletMapRef.current.invalidateSize === 'function') {
            leafletMapRef.current.invalidateSize();
          }
        } catch (err) {
          // ignore
        }
      }, 200);
    })();

    return () => {
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch (_) { }
        leafletMapRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(val) => setOpen(val)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          View on Map
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Report Location
          </DialogTitle>
          <DialogDescription>
            View the exact location where this report was submitted
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Location Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Address</label>
                  <p className="text-sm mt-1">{formatLocationDisplay()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Coordinates</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-mono">
                        {formatCoordinates(latitude, longitude)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyCoordinates}
                      className="h-6 w-6 p-0"
                    >
                      {copiedCoords ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                {accuracy && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Accuracy</label>
                    <p className="text-sm mt-1">±{Math.round(accuracy)}m</p>
                  </div>
                )}
                {city && country && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Region</label>
                    <p className="text-sm mt-1">{city}, {country}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Embedded Maps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* OpenStreetMap */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="h-5 w-5" />
                  OpenStreetMap
                </CardTitle>
              </CardHeader>
              <CardContent>
                      <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden" ref={mapContainerRef} />
                <Button
                  variant="outline"
                  onClick={openInOpenStreetMap}
                  className="w-full mt-3 flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in OpenStreetMap
                </Button>
              </CardContent>
            </Card>

            {/* Google Maps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Google Maps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  {/* Use Google Maps URL for direct embedding */}
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0 }}
                    src={`https://maps.google.com/maps?q=${toNumber(latitude)},${toNumber(longitude)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    allowFullScreen
                    title="Google Maps Location"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={openInGoogleMaps}
                  className="w-full mt-3 flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Google Maps
                </Button>
              </CardContent>
            </Card>
          </div>

          <Alert className="mt-3">
            <Globe className="h-4 w-4" />
            <AlertDescription>
              Both maps show the exact location where the report was submitted. 
              Use the buttons to open in external applications for navigation and street view.
            </AlertDescription>
          </Alert>

          {/* Additional Map Services */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Other Map Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://www.bing.com/maps?q=${latitude},${longitude}`, '_blank')}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Bing Maps
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://maps.apple.com/?q=${latitude},${longitude}`, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Apple Maps
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Additional map services for cross-platform navigation and different map styles.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationMapView;