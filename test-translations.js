// Simple test to verify translation keys work
const { translate } = require('./src/lib/i18n/utils.tsx');

console.log('Testing translation keys:');
console.log('Title:', translate('settings.about.openStoreErrorTitle'));
console.log('Message:', translate('settings.about.openStoreErrorMessage'));
