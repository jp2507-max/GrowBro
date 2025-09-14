const { withNativeWind } = require('nativewind/metro');
const { getDefaultConfig } = require('expo/metro-config');
const { withExpoRouter } = require('expo-router/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

let config = getDefaultConfig(__dirname);

// Required: enable context modules and other Router transforms
config = withExpoRouter(config);

// Compose Sentry instrumentation on top of the router config
config = getSentryExpoConfig(__dirname, config);

// NativeWind CSS support
module.exports = withNativeWind(config, { input: './global.css' });
