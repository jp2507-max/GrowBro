const { withNativeWind } = require('nativewind/metro');
const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

let config = getDefaultConfig(__dirname);

// Compose Sentry instrumentation on top of default Expo Metro config
config = getSentryExpoConfig(__dirname, config);

// NativeWind CSS support
module.exports = withNativeWind(config, { input: './global.css' });
