#!/usr/bin/env node
const { execSync } = require('child_process');

function enableAirplaneMode() {
  try {
    // Detect platform - check if iOS simulator or Android emulator
    const isIOS =
      process.env.MAESTRO_PLATFORM === 'iOS' ||
      process.platform === 'darwin' ||
      process.env.SIMULATOR_UDID;

    if (isIOS) {
      console.log('Enabling airplane mode on iOS simulator...');
      execSync(
        'xcrun simctl status_bar booted override --dataNetwork wifi --wifiMode active --wifiBars 3',
        {
          stdio: 'inherit',
        }
      );
      console.log('iOS airplane mode enabled');
    } else {
      console.log('Enabling airplane mode on Android emulator...');
      execSync('adb shell svc wifi disable && adb shell svc data disable', {
        stdio: 'inherit',
      });
      console.log('Android airplane mode enabled');
    }
  } catch (error) {
    console.error('Failed to enable airplane mode:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  enableAirplaneMode();
}

module.exports = { enableAirplaneMode };
