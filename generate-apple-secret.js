const fs = require('fs');
const crypto = require('crypto');

const privateKey = crypto.createPrivateKey({
  key: fs.readFileSync('AuthKey_255J447A73.p8', 'utf8'),
  format: 'pem',
  type: 'pkcs8',
});

const header = { alg: 'ES256', kid: '255J447A73' };
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: 'A6PN9VS2GX',
  aud: 'https://appleid.apple.com',
  sub: 'com.growbro.web',
  iat: now,
  exp: now + 180 * 24 * 60 * 60,
};

const { Buffer } = require('buffer');

const base64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const signingInput =
  `${base64url(JSON.stringify(header))}.` +
  `${base64url(JSON.stringify(payload))}`;

const signature = crypto
  .createSign('SHA256')
  .update(signingInput)
  .end()
  .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

const clientSecret = `${signingInput}.${base64url(signature)}`;
console.log(clientSecret);
