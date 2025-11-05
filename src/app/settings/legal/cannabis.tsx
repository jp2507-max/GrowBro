/**
 * Cannabis Policy Screen
 * Route: /settings/legal/cannabis
 * Requirements: 8.1, 8.2, 8.3
 */

import React from 'react';

import { LegalDocumentViewer } from '@/components/settings/legal-document-viewer';

export default function CannabisScreen() {
  return <LegalDocumentViewer documentType="cannabis" />;
}
