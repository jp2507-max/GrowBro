import { create } from 'zustand';

import type { CSVImportPreview } from '@/lib/inventory/types/csv';
import { createSelectors } from '@/lib/utils';

interface ImportPreviewState {
  fileName?: string;
  data: CSVImportPreview | null;
  setPreview: (payload: { fileName: string; data: CSVImportPreview }) => void;
  clearPreview: () => void;
}

const _useImportPreviewStore = create<ImportPreviewState>((set) => ({
  fileName: undefined,
  data: null,
  setPreview: ({ fileName, data }) => set({ fileName, data }),
  clearPreview: () => set({ fileName: undefined, data: null }),
}));

export const useImportPreviewStore = createSelectors(_useImportPreviewStore);
