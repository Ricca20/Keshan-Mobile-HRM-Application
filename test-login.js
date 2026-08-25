const http = require('http');

const data = JSON.stringify({
  email: 'john@phoneshop.lk',
  password: 'employee123',
  redirect: false,
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/callback/credentials',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let resData = '';
  res.on('data', chunk => resData += chunk);
  res.on('end', () => console.log('Login result:', resData));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
