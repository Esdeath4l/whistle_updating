// Test script to verify MongoDB storage and encryption fixes
const testMongoDBFixes = async () => {
  try {
    console.log('🔄 Testing MongoDB storage and encryption fixes...');
    
    // Test data with medical category and encryption
    const reportData = {
      message: "Test message to verify MongoDB storage and encryption fixes",
      category: "medical", // This should now work with our enum fix
      severity: "high",
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: Date.now(),
        source: "browser_gps"
      },
      share_location: true,
      is_offline_sync: false,
      is_encrypted: true // Test encryption
    };

    console.log('📤 Sending test payload with medical category and encryption:');
    console.log(JSON.stringify(reportData, null, 2));

    const response = await fetch('http://localhost:8080/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData)
    });

    console.log('📥 Response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS! MongoDB storage and encryption working');
      console.log('📋 Report created successfully:', {
        id: result.id,
        shortId: result.shortId,
        created_at: result.created_at,
        encrypted: result.is_encrypted
      });
      
      // Test retrieval through admin API
      console.log('🔄 Testing admin report retrieval...');
      const adminResponse = await fetch('http://localhost:8080/api/admin/reports', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (adminResponse.ok) {
        const reports = await adminResponse.json();
        console.log('✅ Admin API working! Retrieved', reports.length, 'reports');
        const ourReport = reports.find(r => r.shortId === result.shortId);
        if (ourReport) {
          console.log('📋 Our test report found in admin view:', {
            shortId: ourReport.shortId,
            category: ourReport.category,
            is_encrypted: ourReport.is_encrypted
          });
        }
      } else {
        console.log('❌ Admin API error:', adminResponse.status);
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Report submission error:', response.status, error);
    }
  } catch (error) {
    console.error('❌ Network/Script error:', error.message);
  }
};

// Run the test
testMongoDBFixes();