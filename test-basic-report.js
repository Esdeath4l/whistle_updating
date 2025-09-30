// Test minimal report submission (no photo, video, or location)
const testBasicReport = async () => {
  try {
    console.log('🔄 Testing basic report submission...');
    
    // Minimal report data - only required fields
    const reportData = {
      message: "Test basic report - no media, no location",
      category: "feedback",
      severity: "medium",
      share_location: false,
      is_offline_sync: false
    };

    console.log('📤 Sending minimal report payload:', reportData);

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
      console.log('✅ SUCCESS! Basic report submitted:', {
        id: result.id,
        shortId: result.shortId,
        message: result.message,
        category: result.category,
        severity: result.severity
      });
    } else {
      const errorText = await response.text();
      console.log('❌ Failed with status:', response.status);
      console.log('❌ Error response:', errorText);
    }
  } catch (error) {
    console.error('❌ Network/Script error:', error.message);
  }
};

testBasicReport();