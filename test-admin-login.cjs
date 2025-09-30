const http = require('http');

const testData = JSON.stringify({
  username: "ritika",
  password: "satoru2624"
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('🧪 Testing admin login...');
console.log('Using current credentials: ritika / satoru2624');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:');
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

req.write(testData);
req.end();