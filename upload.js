const fs = require('fs');
const https = require('https');

const filePath = './bot_huggingface.zip';
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const fileStream = fs.createReadStream(filePath);
const fileStats = fs.statSync(filePath);

const head = 
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="bot_huggingface.zip"\r\n` +
  `Content-Type: application/zip\r\n\r\n`;

const tail = `\r\n--${boundary}--`;

const totalLength = Buffer.byteLength(head) + fileStats.size + Buffer.byteLength(tail);

const options = {
  hostname: 'tmpfiles.org',
  port: 443,
  path: '/api/v1/upload',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': totalLength
  }
};

const req = https.request(options, (res) => {
  console.log('STATUS:', res.statusCode);
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('UPLOAD_SUCCESS');
    console.log(responseData);
  });
});

req.on('error', (err) => {
  console.error('Upload failed:', err);
});

req.write(head);

fileStream.on('data', (chunk) => {
  req.write(chunk);
});

fileStream.on('end', () => {
  req.write(tail);
  req.end();
});
