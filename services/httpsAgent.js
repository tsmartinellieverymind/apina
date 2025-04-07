const https = require('https');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false // ⚠️ permite certificados self-signed
});

module.exports = httpsAgent;
