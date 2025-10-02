/**
 * Location Processing Utilities for Whistle App
 * 
 * Handles location data transformation between frontend and backend
 * Supports IPGeolocation.io enhanced location data
 */

export interface ProcessedLocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  isp?: string;
  source?: 'ipgeolocation' | 'browser_gps' | 'manual';
  timestamp?: number;
}

export interface FrontendLocationData {
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
  source: 'ipgeolocation' | 'browser_gps' | 'manual';
  timestamp: number;
}

/**
 * Process location data from frontend format to backend schema format
 * @param locationInput Raw location data from frontend or string
 * @returns Processed location data for database storage
 */
export function processLocationData(locationInput: any): ProcessedLocationData | null {
  try {
    let locationData: FrontendLocationData;
    
    // Parse if string, otherwise use as object
    if (typeof locationInput === 'string') {
      locationData = JSON.parse(locationInput);
    } else {
      locationData = locationInput;
    }

    console.log("📍 Processing location data:", locationData);
    
    // Validate required fields
    if (!locationData || 
        typeof locationData.latitude !== 'number' || 
        typeof locationData.longitude !== 'number') {
      console.warn("⚠️ Invalid location data: missing latitude/longitude");
      return null;
    }

    // Validate coordinate ranges
    if (locationData.latitude < -90 || locationData.latitude > 90) {
      console.warn("⚠️ Invalid latitude:", locationData.latitude);
      return null;
    }

    if (locationData.longitude < -180 || locationData.longitude > 180) {
      console.warn("⚠️ Invalid longitude:", locationData.longitude);
      return null;
    }

    // Transform to backend format
    const processedLocation: ProcessedLocationData = {
      lat: locationData.latitude,
      lng: locationData.longitude,
      accuracy: locationData.accuracy || 0,
      timestamp: locationData.timestamp || Date.now(),
      source: locationData.source || 'manual'
    };

    // Add optional fields if present
    if (locationData.address) {
      processedLocation.address = locationData.address.substring(0, 500); // Truncate to schema limit
    }

    if (locationData.city) {
      processedLocation.city = locationData.city.substring(0, 100);
    }

    if (locationData.region) {
      processedLocation.region = locationData.region.substring(0, 100);
    }

    if (locationData.country) {
      processedLocation.country = locationData.country.substring(0, 100);
    }

    if (locationData.countryCode) {
      processedLocation.countryCode = locationData.countryCode.substring(0, 3);
    }

    if (locationData.timezone) {
      processedLocation.timezone = locationData.timezone.substring(0, 50);
    }

    if (locationData.isp) {
      processedLocation.isp = locationData.isp.substring(0, 200);
    }

    console.log("✅ Location data processed:", {
      lat: processedLocation.lat,
      lng: processedLocation.lng,
      accuracy: processedLocation.accuracy,
      source: processedLocation.source,
      city: processedLocation.city,
      country: processedLocation.country
    });

    return processedLocation;

  } catch (error) {
    console.error("❌ Failed to process location data:", error);
    return null;
  }
}

/**
 * Convert backend location data to frontend format
 * @param backendLocation Location data from database
 * @returns Frontend-compatible location data
 */
export function formatLocationForFrontend(backendLocation: ProcessedLocationData): FrontendLocationData {
  return {
    latitude: backendLocation.lat,
    longitude: backendLocation.lng,
    accuracy: backendLocation.accuracy,
    address: backendLocation.address,
    city: backendLocation.city,
    region: backendLocation.region,
    country: backendLocation.country,
    countryCode: backendLocation.countryCode,
    timezone: backendLocation.timezone,
    isp: backendLocation.isp,
    source: backendLocation.source || 'manual',
    timestamp: backendLocation.timestamp || Date.now()
  };
}

/**
 * Get a human-readable location description
 * @param location Location data
 * @returns Formatted location string
 */
export function getLocationDescription(location: ProcessedLocationData): string {
  const parts = [];
  
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) parts.push(location.country);
  
  if (parts.length > 0) {
    return parts.join(', ');
  }
  
  if (location.address) {
    return location.address;
  }
  
  return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
}

/**
 * Get location source display information
 * @param source Location source type
 * @returns Display information for the source
 */
export function getLocationSourceInfo(source: string) {
  switch (source) {
    case 'ipgeolocation':
      return {
        label: 'IP Location',
        description: 'Detected from internet connection',
        accuracy: 'City-level',
        icon: '🌍'
      };
    case 'browser_gps':
      return {
        label: 'GPS Location',
        description: 'Device GPS coordinates',
        accuracy: 'Meter-level',
        icon: '📍'
      };
    case 'manual':
      return {
        label: 'Manual Location',
        description: 'Selected on map',
        accuracy: 'User-defined',
        icon: '🗺️'
      };
    default:
      return {
        label: 'Unknown Location',
        description: 'Location source unknown',
        accuracy: 'Unknown',
        icon: '❓'
      };
  }
}