/**
 * IPGeolocation.io Service for Whistle App
 * 
 * This service provides precise IP-based geolocation using IPGeolocation.io API
 * as a replacement for Google Maps location services.
 * 
 * Features:
 * - IP-based geolocation (no GPS required)
 * - High precision location data
 * - City, region, country information
 * - Timezone and ISP details
 * - Error handling with fallback
 * 
 * API Documentation: https://ipgeolocation.io/documentation.html
 * Free tier: 1000 requests/month
 */

export interface IPGeoLocationData {
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

export interface IPGeoResponse {
  ip: string;
  continent_code: string;
  continent_name: string;
  country_code2: string;
  country_code3: string;
  country_name: string;
  country_capital: string;
  state_prov: string;
  district: string;
  city: string;
  zipcode: string;
  latitude: string;
  longitude: string;
  is_eu: boolean;
  calling_code: string;
  country_tld: string;
  languages: string;
  country_flag: string;
  geoname_id: string;
  isp: string;
  connection_type: string;
  organization: string;
  currency: {
    code: string;
    name: string;
    symbol: string;
  };
  time_zone: {
    name: string;
    offset: number;
    current_time: string;
    current_time_unix: number;
    is_dst: boolean;
    dst_savings: number;
  };
}

class IPGeolocationService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.ipgeolocation.io/ipgeo';
  private readonly timeout = 10000; // 10 seconds timeout

  constructor(apiKey?: string) {
    // In browser environment, we'll pass the API key from environment
    this.apiKey = apiKey || '';
  }

  /**
   * Get current user location using IP geolocation
   * @param options Optional parameters for the API request
   * @returns Promise with location data
   */
  async getCurrentLocation(options: {
    fields?: string[];
    excludeFields?: string[];
  } = {}): Promise<IPGeoLocationData> {
    try {
      console.log('🌍 Fetching location using IPGeolocation.io...');
      
      if (!this.apiKey) {
        throw new Error('IPGeolocation API key not configured');
      }

      // Build query parameters
      const params = new URLSearchParams({
        apiKey: this.apiKey,
        format: 'json'
      });

      // Add optional fields
      if (options.fields && options.fields.length > 0) {
        params.append('fields', options.fields.join(','));
      }

      if (options.excludeFields && options.excludeFields.length > 0) {
        params.append('excludes', options.excludeFields.join(','));
      }

      // Make API request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`IPGeolocation API error: ${response.status} ${response.statusText}`);
      }

      const data: IPGeoResponse = await response.json();

      // Check for API error in response
      if ('message' in data) {
        throw new Error(`IPGeolocation API error: ${(data as any).message}`);
      }

      // Parse and format the location data
      const locationData: IPGeoLocationData = {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        accuracy: 1000, // IP-based location typically has ~1km accuracy
        address: this.formatAddress(data),
        city: data.city,
        region: data.state_prov,
        country: data.country_name,
        countryCode: data.country_code2,
        timezone: data.time_zone?.name,
        isp: data.isp,
        timestamp: Date.now(),
        source: 'ipgeolocation'
      };

      console.log('✅ IPGeolocation data retrieved successfully:', {
        location: `${data.city}, ${data.state_prov}, ${data.country_name}`,
        coordinates: `${data.latitude}, ${data.longitude}`,
        isp: data.isp
      });

      return locationData;

    } catch (error) {
      console.error('❌ IPGeolocation service error:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Location request timed out. Please try again.');
        }
        throw error;
      }
      
      throw new Error('Failed to get location from IPGeolocation service');
    }
  }

  /**
   * Get location for a specific IP address
   * @param ipAddress The IP address to lookup
   * @param options Optional parameters
   */
  async getLocationForIP(ipAddress: string, options: {
    fields?: string[];
    excludeFields?: string[];
  } = {}): Promise<IPGeoLocationData> {
    try {
      console.log(`🌍 Fetching location for IP: ${ipAddress}`);
      
      if (!this.apiKey) {
        throw new Error('IPGeolocation API key not configured');
      }

      // Build query parameters
      const params = new URLSearchParams({
        apiKey: this.apiKey,
        ip: ipAddress,
        format: 'json'
      });

      // Add optional fields
      if (options.fields && options.fields.length > 0) {
        params.append('fields', options.fields.join(','));
      }

      if (options.excludeFields && options.excludeFields.length > 0) {
        params.append('excludes', options.excludeFields.join(','));
      }

      // Make API request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`IPGeolocation API error: ${response.status} ${response.statusText}`);
      }

      const data: IPGeoResponse = await response.json();

      // Parse and format the location data
      const locationData: IPGeoLocationData = {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        accuracy: 1000,
        address: this.formatAddress(data),
        city: data.city,
        region: data.state_prov,
        country: data.country_name,
        countryCode: data.country_code2,
        timezone: data.time_zone?.name,
        isp: data.isp,
        timestamp: Date.now(),
        source: 'ipgeolocation'
      };

      console.log(`✅ IPGeolocation data for ${ipAddress}:`, locationData);
      return locationData;

    } catch (error) {
      console.error(`❌ IPGeolocation service error for IP ${ipAddress}:`, error);
      throw error;
    }
  }

  /**
   * Format address from IPGeolocation response
   */
  private formatAddress(data: IPGeoResponse): string {
    const parts = [];
    
    if (data.city) parts.push(data.city);
    if (data.state_prov) parts.push(data.state_prov);
    if (data.country_name) parts.push(data.country_name);
    
    return parts.join(', ');
  }

  /**
   * Test the IPGeolocation service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getCurrentLocation({
        fields: ['latitude', 'longitude', 'city', 'country_name']
      });
      return true;
    } catch (error) {
      console.error('IPGeolocation service test failed:', error);
      return false;
    }
  }

  /**
   * Get fallback location data when IPGeolocation fails
   */
  getFallbackLocation(): IPGeoLocationData {
    console.log('⚠️ Using fallback location data');
    return {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      address: 'Location unavailable',
      city: 'Unknown',
      region: 'Unknown',
      country: 'Unknown',
      countryCode: 'UN',
      timestamp: Date.now(),
      source: 'manual'
    };
  }
}

// Create and export service instance
// Note: API key will be passed from environment in components
export const ipGeolocationService = new IPGeolocationService();

// Export service class for testing
export { IPGeolocationService };

/**
 * Utility function to get browser GPS location as fallback
 * This provides more precise location but requires user permission
 */
export const getBrowserGPSLocation = (): Promise<IPGeoLocationData> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: IPGeoLocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: 'browser_gps'
        };
        resolve(location);
      },
      (error) => {
        let errorMessage = 'Failed to get GPS location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  });
};