/**
 * Quick Test: Report Status Checking
 * Tests both shortId and ObjectId lookup functionality
 */

async function testStatusLookup() {
  console.log('🧪 Testing Report Status Lookup...\n');

  const baseUrl = 'http://localhost:8080/api';
  
  // Test with a sample report submission first
  console.log('1️⃣ Submitting a test report...');
  
  try {
    const formData = new FormData();
    formData.append('message', 'Test report for status checking');
    formData.append('category', 'general');
    formData.append('severity', 'medium');
    formData.append('is_encrypted', 'false');
    formData.append('share_location', 'false');

    const submitResponse = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      body: formData
    });

    if (!submitResponse.ok) {
      throw new Error(`Submit failed: ${submitResponse.status}`);
    }

    const submitResult = await submitResponse.json();
    console.log('✅ Report submitted:', {
      _id: submitResult.data._id,
      shortId: submitResult.data.shortId
    });

    // Test status lookup with shortId
    console.log('\n2️⃣ Testing status lookup with shortId...');
    const shortIdResponse = await fetch(`${baseUrl}/reports/${submitResult.data.shortId}/status`);
    
    if (shortIdResponse.ok) {
      const shortIdResult = await shortIdResponse.json();
      console.log('✅ ShortId lookup successful:', {
        shortId: shortIdResult.data.shortId,
        status: shortIdResult.data.status
      });
    } else {
      console.log('❌ ShortId lookup failed:', shortIdResponse.status);
    }

    // Test status lookup with ObjectId
    console.log('\n3️⃣ Testing status lookup with ObjectId...');
    const objectIdResponse = await fetch(`${baseUrl}/reports/${submitResult.data._id}/status`);
    
    if (objectIdResponse.ok) {
      const objectIdResult = await objectIdResponse.json();
      console.log('✅ ObjectId lookup successful:', {
        shortId: objectIdResult.data.shortId,
        status: objectIdResult.data.status
      });
    } else {
      console.log('❌ ObjectId lookup failed:', objectIdResponse.status);
    }

    console.log('\n🎉 Status lookup test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test if this script is executed directly
if (typeof window === 'undefined') {
  // Node.js environment - use node-fetch
  const fetch = require('node-fetch');
  const FormData = require('form-data');
  testStatusLookup();
} else {
  // Browser environment
  testStatusLookup();
}

export { testStatusLookup };