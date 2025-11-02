/**
 * Terms of Service Screen
 * Route: /settings/legal/terms
 * Requirements: 8.1, 8.2, 8.3
 */

import React from 'react';

import { LegalDocumentViewer } from '@/components/settings/legal-document-viewer';

export default function TermsScreen() {
  return <LegalDocumentViewer documentType="terms" />;
}
