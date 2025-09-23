export async function requestPermissionsAsync(): Promise<{
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  granted: boolean;
}> {
  return { status: 'granted', canAskAgain: false, granted: true };
}

export async function getPermissionsAsync(): Promise<{
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  granted: boolean;
}> {
  return { status: 'granted', canAskAgain: false, granted: true };
}
