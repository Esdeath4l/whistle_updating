// Test script for unified GridFS-only implementation
const testUnifiedGridFS = async () => {
  console.log('🧪 Testing unified GridFS implementation...');
  
  const baseUrl = 'http://localhost:8086';
  
  // Test 1: Text-only report (no files) - should work with multipart/form-data
  console.log('\n📝 Test 1: Text-only report via multipart/form-data');
  try {
    const formData1 = new FormData();
    formData1.append('message', 'Test text-only report via GridFS endpoint');
    formData1.append('category', 'feedback');
    formData1.append('severity', 'medium');
    formData1.append('share_location', 'false');
    formData1.append('is_offline_sync', 'false');
    
    const response1 = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      body: formData1
    });
    
    if (response1.ok) {
      const result1 = await response1.json();
      console.log('✅ Text-only report SUCCESS:', result1.data?.shortId || result1.shortId);
    } else {
      const error1 = await response1.text();
      console.log('❌ Text-only report FAILED:', response1.status, error1);
    }
  } catch (error) {
    console.log('❌ Text-only report ERROR:', error.message);
  }
  
  // Test 2: Report with location data
  console.log('\n📍 Test 2: Report with location via multipart/form-data');
  try {
    const formData2 = new FormData();
    formData2.append('message', 'Test report with location data');
    formData2.append('category', 'safety');
    formData2.append('severity', 'high');
    formData2.append('share_location', 'true');
    formData2.append('location', JSON.stringify({
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5,
      timestamp: Date.now(),
      source: "browser_gps"
    }));
    formData2.append('is_offline_sync', 'false');
    
    const response2 = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      body: formData2
    });
    
    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✅ Location report SUCCESS:', result2.data?.shortId || result2.shortId);
    } else {
      const error2 = await response2.text();
      console.log('❌ Location report FAILED:', response2.status, error2);
    }
  } catch (error) {
    console.log('❌ Location report ERROR:', error.message);
  }
  
  // Test 3: All categories and severities
  console.log('\n🎯 Test 3: Testing all category/severity combinations');
  const categories = ["harassment", "medical", "emergency", "safety", "feedback"];
  const severities = ["low", "medium", "high", "urgent"];
  
  let successCount = 0;
  let failCount = 0;
  
  for (const category of categories) {
    for (const severity of severities) {
      try {
        const formData = new FormData();
        formData.append('message', `Test ${category} report with ${severity} severity via GridFS`);
        formData.append('category', category);
        formData.append('severity', severity);
        formData.append('share_location', 'false');
        formData.append('is_offline_sync', 'false');
        
        const response = await fetch(`${baseUrl}/api/reports`, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          successCount++;
          console.log(`✅ ${category} + ${severity}: SUCCESS`);
        } else {
          failCount++;
          const error = await response.text();
          console.log(`❌ ${category} + ${severity}: ${response.status} ${error}`);
        }
      } catch (error) {
        failCount++;
        console.log(`❌ ${category} + ${severity}: ERROR ${error.message}`);
      }
      
      // Small delay to not overwhelm server
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log(`\n📊 Results: ${successCount} successful, ${failCount} failed`);
  
  // Test 4: Verify old JSON endpoint is no longer available
  console.log('\n🚫 Test 4: Verify JSON endpoint is disabled');
  try {
    const response4 = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "This should not work",
        category: "feedback",
        severity: "medium"
      })
    });
    
    if (!response4.ok) {
      console.log('✅ JSON endpoint properly disabled (expected failure)');
    } else {
      console.log('❌ JSON endpoint still working (unexpected success)');
    }
  } catch (error) {
    console.log('✅ JSON endpoint disabled:', error.message);
  }
  
  console.log('\n🎉 Unified GridFS implementation test complete!');
};

testUnifiedGridFS();