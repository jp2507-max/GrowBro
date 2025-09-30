const {
  isProtectedDeepLinkPath,
} = require('./src/lib/navigation/deep-link-gate.ts');

console.log('Testing current behavior:');
console.log(
  'isProtectedDeepLinkPath("/legal"):',
  isProtectedDeepLinkPath('/legal')
);
console.log(
  'isProtectedDeepLinkPath("/privacy"):',
  isProtectedDeepLinkPath('/privacy')
);
console.log(
  'isProtectedDeepLinkPath("/legal/terms"):',
  isProtectedDeepLinkPath('/legal/terms')
);
console.log(
  'isProtectedDeepLinkPath("/privacy/policy"):',
  isProtectedDeepLinkPath('/privacy/policy')
);
