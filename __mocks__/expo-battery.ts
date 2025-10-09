/**
 * Mock for expo-battery
 */

export enum BatteryState {
  UNKNOWN = 0,
  UNPLUGGED = 1,
  CHARGING = 2,
  FULL = 3,
}

export const getPowerStateAsync = jest.fn();
export const getBatteryLevelAsync = jest.fn();
export const getBatteryStateAsync = jest.fn();
export const isLowPowerModeEnabledAsync = jest.fn();

export default {
  BatteryState,
  getPowerStateAsync,
  getBatteryLevelAsync,
  getBatteryStateAsync,
  isLowPowerModeEnabledAsync,
};
