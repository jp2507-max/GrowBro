module.exports = {
  dependencies: {
    // Avoid duplicate CocoaPods entries: WatermelonDB plugin manages simdjson
    '@nozbe/simdjson': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
