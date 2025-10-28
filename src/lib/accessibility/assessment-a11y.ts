/**
 * Assessment Accessibility Utilities (Legacy Re-exports)
 *
 * @deprecated This file is maintained for backward compatibility.
 * Import from specific modules or the barrel export instead:
 * - Camera controls: '@/lib/accessibility/assessment-a11y-camera'
 * - Results & confidence: '@/lib/accessibility/assessment-a11y-results'
 * - Action plans: '@/lib/accessibility/assessment-a11y-actions'
 * - Status & CTAs: '@/lib/accessibility/assessment-a11y-status'
 * - Or use: '@/lib/accessibility' (barrel export)
 *
 * Requirements:
 * - Task 11.1: Comprehensive accessibility features
 * - Requirement 12: Accessible tooltips for confidence and taxonomy
 */

// Re-export all functions from the focused modules
export * from './assessment-a11y-actions';
export * from './assessment-a11y-camera';
export * from './assessment-a11y-results';
export * from './assessment-a11y-status';
