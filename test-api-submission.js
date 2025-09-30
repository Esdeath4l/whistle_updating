// Test script to verify the "invalid security level error" is fixed
const testReportSubmission = async () => {
  try {
    console.log('🔄 Testing fixed severity and category values...');
    
    // Test data with CORRECTED values that frontend now sends
    const reportData = {
      message: "Test report to verify security level fix",
      category: "harassment", // CORRECTED: frontend now sends this
      severity: "high", // CORRECTED: frontend now sends this (not "high_priority")
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: Date.now(),
        source: "browser_gps" // CORRECTED: frontend sends this
      },
      share_location: true,
      is_offline_sync: false
    };

    console.log('📤 Sending corrected payload:', JSON.stringify(reportData, null, 2));

    const response = await fetch('http://localhost:8081/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData)
    });

    console.log('📥 Response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ FIXED! No more "invalid security level error"');
      console.log('📋 Report created successfully:', {
        id: result.id,
        shortId: result.shortId,
        created_at: result.created_at
      });
    } else {
      const error = await response.text();
      console.log('❌ Still getting error:', response.status, error);
    }
  } catch (error) {
    console.error('❌ Network/Script error:', error.message);
  }
};

// Test categories and severities
const testAllValues = async () => {
  console.log('🧪 Testing all valid category and severity combinations...');
  
  const categories = ["harassment", "medical", "emergency", "safety", "feedback"];
  const severities = ["low", "medium", "high", "urgent"];
  
  for (const category of categories) {
    for (const severity of severities) {
      try {
        const response = await fetch('http://localhost:8081/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Test ${category} report with ${severity} severity`,
            category,
            severity,
            share_location: false,
            is_offline_sync: false
          })
        });
        
        if (response.ok) {
          console.log(`✅ ${category} + ${severity}: SUCCESS`);
        } else {
          const error = await response.text();
          console.log(`❌ ${category} + ${severity}: ${error}`);
        }
      } catch (error) {
        console.log(`❌ ${category} + ${severity}: Network error`);
      }
      
      // Small delay to not overwhelm server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};

// Run tests
setTimeout(async () => {
  console.log('🚀 Testing if "invalid security level error" is fixed...');
  await testReportSubmission();
  
  console.log('\n🔍 Testing all valid combinations...');
  await testAllValues();
}, 1000);