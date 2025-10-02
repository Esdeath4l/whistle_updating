// IPGeolocation.io Integration Test
// Run with: node test-ipgeolocation.js

import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.IPGEO_API_KEY || process.env.VITE_IPGEO_API_KEY;

console.log('🌍 IPGeolocation.io Integration Test');
console.log('=====================================');
console.log(`API Key: ${apiKey ? apiKey.slice(0, 10) + '...' : 'NOT SET'}`);
console.log('');

async function testIPGeolocation() {
  try {
    if (!apiKey) {
      throw new Error('IPGeolocation API key not found. Please set IPGEO_API_KEY in .env file.');
    }

    console.log('📍 Testing current location detection...');
    
    // Test basic location detection
    const params = new URLSearchParams({
      apiKey: apiKey,
      format: 'json',
      fields: 'latitude,longitude,city,state_prov,country_name,country_code2,time_zone,isp'
    });

    const response = await fetch(`https://api.ipgeolocation.io/ipgeo?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check for API error
    if ('message' in data) {
      throw new Error(`IPGeolocation API Error: ${data.message}`);
    }

    console.log('✅ Location detection successful!');
    console.log('');
    console.log('📍 Location Details:');
    console.log(`   IP Address: ${data.ip}`);
    console.log(`   Coordinates: ${data.latitude}, ${data.longitude}`);
    console.log(`   City: ${data.city}`);
    console.log(`   State/Region: ${data.state_prov}`);
    console.log(`   Country: ${data.country_name} (${data.country_code2})`);
    console.log(`   Timezone: ${data.time_zone?.name}`);
    console.log(`   ISP: ${data.isp}`);
    console.log('');

    // Test the location data format expected by Whistle
    const whistleLocationData = {
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      accuracy: 1000, // IP-based location typically has ~1km accuracy
      address: `${data.city}, ${data.state_prov}, ${data.country_name}`,
      city: data.city,
      region: data.state_prov,
      country: data.country_name,
      countryCode: data.country_code2,
      timezone: data.time_zone?.name,
      isp: data.isp,
      timestamp: Date.now(),
      source: 'ipgeolocation'
    };

    console.log('🔧 Whistle Format Test:');
    console.log('   Location Object:', JSON.stringify(whistleLocationData, null, 2));
    console.log('');

    // Test API quota check
    console.log('📊 Testing API quota...');
    const quotaResponse = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&fields=ip`);
    if (quotaResponse.ok) {
      console.log('✅ API quota is available');
    } else {
      console.log('⚠️ API quota may be exceeded or there\'s an issue with the key');
    }
    console.log('');

    // Test with specific IP (Google DNS)
    console.log('🧪 Testing with specific IP address (8.8.8.8)...');
    const specificIPParams = new URLSearchParams({
      apiKey: apiKey,
      ip: '8.8.8.8',
      format: 'json',
      fields: 'latitude,longitude,city,country_name,isp'
    });

    const specificIPResponse = await fetch(`https://api.ipgeolocation.io/ipgeo?${specificIPParams.toString()}`);
    if (specificIPResponse.ok) {
      const specificIPData = await specificIPResponse.json();
      console.log(`   8.8.8.8 Location: ${specificIPData.city}, ${specificIPData.country_name}`);
      console.log(`   8.8.8.8 ISP: ${specificIPData.isp}`);
    }
    console.log('');

    console.log('🎉 All tests passed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start your Whistle app: npm run dev');
    console.log('2. Go to http://localhost:8081');
    console.log('3. Submit a report and test location detection');
    console.log('4. Check that location data is properly stored in MongoDB');
    
    return true;

  } catch (error) {
    console.error('❌ IPGeolocation test failed:');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check your API key in the .env file');
    console.error('2. Ensure you have internet connectivity');
    console.error('3. Verify your IPGeolocation.io account status');
    console.error('4. Check if you\'ve exceeded the API quota');
    console.error('');
    console.error('Get help:');
    console.error('- IPGeolocation.io docs: https://ipgeolocation.io/documentation');
    console.error('- Check API status: https://status.ipgeolocation.io');
    
    return false;
  }
}

// Additional test for frontend integration
async function testFrontendIntegration() {
  console.log('🖥️ Testing Frontend Integration...');
  console.log('');
  
  try {
    // Simulate the frontend service class
    const mockService = {
      apiKey: apiKey,
      baseUrl: 'https://api.ipgeolocation.io/ipgeo',
      
      async getCurrentLocation() {
        const params = new URLSearchParams({
          apiKey: this.apiKey,
          format: 'json'
        });
        
        const response = await fetch(`${this.baseUrl}?${params.toString()}`);
        const data = await response.json();
        
        return {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          accuracy: 1000,
          address: `${data.city}, ${data.state_prov}, ${data.country_name}`,
          city: data.city,
          region: data.state_prov,
          country: data.country_name,
          countryCode: data.country_code2,
          timezone: data.time_zone?.name,
          isp: data.isp,
          timestamp: Date.now(),
          source: 'ipgeolocation'
        };
      }
    };
    
    const location = await mockService.getCurrentLocation();
    console.log('✅ Frontend service simulation successful');
    console.log(`   Detected: ${location.city}, ${location.country}`);
    console.log(`   Coordinates: ${location.latitude}, ${location.longitude}`);
    console.log(`   Source: ${location.source}`);
    
  } catch (error) {
    console.error('❌ Frontend integration test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  const basicTest = await testIPGeolocation();
  
  if (basicTest) {
    console.log('');
    await testFrontendIntegration();
  }
  
  console.log('');
  console.log('🏁 Test completed');
  process.exit(basicTest ? 0 : 1);
}

runAllTests().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});