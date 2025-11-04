/**
 * Type declaration for react-test-renderer
 * Used in accessibility testing utilities
 */

declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestInstance {
    type: string | Function;
    props: Record<string, any>;
    parent: ReactTestInstance | null;
    children: (ReactTestInstance | string)[];
  }

  export interface ReactTestRenderer {
    toJSON(): any;
    toTree(): any;
    update(element: ReactElement): void;
    unmount(): void;
    getInstance(): any;
    root: ReactTestInstance;
  }

  export function create(
    element: ReactElement,
    options?: any
  ): ReactTestRenderer;

  export default { create };
}
