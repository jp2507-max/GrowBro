#!/usr/bin/env node
const { execSync } = require('child_process');

// Configuration: Set to true to attempt real network isolation via Network Link Conditioner
// Falls back to visual-only status bar changes if NLC is unavailable
const ENABLE_REAL_NETWORK_ISOLATION =
  process.env.ENABLE_REAL_NETWORK_ISOLATION === 'true';

function enableNetworkLinkConditioner() {
  try {
    console.log(
      'Attempting to enable Network Link Conditioner with "No Network" profile...'
    );

    // Check if Network Link Conditioner preference pane exists
    execSync(
      '[ -e "/Library/PreferencePanes/Network Link Conditioner.prefPane" ] || [ -e ~/Library/PreferencePanes/Network Link Conditioner.prefPane ]',
      { stdio: 'pipe', timeout: 5000 }
    );

    // Use AppleScript to enable Network Link Conditioner with "No Network" profile
    const appleScript = `
      tell application "System Preferences"
        activate
        reveal pane "Network Link Conditioner"
        delay 1
      end tell

      tell application "System Events"
        tell process "System Preferences"
          tell window "Network Link Conditioner"
            click button "On"
            delay 0.5
            tell pop up button 1
              click
              delay 0.5
              click menu item "No Network" of menu 1
            end tell
          end tell
        end tell
      end tell

      tell application "System Preferences" to quit
    `;

    execSync(`osascript -e '${appleScript}'`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log('Network Link Conditioner enabled with "No Network" profile');
    return true;
  } catch (error) {
    console.warn(
      'Network Link Conditioner not available or failed to enable:',
      error.message
    );
    console.warn('Falling back to visual-only status bar changes');
    return false;
  }
}

function enableVisualAirplaneMode() {
  console.log(
    'Enabling visual airplane mode on iOS simulator (status bar only)...'
  );
  console.log(
    'NOTE: This only changes the visual status bar and does NOT disable networking.'
  );
  console.log(
    'TODO: For real network isolation, run tests on physical device or enable Network Link Conditioner manually.'
  );

  execSync(
    'xcrun simctl status_bar booted override --dataNetwork none --wifiMode inactive --wifiBars 0',
    {
      stdio: 'inherit',
    }
  );
  console.log('iOS visual airplane mode enabled (networking still active)');
}

function enableAirplaneMode() {
  try {
    // Detect platform - check if iOS simulator or Android emulator
    const isIOS =
      process.env.MAESTRO_PLATFORM === 'iOS' || process.env.SIMULATOR_UDID;

    if (isIOS) {
      if (ENABLE_REAL_NETWORK_ISOLATION) {
        const nlcEnabled = enableNetworkLinkConditioner();
        if (!nlcEnabled) {
          // Fallback to visual-only if NLC fails
          enableVisualAirplaneMode();
          // Exit with code 2 to indicate partial success (visual only)
          process.exit(2);
        }
      } else {
        enableVisualAirplaneMode();
        // Exit with code 2 to indicate visual-only mode
        process.exit(2);
      }
    } else {
      console.log('Enabling airplane mode on Android emulator...');
      const adbPrefix = process.env.ANDROID_SERIAL
        ? `adb -s ${process.env.ANDROID_SERIAL}`
        : 'adb';
      execSync(
        `${adbPrefix} shell svc wifi disable && ${adbPrefix} shell svc data disable`,
        {
          stdio: 'inherit',
          timeout: 15000,
        }
      );
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
