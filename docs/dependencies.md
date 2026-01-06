# Project Dependencies

This document tracks specialized or pre-release dependencies used in GrowBro, including rationales for their use and stability plans.

## @expo/ui (0.2.0-beta.9)

Referenced in `package.json` at line 95.

### Rationale

This pre-release version of `@expo/ui` is required to support **NativeTabs** (currenty via `expo-router/unstable-native-tabs`). It provides:

- **Native-driven Tab Bar**: Highly performant native tab implementations for iOS and Android.
- **Liquid Glass Effect**: Supports the premium iOS aesthetic requirements of the project.
- **Minimize-on-Scroll**: Native behavior where the tab bar minimizes during scroll actions, maximizing screen real estate.
- **Target OS Support**: Experimental support for features appearing in modern iOS environments.

### Testing and Validation

- **Manual UI Checks**: Extensive testing of tab transitions, icon rendering (SF Symbols), and layout stability on iOS and Android simulators/devices.
- **Maestro E2E**: Navigation flows using the tab bar are covered in the `.maestro/` test suite.
- **Supported Versions**: Validated with Expo SDK 54 and React Native 0.81.5.
- **Known Regressions**: None currently identified; performance is superior to the previous JS-based custom tab implementation.

### Migration and Rollback Plan

- **Upstream Tracking**: We track the [expo/ui](https://github.com/expo/ui) repository and Expo SDK releases for updates.
- **Transition to Stable**: We will migrate to a stable release as soon as it is officially promoted by the Expo team and included in the main `expo` package or stable `expo-router` dependencies.
- **Rollback Strategy**: In the event of critical failures or breaking changes in the beta that cannot be resolved:
  1. Revert to the legacy custom tab bar component (`@/components/navigation/custom-tab-bar`).
  2. Restore standard `expo-router` tab configuration in `src/app/(app)/_layout.tsx`.
  3. Remove `@expo/ui` from `package.json`.
