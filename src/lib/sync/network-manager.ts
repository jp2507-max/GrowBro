import NetInfo from '@react-native-community/netinfo';

export async function canSyncLargeFiles(): Promise<boolean> {
  try {
    const networkState = await NetInfo.fetch();

    // Allow large file sync on WiFi or Ethernet
    if (networkState.type === 'wifi' || networkState.type === 'ethernet') {
      return true;
    }

    // Allow on cellular only if connection is good (4G/LTE or better)
    if (networkState.type === 'cellular') {
      // Note: NetInfo doesn't provide detailed cellular generation info
      // This is a basic implementation - you might want to enhance this
      // based on your specific requirements
      return networkState.isConnected && !networkState.isInternetReachable;
    }

    // Deny on unknown or poor connections
    return false;
  } catch (error) {
    // If we can't determine network state, err on the side of caution
    console.warn('Failed to check network state for large file sync:', error);
    return false;
  }
}
