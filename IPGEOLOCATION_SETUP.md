# IPGeolocation.io Setup Instructions

## Overview

The Whistle app now uses **IPGeolocation.io** for automatic location detection instead of Google Maps. This provides:

- **No GPS permissions required** - works based on IP address
- **City-level accuracy** - typically accurate to within 1-5km
- **Rich location data** - includes city, region, country, timezone, ISP
- **Free tier available** - 1000 requests/month
- **Privacy-friendly** - no tracking or personal data collection

## How to Get IPGeolocation API Key

### 1. Visit IPGeolocation.io
   - Go to [ipgeolocation.io](https://ipgeolocation.io/)
   - Click "Sign Up" to create a free account

### 2. Create Account
   - Provide email address and password
   - Verify your email address
   - Log in to your dashboard

### 3. Get API Key
   - Navigate to your dashboard
   - Copy your API key from the main dashboard
   - Free tier includes 1000 requests/month

### 4. Configure Environment Variables
   Open your `.env` file and update:
   ```env
   # IPGeolocation.io Configuration
   IPGEO_API_KEY=your-actual-api-key-here
   VITE_IPGEO_API_KEY=your-actual-api-key-here
   ```

### 5. Test Configuration
   - Restart your development server: `npm run dev`
   - Go to the report page and click "Detect Location"
   - Location should be detected automatically

## Current Configuration

The app is currently configured with API key: `447c6671cec342c59a7315d4dbc06967`

## Features Included

### Automatic IP Location Detection
- **What it does**: Detects user location based on their IP address
- **Accuracy**: City-level (typically 1-5km radius)
- **Permissions**: No browser permissions required
- **Privacy**: No GPS or personal location tracking

### Enhanced Location Data
The app now captures:
- **Coordinates**: Latitude and longitude
- **Address**: City, region/state, country
- **Metadata**: Timezone, ISP, country code
- **Source tracking**: Knows if location came from IP, GPS, or manual selection

### Fallback Options
1. **Primary**: IPGeolocation.io (automatic)
2. **Secondary**: Browser GPS (requires permission)
3. **Tertiary**: Interactive map selection (manual)

## API Limits and Pricing

### Free Tier
- **1000 requests/month**
- **City-level accuracy**
- **No credit card required**
- **Perfect for development and small apps**

### Paid Plans (if needed)
- **Basic**: $15/month - 150,000 requests
- **Pro**: $45/month - 500,000 requests
- **Enterprise**: Custom pricing

## Privacy and Security

### Data Handling
- **No personal data**: Only IP-based location
- **Encrypted storage**: All location data encrypted in database
- **No tracking**: No cookies or persistent tracking
- **GDPR compliant**: Meets European privacy standards

### Location Accuracy
- **IP Location**: ~1-5km accuracy (city-level)
- **GPS Location**: ~10-100m accuracy (requires permission)
- **Manual Selection**: User-defined accuracy

## Troubleshooting

### Common Issues

#### 1. Location Not Detected
```
Error: IPGeolocation API key not configured
```
**Solution**: Ensure `VITE_IPGEO_API_KEY` is set in `.env` file

#### 2. API Limit Exceeded
```
Error: Request limit exceeded
```
**Solution**: Upgrade to paid plan or wait for monthly reset

#### 3. Inaccurate Location
**Issue**: Location shows wrong city
**Solution**: This is normal for IP-based location. Offer GPS or manual selection as alternatives.

### Debugging Tips

1. **Check API Key**: Verify the key is correct in `.env`
2. **Check Network**: Ensure internet connection is working
3. **Check Console**: Look for error messages in browser developer tools
4. **Test API**: Use the test endpoint at `/test-ipgeo` (if implemented)

## Migration from Google Maps

### What Changed
- ✅ **Removed**: Google Maps API dependency
- ✅ **Removed**: GOOGLE_MAPS_API_KEY environment variables
- ✅ **Added**: IPGeolocation.io API integration
- ✅ **Enhanced**: Location data with city, region, country
- ✅ **Maintained**: All existing report functionality

### Backward Compatibility
- ✅ **Existing reports**: All old reports still work
- ✅ **Database schema**: Enhanced but backward compatible
- ✅ **API endpoints**: No changes to report submission
- ✅ **Encryption**: All location data still encrypted

## Testing the Integration

### Manual Testing
1. Open the app: `http://localhost:8081`
2. Go to "Submit Report"
3. Check "Share location"
4. Click "Detect Location"
5. Verify your city/region is detected correctly

### Automated Testing
Run the built-in test script:
```bash
cd whistle
node test-ipgeolocation.js
```

## Support

### IPGeolocation.io Support
- **Documentation**: [ipgeolocation.io/documentation](https://ipgeolocation.io/documentation)
- **Support**: Contact through their dashboard
- **Status**: [status.ipgeolocation.io](https://status.ipgeolocation.io)

### Whistle App Support
- Check the console for error messages
- Verify environment variables are set correctly
- Ensure network connectivity to ipgeolocation.io
- Test with different IP addresses/locations

## API Usage Examples

### Basic Location Request
```bash
curl "https://api.ipgeolocation.io/ipgeo?apiKey=YOUR_API_KEY"
```

### Specific IP Lookup
```bash
curl "https://api.ipgeolocation.io/ipgeo?apiKey=YOUR_API_KEY&ip=8.8.8.8"
```

### Response Format
```json
{
  "ip": "8.8.8.8",
  "continent_name": "North America",
  "country_name": "United States",
  "country_code2": "US",
  "state_prov": "California",
  "city": "Mountain View",
  "latitude": "37.4056",
  "longitude": "-122.0775",
  "time_zone": {
    "name": "America/Los_Angeles",
    "offset": -8
  },
  "isp": "Google LLC"
}
```

This setup provides a more privacy-friendly and user-friendly location detection system for the Whistle anonymous reporting app!