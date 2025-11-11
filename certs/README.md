Place your Expo Updates code signing certificate(s) in this directory and set
`CODE_SIGNING_CERT_PATH` in your `.env.*` files to point to the appropriate PEM.

Generate a new certificate with:

```bash
npx expo-updates codesigning:generate --keyid growbro-main --cert ./certs/code-signing-prod.pem
```

Keep the private key secret; only the public certificate should live in the repo.
