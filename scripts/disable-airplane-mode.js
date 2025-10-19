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
    // Detect which Settings app to use (same approach as enable script)
    let systemAppName;
    try {
      execSync(
        'mdfind -name "System Settings.app" | grep -q "System Settings"',
        { stdio: 'pipe', timeout: 2000 }
      );
      systemAppName = 'System Settings';
    } catch {
      systemAppName = 'System Preferences';
    }

    const appleScript = `
      tell application "${systemAppName}"
        activate
        reveal pane "Network Link Conditioner"
        delay 2
      end tell

      tell application "System Events"
        tell process "${systemAppName}"
          repeat 10 times
            if exists window "Network Link Conditioner" then
              exit repeat
            end if
            delay 0.5
          end repeat
          tell window "Network Link Conditioner"
            repeat 3 times
              try
                click button "Off"
                exit repeat
              on error
                try
                  click checkbox 1
                  exit repeat
                on error
                  try
                    set theToggle to first UI element whose (role is "AXCheckBox" or (role is "AXButton" and name is "Off"))
                    click theToggle
                    exit repeat
                  on error
                    delay 0.5
                  end try
                end try
              end try
            end repeat
          end tell
        end tell
      end tell

      tell application "${systemAppName}" to quit
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
      const deviceId = process.env.ANDROID_SERIAL || '';
      const deviceArg = deviceId ? `-s ${deviceId}` : '';
      execSync(
        `adb ${deviceArg} shell svc wifi enable && adb ${deviceArg} shell svc data enable`,
        {
          stdio: 'inherit',
          timeout: 5000,
        }
      );
      console.log('Android airplane mode disabled');
    }
    return true;
  } catch (error) {
    console.error('Failed to disable airplane mode:', error.message);
    return false;
  }
}

if (require.main === module) {
  const success = disableAirplaneMode();
  if (!success) process.exit(1);
}

module.exports = { disableAirplaneMode };
