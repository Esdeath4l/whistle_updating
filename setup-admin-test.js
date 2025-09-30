const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/setup-admin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

console.log('🔧 Setting up initial admin...');

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
      
      if (jsonData.success) {
        console.log('\n✅ Admin setup complete!');
        console.log('You can now login with:');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('Email: admin@whistle.com');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();