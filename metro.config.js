const { getDefaultConfig } = require('expo/metro-config');
const { withExpoAtlas } = require('expo-atlas/metro');
const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

let config = getDefaultConfig(__dirname);

// Compose Sentry instrumentation on top of default Expo Metro config
config = getSentryExpoConfig(__dirname, config);

// Exclude test files from Metro bundler
config.resolver.blockList = [
  /.*\.test\.[jt]sx?$/,
  /.*\/__tests__\/.*/,
  /.*\.spec\.[jt]sx?$/,
];

// NativeWind CSS support
config = withNativeWind(config, { input: './global.css' });

// Collect Metro graph statistics for bundle analysis
config = withExpoAtlas(config);

module.exports = config;
