const http = require('http');
const data = JSON.stringify({ email: 'owner@phoneshop.lk', password: 'changeme123', redirect: false });
const req = http.request({
  hostname: 'localhost', port: 3000, path: '/api/auth/callback/credentials', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => {
  let resData = '';
  res.on('data', chunk => resData += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', resData));
});
req.write(data);
req.end();
