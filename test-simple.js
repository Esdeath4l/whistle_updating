const http = require('http');

const postData = JSON.stringify({
  message: "Test medical emergency report",
  category: "medical_emergency", 
  severity: "urgent"
});

const options = {
  hostname: 'localhost',
  port: 8086,
  path: '/api/reports',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing report submission with new schema...');
console.log('Data to send:', postData);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();