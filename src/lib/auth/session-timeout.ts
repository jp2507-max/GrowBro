import { AppState, type AppStateStatus } from 'react-native';

// Idle timeout configuration
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

let lastActivityTime = Date.now();
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let activityCheckId: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null;
let isInitialized = false;

/**
 * Updates the last activity timestamp
 */
export function updateActivity(): void {
  lastActivityTime = Date.now();
}

/**
 * Checks if the user has been idle for too long and signs them out if so
 */
function checkIdleTimeout(signOutCallback: () => void): void {
  const now = Date.now();
  const timeSinceLastActivity = now - lastActivityTime;

  if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
    console.log('Idle timeout reached, signing out user');
    signOutCallback();
    stopIdleTimeout();
  }
}

/**
 * Starts monitoring for idle timeout
 */
export function startIdleTimeout(signOutCallback: () => void): void {
  if (isInitialized) return;

  isInitialized = true;
  lastActivityTime = Date.now();

  // Check for idle timeout periodically
  activityCheckId = setInterval(
    () => checkIdleTimeout(signOutCallback),
    ACTIVITY_CHECK_INTERVAL_MS
  );

  // Listen to app state changes
  appStateSubscription = AppState.addEventListener(
    'change',
    (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Clear any pending background timeout and update activity time
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        updateActivity();
      } else if (nextAppState === 'background') {
        // Clear any existing timeout before scheduling a new one
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // App went to background, schedule a timeout check
        // This ensures we catch idle timeouts even when app is backgrounded
        timeoutId = setTimeout(() => {
          checkIdleTimeout(signOutCallback);
        }, IDLE_TIMEOUT_MS);
      } else if (nextAppState === 'inactive') {
        // Clear any pending background timeout when app becomes inactive
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    }
  );
}

/**
 * Stops idle timeout monitoring
 */
export function stopIdleTimeout(): void {
  if (activityCheckId) {
    clearInterval(activityCheckId);
    activityCheckId = null;
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  isInitialized = false;
}

/**
 * Gets the remaining idle time in milliseconds
 */
export function getRemainingIdleTime(): number {
  const now = Date.now();
  const timeSinceLastActivity = now - lastActivityTime;
  return Math.max(0, IDLE_TIMEOUT_MS - timeSinceLastActivity);
}

/**
 * Gets the idle timeout duration in milliseconds
 */
export function getIdleTimeoutDuration(): number {
  return IDLE_TIMEOUT_MS;
}
