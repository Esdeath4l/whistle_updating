// Test to verify internal server error is fixed
const testReportSubmission = async () => {
  try {
    console.log('🔄 Testing report submission without location data...');
    
    // Test case 1: Report without location sharing
    const reportData1 = {
      message: "Test report without location sharing",
      category: "feedback",
      severity: "medium",
      share_location: false,
      is_offline_sync: false
    };

    console.log('📤 Sending report without location...');
    const response1 = await fetch('http://localhost:8082/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData1)
    });

    console.log('📥 Response status:', response1.status);
    
    if (response1.ok) {
      const result1 = await response1.json();
      console.log('✅ SUCCESS! Report submitted without location:', {
        id: result1.id,
        shortId: result1.shortId
      });
    } else {
      const error1 = await response1.text();
      console.log('❌ Still getting error:', response1.status, error1);
    }

    // Test case 2: Report with location sharing but incomplete location data
    const reportData2 = {
      message: "Test report with location sharing but no location data",
      category: "safety",
      severity: "high",
      share_location: true,
      // location: undefined (simulating form submission before user gets location)
      is_offline_sync: false
    };

    console.log('📤 Sending report with share_location=true but no location data...');
    const response2 = await fetch('http://localhost:8082/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData2)
    });

    console.log('📥 Response status:', response2.status);
    
    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✅ SUCCESS! Report submitted with share_location=true but no location:', {
        id: result2.id,
        shortId: result2.shortId
      });
    } else {
      const error2 = await response2.text();
      console.log('❌ Still getting error:', response2.status, error2);
    }

  } catch (error) {
    console.error('❌ Network/Script error:', error.message);
  }
};

testReportSubmission();