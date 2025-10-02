/**
 * Frontend-Backend Integration Test
 * Tests status checking, admin dashboard, and notifications
 */

async function testIntegration() {
  console.log('🧪 Testing Frontend-Backend Integration...\n');

  const baseUrl = 'http://localhost:8080/api';
  
  try {
    // 1. Test report submission
    console.log('1️⃣ Testing report submission...');
    
    const formData = new FormData();
    formData.append('message', 'Integration test report');
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
      success: submitResult.success,
      shortId: submitResult.data?.shortId,
      _id: submitResult.data?._id
    });

    // 2. Test status checking with shortId
    if (submitResult.data?.shortId) {
      console.log('\n2️⃣ Testing status check with shortId...');
      const statusResponse = await fetch(`${baseUrl}/reports/${submitResult.data.shortId}/status`);
      
      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        console.log('✅ Status check successful:', {
          success: statusResult.success,
          status: statusResult.data?.status,
          message: statusResult.data?.message?.substring(0, 50) + '...'
        });
      } else {
        console.log('❌ Status check failed:', statusResponse.status);
      }
    }

    // 3. Test admin login
    console.log('\n3️⃣ Testing admin login...');
    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ritika', password: 'satoru 2624' })
    });

    if (loginResponse.ok) {
      const loginResult = await loginResponse.json();
      console.log('✅ Admin login successful');

      // 4. Test admin reports fetching
      console.log('\n4️⃣ Testing admin reports...');
      const reportsResponse = await fetch(`${baseUrl}/admin/reports`, {
        headers: { 'Authorization': 'Bearer ritika:satoru 2624' }
      });

      if (reportsResponse.ok) {
        const reportsResult = await reportsResponse.json();
        console.log('✅ Admin reports fetched:', {
          total: reportsResult.total,
          reports: reportsResult.reports?.length || 0
        });
      } else {
        console.log('❌ Admin reports fetch failed:', reportsResponse.status);
      }
    } else {
      console.log('❌ Admin login failed:', loginResponse.status);
    }

    console.log('\n🎉 Integration test completed!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
  // Add a button to run the test
  const testButton = document.createElement('button');
  testButton.textContent = 'Run Integration Test';
  testButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
  testButton.onclick = testIntegration;
  document.body.appendChild(testButton);
}

export { testIntegration };