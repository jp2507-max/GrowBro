#!/usr/bin/env node
const { execSync } = require('child_process');

// Configuration: Set to true to attempt real network isolation via Network Link Conditioner
// Falls back to visual-only status bar changes if NLC is unavailable
const ENABLE_REAL_NETWORK_ISOLATION =
  process.env.ENABLE_REAL_NETWORK_ISOLATION === 'true';

// Status constants for airplane mode operations
const AIRPLANE_MODE_STATUS = {
  FULL_SUCCESS: 'full-success',
  PARTIAL_SUCCESS: 'partial-success',
  FAILURE: 'failure',
};

function enableNetworkLinkConditioner() {
  try {
    console.log(
      'Attempting to enable Network Link Conditioner with "100% Loss" profile...'
    );

    // Check if Network Link Conditioner preference pane exists
    execSync(
      '[ -e "/Library/PreferencePanes/Network Link Conditioner.prefPane" ] || [ -e "/System/Library/PreferencePanes/Network Link Conditioner.prefPane" ] || [ -e "$HOME/Library/PreferencePanes/Network Link Conditioner.prefPane" ]',
      { stdio: 'pipe', timeout: 5000 }
    );

    // Detect macOS version and determine correct app name
    let systemAppName;
    try {
      // Check if System Settings exists (Ventura+)
      execSync(
        'mdfind -name "System Settings.app" | grep -q "System Settings"',
        { stdio: 'pipe' }
      );
      systemAppName = 'System Settings';
    } catch {
      systemAppName = 'System Preferences';
    }

    // Use AppleScript to enable Network Link Conditioner with "100% Loss" profile
    const appleScript = `
      -- Pre-open Network Link Conditioner prefPane to initialize UI
      tell application "${systemAppName}"
        activate
        reveal pane "Network Link Conditioner"
        delay 2
      end tell

      tell application "System Events"
        tell process "${systemAppName}"
          -- Wait for window to appear with timeout
          set maxWaitTime to 10
          set waitTime to 0
          repeat while (count of windows) < 1 and waitTime < maxWaitTime
            delay 0.5
            set waitTime to waitTime + 0.5
          end repeat

          if (count of windows) < 1 then
            error "Network Link Conditioner window did not appear within 10 seconds"
          end if

          tell window "Network Link Conditioner"
            -- Check if "On" button exists and click it
            if exists button "On" then
              click button "On"
              delay 1
            else if exists button "Off" then
              -- Already on, no need to click
            else
              error "Could not find On/Off button in Network Link Conditioner"
            end if

            -- Check if pop up button exists
            if exists pop up button 1 then
              tell pop up button 1
                click
                delay 1

                -- Check if "100% Loss" menu item exists
                if exists menu item "100% Loss" of menu 1 then
                  click menu item "100% Loss" of menu 1
                  delay 1
                else
                  error "Could not find '100% Loss' profile in Network Link Conditioner menu"
                end if
              end tell
            else
              error "Could not find profile selection pop up button in Network Link Conditioner"
            end if
          end tell
        end tell
      end tell

      tell application "${systemAppName}" to quit
    `;

    execSync(`osascript -e '${appleScript}'`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log('Network Link Conditioner enabled with "100% Loss" profile');
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

  const udid = process.env.SIMULATOR_UDID || 'booted';
  execSync(
    `xcrun simctl status_bar ${udid} override --dataNetwork none --wifiMode inactive --wifiBars 0`,
    {
      stdio: 'inherit',
      timeout: 5000,
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
          return AIRPLANE_MODE_STATUS.PARTIAL_SUCCESS;
        }
        // NLC succeeded, return full success
        return AIRPLANE_MODE_STATUS.FULL_SUCCESS;
      } else {
        enableVisualAirplaneMode();
        return AIRPLANE_MODE_STATUS.PARTIAL_SUCCESS;
      }
    } else {
      console.log('Enabling airplane mode on Android emulator...');
      const deviceId = process.env.ANDROID_SERIAL || '';
      const deviceArg = deviceId ? `-s ${deviceId}` : '';
      execSync(
        `adb ${deviceArg} shell svc wifi disable && adb ${deviceArg} shell svc data disable`,
        {
          stdio: 'inherit',
          timeout: 5000,
        }
      );
      console.log('Android airplane mode enabled');
      return AIRPLANE_MODE_STATUS.FULL_SUCCESS;
    }
  } catch (error) {
    console.error('Failed to enable airplane mode:', error.message);
    return AIRPLANE_MODE_STATUS.FAILURE;
  }
}

if (require.main === module) {
  const status = enableAirplaneMode();
  if (status === AIRPLANE_MODE_STATUS.FAILURE) {
    process.exit(1);
  } else if (status === AIRPLANE_MODE_STATUS.PARTIAL_SUCCESS) {
    process.exit(2);
  } else {
    // FULL_SUCCESS - exit with code 0 (success)
    process.exit(0);
  }
}

module.exports = { enableAirplaneMode };
