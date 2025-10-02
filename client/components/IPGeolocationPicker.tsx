/**
 * IPGeolocation Location Picker Component
 * 
 * Replaces Google Maps with IPGeolocation.io API for location tracking
 * Provides precise IP-based geolocation without requiring GPS permissions
 * 
 * Features:
 * - Automatic IP-based location detection
 * - Manual GPS location as fallback option
 * - Error handling and graceful fallbacks
 * - Integration with existing report schema
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  Globe,
  Wifi,
  CheckCircle,
  AlertCircle,
  Loader2,
  Navigation,
  X,
  Info,
} from "lucide-react";
import { 
  IPGeolocationService, 
  IPGeoLocationData, 
  getBrowserGPSLocation 
} from "@/lib/ipgeolocation-service";

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

interface IPGeolocationPickerProps {
  onLocationSelect: (location: LocationData | null) => void;
  currentLocation?: LocationData | null;
  disabled?: boolean;
  className?: string;
}

export default function IPGeolocationPicker({
  onLocationSelect,
  currentLocation,
  disabled = false,
  className = "",
}: IPGeolocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [detectedLocation, setDetectedLocation] = useState<LocationData | null>(null);
  const [isGettingGPS, setIsGettingGPS] = useState(false);

  // Get IPGeolocation API key from environment
  const apiKey = import.meta.env.VITE_IPGEO_API_KEY || 
                 (import.meta.env.DEV ? '447c6671cec342c59a7315d4dbc06967' : '');

  /**
   * Get location using IPGeolocation.io API
   */
  const getIPLocation = useCallback(async () => {
    setIsLoading(true);
    setError("");
    
    try {
      console.log('🌍 Getting IP-based location...');
      
      if (!apiKey) {
        throw new Error('IPGeolocation API key not configured');
      }

      // Initialize service with API key
      const service = new IPGeolocationService(apiKey);
      
      // Get current location based on IP
      const locationData = await service.getCurrentLocation({
        fields: [
          'latitude', 'longitude', 'city', 'state_prov', 'country_name', 
          'country_code2', 'time_zone', 'isp'
        ]
      });

      // Convert to our interface format
      const location: LocationData = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        address: locationData.address,
        city: locationData.city,
        region: locationData.region,
        country: locationData.country,
        countryCode: locationData.countryCode,
        timezone: locationData.timezone,
        isp: locationData.isp,
        timestamp: locationData.timestamp,
        source: 'ipgeolocation'
      };

      setDetectedLocation(location);
      console.log('✅ IP location detected:', location);

    } catch (error) {
      console.error('❌ IPGeolocation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to get IP location');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  /**
   * Get precise GPS location as fallback
   */
  const getGPSLocation = useCallback(async () => {
    setIsGettingGPS(true);
    setError("");
    
    try {
      console.log('📍 Getting GPS location...');
      const gpsLocation = await getBrowserGPSLocation();
      
      // Convert to our interface format
      const location: LocationData = {
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        accuracy: gpsLocation.accuracy,
        address: `${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)}`,
        timestamp: gpsLocation.timestamp,
        source: 'browser_gps'
      };

      setDetectedLocation(location);
      console.log('✅ GPS location obtained:', location);

    } catch (error) {
      console.error('❌ GPS location error:', error);
      setError(error instanceof Error ? error.message : 'Failed to get GPS location');
    } finally {
      setIsGettingGPS(false);
    }
  }, []);

  /**
   * Select the detected location
   */
  const handleLocationSelect = useCallback(() => {
    if (detectedLocation) {
      onLocationSelect(detectedLocation);
      setIsOpen(false);
      console.log('📍 Location selected:', detectedLocation);
    }
  }, [detectedLocation, onLocationSelect]);

  /**
   * Clear selected location
   */
  const handleClearLocation = useCallback(() => {
    onLocationSelect(null);
    setDetectedLocation(null);
    setError("");
  }, [onLocationSelect]);

  /**
   * Auto-detect location when dialog opens
   */
  useEffect(() => {
    if (isOpen && !detectedLocation && !isLoading) {
      getIPLocation();
    }
  }, [isOpen, detectedLocation, isLoading, getIPLocation]);

  /**
   * Format location display text
   */
  const formatLocationDisplay = (location: LocationData) => {
    if (location.city && location.region && location.country) {
      return `${location.city}, ${location.region}, ${location.country}`;
    }
    if (location.address) {
      return location.address;
    }
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  };

  /**
   * Get location source icon and label
   */
  const getLocationSourceInfo = (source: string) => {
    switch (source) {
      case 'ipgeolocation':
        return { icon: Wifi, label: 'IP Location', color: 'bg-blue-100 text-blue-800' };
      case 'browser_gps':
        return { icon: Navigation, label: 'GPS', color: 'bg-green-100 text-green-800' };
      default:
        return { icon: MapPin, label: 'Manual', color: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <div className={className}>
      {/* Current Location Display */}
      {currentLocation && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Location Selected
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                {formatLocationDisplay(currentLocation)}
              </p>
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className={getLocationSourceInfo(currentLocation.source).color}
                >
                  {React.createElement(getLocationSourceInfo(currentLocation.source).icon, {
                    className: "w-3 h-3 mr-1"
                  })}
                  {getLocationSourceInfo(currentLocation.source).label}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearLocation}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
              {currentLocation.accuracy && (
                <p className="text-xs text-gray-500">
                  Accuracy: ±{Math.round(currentLocation.accuracy)}m
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Picker Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full" disabled={disabled}>
            <Globe className="w-4 h-4 mr-2" />
            {currentLocation ? 'Change Location' : 'Detect Location'}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Location Detection
            </DialogTitle>
            <DialogDescription>
              We'll detect your location automatically using your IP address. 
              No GPS permissions required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Info Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                IP-based location provides city-level accuracy and doesn't require permissions.
                For more precise location, use the GPS option below.
              </AlertDescription>
            </Alert>

            {/* IP Location Detection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Automatic IP Location</Label>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Detecting your location...</p>
                  </div>
                </div>
              ) : detectedLocation ? (
                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">Location Detected</span>
                      <Badge className="bg-green-100 text-green-800">
                        <Wifi className="w-3 h-3 mr-1" />
                        IP Location
                      </Badge>
                    </div>
                    <p className="text-sm text-green-700">
                      {formatLocationDisplay(detectedLocation)}
                    </p>
                    {detectedLocation.isp && (
                      <p className="text-xs text-green-600">
                        ISP: {detectedLocation.isp}
                      </p>
                    )}
                    <Button
                      onClick={handleLocationSelect}
                      size="sm"
                      className="w-full mt-2"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Use This Location
                    </Button>
                  </div>
                </Card>
              ) : (
                <Button
                  onClick={getIPLocation}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  <Wifi className="w-4 h-4 mr-2" />
                  Detect IP Location
                </Button>
              )}
            </div>

            {/* GPS Fallback Option */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Precise GPS Location (Optional)</Label>
              <Button
                onClick={getGPSLocation}
                variant="outline"
                className="w-full"
                disabled={isGettingGPS}
              >
                {isGettingGPS ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4 mr-2" />
                )}
                Get GPS Location
              </Button>
              <p className="text-xs text-gray-500">
                GPS provides meter-level accuracy but requires browser permission.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}