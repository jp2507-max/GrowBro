#!/usr/bin/env node
const { execSync } = require('child_process');

// Configuration: Should match the enable script configuration
const ENABLE_REAL_NETWORK_ISOLATION =
  process.env.ENABLE_REAL_NETWORK_ISOLATION === 'true';

function disableNetworkLinkConditioner() {
  try {
    console.log('Attempting to disable Network Link Conditioner...');

    // Check common install locations for Network Link Conditioner
    execSync(
      '[ -e "/Library/PreferencePanes/Network Link Conditioner.prefPane" ] || [ -e "/System/Library/PreferencePanes/NetworkLinkConditioner.prefPane" ]',
      { stdio: 'pipe', timeout: 2000 }
    );

    // Use AppleScript to disable Network Link Conditioner
    const appleScript = `
      tell application "System Preferences"
        activate
        reveal pane "Network Link Conditioner"
        delay 1
      end tell

      tell application "System Events"
        tell process "System Preferences"
          tell window "Network Link Conditioner"
            click button "Off"
          end tell
        end tell
      end tell

      tell application "System Preferences" to quit
    `;

    // Try to open prefPane first to normalize UI across macOS versions
    try {
      execSync(
        'open "/Library/PreferencePanes/Network Link Conditioner.prefPane"',
        { stdio: 'ignore' }
      );
    } catch {}
    try {
      execSync(
        'open "/System/Library/PreferencePanes/NetworkLinkConditioner.prefPane"',
        { stdio: 'ignore' }
      );
    } catch {}
    execSync(`osascript -e '${appleScript}'`, {
      stdio: 'pipe',
      timeout: 15000,
    });
    console.log('Network Link Conditioner disabled');
    return true;
  } catch (error) {
    console.warn(
      'Network Link Conditioner not available or failed to disable:',
      error.message
    );
    console.warn('Attempting to clear visual status bar changes instead');
    return false;
  }
}

function disableVisualAirplaneMode() {
  console.log('Disabling visual airplane mode on iOS simulator...');
  const udid = process.env.SIMULATOR_UDID || 'booted';
  execSync(`xcrun simctl status_bar ${udid} clear`, {
    stdio: 'inherit',
    timeout: 5000,
  });
  console.log('iOS visual airplane mode disabled');
}

function disableAirplaneMode() {
  try {
    // Detect platform - check if iOS simulator or Android emulator
    const isIOS =
      process.env.MAESTRO_PLATFORM === 'iOS' || process.env.SIMULATOR_UDID;

    if (isIOS) {
      if (ENABLE_REAL_NETWORK_ISOLATION) {
        const nlcDisabled = disableNetworkLinkConditioner();
        if (!nlcDisabled) {
          // Fallback to clearing visual status bar
          disableVisualAirplaneMode();
        }
      } else {
        disableVisualAirplaneMode();
      }
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
