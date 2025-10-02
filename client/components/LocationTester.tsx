// Location Testing Component for debugging
import React, { useState } from 'react';

export function LocationTester() {
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            source: 'browser_gps',
            captureMethod: 'getCurrentPosition',
            enableHighAccuracy: true
          };
          resolve(locationData);
        },
        (error) => {
          let errorMessage = 'Unable to retrieve location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
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

  const handleGetLocation = async () => {
    setLoading(true);
    setError('');
    
    try {
      const loc = await getCurrentLocation() as any;
      
      // Try to get address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.latitude}&lon=${loc.longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'Whistle Security App'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.display_name) {
            loc.address = data.display_name;
          }
        }
      } catch (e) {
        console.warn('Could not get address:', e);
      }
      
      setLocation(loc);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">📍 Location Tester</h3>
      
      <button
        onClick={handleGetLocation}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Getting location...' : 'Get My Location'}
      </button>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800">
          Error: {error}
        </div>
      )}
      
      {location && (
        <div className="p-4 bg-green-50 border border-green-200 rounded space-y-2">
          <h4 className="font-semibold text-green-800">✅ Location Captured!</h4>
          
          <div className="space-y-1 text-sm">
            <div><strong>Latitude:</strong> {location.latitude}</div>
            <div><strong>Longitude:</strong> {location.longitude}</div>
            <div><strong>Accuracy:</strong> ±{Math.round(location.accuracy)} meters</div>
            <div><strong>Timestamp:</strong> {new Date(location.timestamp).toLocaleString()}</div>
            {location.altitude && <div><strong>Altitude:</strong> {location.altitude}m</div>}
            {location.heading && <div><strong>Heading:</strong> {location.heading}°</div>}
            {location.speed && <div><strong>Speed:</strong> {location.speed} m/s</div>}
            {location.address && (
              <div><strong>Address:</strong> {location.address}</div>
            )}
          </div>
          
          <div className="pt-2">
            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              📍 View on Google Maps
            </a>
          </div>
          
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">Raw Location Data</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(location, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}