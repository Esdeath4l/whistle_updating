// Simple SMS test using the endpoint
const fetch = require('node-fetch');

async function testSMS() {
  try {
    console.log('🧪 Testing SMS functionality...');
    
    const response = await fetch('http://localhost:8081/test-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('📱 SMS Test Result:', result);
    
    if (result.success) {
      console.log('✅ SMS functionality is working!');
    } else {
      console.log('❌ SMS test failed:', result.message);
    }
    
  } catch (error) {
    console.error('❌ SMS test error:', error.message);
  }
}

testSMS();