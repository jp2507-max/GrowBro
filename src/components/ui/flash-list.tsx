import { FlashList as FlashListComponent } from '@shopify/flash-list';
import { cssInterop } from 'nativewind';

export const FlashList = cssInterop(FlashListComponent, {
  contentContainerClassName: {
    target: 'contentContainerStyle',
  },
});
