// Mock react-native-css-interop for tests
// This prevents issues with CSS interop trying to process components that don't have displayName

export function cssInterop(Component: any, _config?: any): any {
  // Ensure component has displayName for React DevTools
  if (Component) {
    if (!Component.displayName) {
      Component.displayName = Component.name || 'Component';
    }
  }
  return Component;
}

export function rem(value: number): number {
  return value * 16;
}

export function vh(value: number): number {
  return value;
}

export function vw(value: number): number {
  return value;
}

export function vmin(value: number): number {
  return value;
}

export function vmax(value: number): number {
  return value;
}

export function createInteropElement(Component: any): any {
  // Defensive checks for Component existence and type
  if (!Component) {
    throw new Error('createInteropElement: Component is null or undefined');
  }

  if (typeof Component !== 'function' && typeof Component !== 'object') {
    throw new Error(
      'createInteropElement: Component must be a function or object'
    );
  }

  // Ensure component has displayName with proper fallbacks
  if (!Component.displayName) {
    Component.displayName =
      Component.name || Component.constructor?.name || 'UnknownComponent';
  }

  return Component;
}

// Mock any other exports that might be used
export default {
  cssInterop,
  rem,
  vh,
  vw,
  vmin,
  vmax,
  createInteropElement,
};
