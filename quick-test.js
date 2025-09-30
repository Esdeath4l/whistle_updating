// Quick test to verify the "invalid security level error" is fixed
const testReportSubmission = async () => {
  try {
    console.log('🔄 Testing fixed severity and category values...');
    
    const reportData = {
      message: "Test report to verify security level fix",
      category: "harassment",
      severity: "high", 
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: Date.now(),
        source: "browser_gps"
      },
      share_location: true,
      is_offline_sync: false
    };

    console.log('📤 Sending corrected payload...');

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

testReportSubmission();