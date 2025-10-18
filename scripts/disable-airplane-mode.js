#!/usr/bin/env node
const { execSync } = require('child_process');

function disableAirplaneMode() {
  try {
    // Detect platform - check if iOS simulator or Android emulator
    const isIOS =
      process.env.MAESTRO_PLATFORM === 'iOS' ||
      process.platform === 'darwin' ||
      process.env.SIMULATOR_UDID;

    if (isIOS) {
      console.log('Disabling airplane mode on iOS simulator...');
      execSync('xcrun simctl status_bar booted clear', {
        stdio: 'inherit',
      });
      console.log('iOS airplane mode disabled');
    } else {
      console.log('Disabling airplane mode on Android emulator...');
      execSync('adb shell svc wifi enable && adb shell svc data enable', {
        stdio: 'inherit',
      });
      console.log('Android airplane mode disabled');
    }
  } catch (error) {
    console.error('Failed to disable airplane mode:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  disableAirplaneMode();
}

module.exports = { disableAirplaneMode };
