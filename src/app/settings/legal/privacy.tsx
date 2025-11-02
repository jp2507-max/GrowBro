/**
 * Privacy Policy Screen
 * Route: /settings/legal/privacy
 * Requirements: 8.1, 8.2, 8.3
 */

import React from 'react';

import { LegalDocumentViewer } from '@/components/settings/legal-document-viewer';

export default function PrivacyScreen() {
  return <LegalDocumentViewer documentType="privacy" />;
}
