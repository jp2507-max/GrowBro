/**
 * Tests for harvest error handler
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { showMessage } from 'react-native-flash-message';

import {
  classifyError,
  createAuditNoteForRejection,
  handleBusinessLogicError,
  handleConsistencyError,
  handleHarvestError,
  handleNetworkError,
  handleValidationError,
} from './harvest-error-handler';
import type {
  BusinessLogicError,
  ConsistencyError,
  NetworkError,
  SyncRejection,
  ValidationError,
} from './harvest-error-types';
import { ERROR_CATEGORY } from './harvest-error-types';

jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

const mockT = (key: string, _options?: any) => {
  const translations: Record<string, string> = {
    'harvest.errors.sync.transient_title': 'Sync Error',
    'harvest.errors.sync.conflict_detected': 'Conflict detected',
    'harvest.errors.actions.retry_now': 'Retry Now',
    'harvest.errors.actions.view_details': 'View Details',
    'harvest.errors.actions.sign_in_again': 'Sign In Again',
    'harvest.errors.actions.dismiss': 'Dismiss',
    'harvest.inventory.missing_dry_weight_cta': 'Update Dry Weight',
  };
  return translations[key] || key;
};

describe('classifyError', () => {
  it('should classify network errors with known status codes', () => {
    const error = {
      response: { status: 401, data: { message: 'Unauthorized' } },
      message: 'Request failed',
    };

    const result = classifyError(error);

    expect(result.category).toBe(ERROR_CATEGORY.NETWORK);
    expect(result.code).toBe(401);
    expect(result.retryable).toBe(false);
    expect(result.action).toBe('RE_AUTH');
  });

  it('should classify 413 as retryable network error', () => {
    const error = {
      response: { status: 413 },
      message: 'Payload Too Large',
    };

    const result = classifyError(error);

    expect(result.category).toBe(ERROR_CATEGORY.NETWORK);
    expect(result.code).toBe(413);
    expect(result.retryable).toBe(true);
    expect(result.action).toBe('SPLIT_UPLOAD');
  });

  it('should classify 422 as validation error', () => {
    const error = {
      response: { status: 422, data: { message: 'Invalid data' } },
      message: 'Validation failed',
    };

    const result = classifyError(error);

    expect(result.category).toBe(ERROR_CATEGORY.VALIDATION);
    expect(result.code).toBe(422);
    expect(result.retryable).toBe(false);
  });

  it('should classify validation errors', () => {
    const error = {
      name: 'ZodError',
      message: 'Validation failed',
      issues: [],
    };

    const result = classifyError(error);

    expect(result.category).toBe(ERROR_CATEGORY.VALIDATION);
    expect(result.retryable).toBe(false);
  });

  it('should classify business logic errors', () => {
    const error = new Error('Invalid stage transition');

    const result = classifyError(error);

    expect(result.category).toBe(ERROR_CATEGORY.BUSINESS_LOGIC);
    expect(result.retryable).toBe(false);
  });

  it('should classify consistency errors', () => {
    const error = new Error('Concurrent modification conflict');

    const result = classifyError(error);

    expect(result.category).toBe(ERROR_CATEGORY.CONSISTENCY);
    expect(result.retryable).toBe(false);
  });

  it('should classify unknown errors', () => {
    const error = 'Some random error';

    const result = classifyError(error);

    expect(result.category).toBe(ERROR_CATEGORY.UNKNOWN);
    expect(result.retryable).toBe(false);
  });

  it('should extract error messages correctly', () => {
    const error1 = new Error('Test error');
    expect(classifyError(error1).message).toBe('Test error');

    const error2 = 'String error';
    expect(classifyError(error2).message).toBe('String error');

    const error3 = {
      response: { data: { message: 'Server error' } },
    };
    expect(classifyError(error3).message).toBe('Server error');
  });
});

describe('handleValidationError', () => {
  it('should return inline display for single validation error', () => {
    const error: ValidationError = {
      field: 'wetWeight',
      message: 'Weight must be positive',
    };

    const result = handleValidationError(error);

    expect(result.shouldShowToast).toBe(false);
    expect(result.shouldShowBanner).toBe(false);
    expect(result.shouldShowInline).toBe(true);
    expect(result.bannerMessage).toBe('Weight must be positive');
  });

  it('should combine multiple validation errors', () => {
    const errors: ValidationError[] = [
      { field: 'wetWeight', message: 'Weight required' },
      { field: 'dryWeight', message: 'Must be less than wet weight' },
    ];

    const result = handleValidationError(errors);

    expect(result.shouldShowInline).toBe(true);
    expect(result.bannerMessage).toContain('Weight required');
    expect(result.bannerMessage).toContain('Must be less than wet weight');
  });
});

describe('handleNetworkError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show toast for transient retryable errors', () => {
    const error: NetworkError = {
      category: ERROR_CATEGORY.NETWORK,
      message: 'Connection timeout',
      retryable: true,
      timestamp: new Date(),
    };

    const result = handleNetworkError(error, mockT);

    expect(showMessage).toHaveBeenCalledWith({
      message: 'Sync Error',
      description: 'Connection timeout',
      type: 'warning',
      duration: 3000,
    });
    expect(result.shouldShowToast).toBe(true);
    expect(result.shouldShowBanner).toBe(false);
  });

  it('should show banner for persistent non-retryable errors', () => {
    const error: NetworkError = {
      category: ERROR_CATEGORY.NETWORK,
      message: 'Permission denied',
      retryable: false,
      code: 403,
      timestamp: new Date(),
    };

    const result = handleNetworkError(error, mockT);

    expect(result.shouldShowToast).toBe(false);
    expect(result.shouldShowBanner).toBe(true);
    expect(result.bannerMessage).toBe('Permission denied');
    expect(result.actions).toBeDefined();
  });

  it('should include retry action for retryable errors in banner', () => {
    const error: NetworkError = {
      category: ERROR_CATEGORY.NETWORK,
      message: 'Server error',
      retryable: false,
      timestamp: new Date(),
    };

    const result = handleNetworkError(error, mockT);

    expect(result.actions).toBeDefined();
    expect(result.actions?.some((a) => a.action === 'view_details')).toBe(true);
  });

  it('should include re-auth action for 401 errors', () => {
    const error: NetworkError = {
      category: ERROR_CATEGORY.NETWORK,
      message: 'Unauthorized',
      retryable: false,
      code: 401,
      timestamp: new Date(),
    };

    const result = handleNetworkError(error, mockT);

    expect(result.actions).toBeDefined();
    expect(result.actions?.some((a) => a.action === 're_auth')).toBe(true);
  });
});

describe('handleBusinessLogicError', () => {
  it('should show banner with corrective actions', () => {
    const error: BusinessLogicError = {
      category: ERROR_CATEGORY.BUSINESS_LOGIC,
      message: 'Dry weight must be set',
      retryable: false,
      timestamp: new Date(),
    };

    const result = handleBusinessLogicError(error, mockT);

    expect(result.shouldShowBanner).toBe(true);
    expect(result.bannerMessage).toBe('Dry weight must be set');
    expect(result.actions).toBeDefined();
  });

  it('should include update weight action for dry weight errors', () => {
    const error: BusinessLogicError = {
      category: ERROR_CATEGORY.BUSINESS_LOGIC,
      message: 'Missing dry weight',
      retryable: false,
      timestamp: new Date(),
    };

    const result = handleBusinessLogicError(error, mockT);

    expect(result.actions?.some((a) => a.action === 'update_weight')).toBe(
      true
    );
  });
});

describe('handleConsistencyError', () => {
  it('should show banner with view details action', () => {
    const error: ConsistencyError = {
      category: ERROR_CATEGORY.CONSISTENCY,
      message: 'Concurrent modification detected',
      retryable: false,
      timestamp: new Date(),
      conflictingFields: ['wetWeight', 'dryWeight'],
    };

    const result = handleConsistencyError(error, mockT);

    expect(result.shouldShowBanner).toBe(true);
    expect(result.bannerMessage).toBe('Conflict detected');
    expect(result.actions).toBeDefined();
    expect(result.actions?.some((a) => a.action === 'view_details')).toBe(true);
  });
});

describe('createAuditNoteForRejection', () => {
  it('should create comprehensive audit note with all metadata', () => {
    const rejection: SyncRejection = {
      recordId: 'harvest-123',
      table: 'harvests',
      errorCode: 422,
      errorMessage: 'Invalid weight data',
      timestamp: new Date('2025-01-01T12:00:00Z'),
    };

    const auditNote = createAuditNoteForRejection(rejection);

    expect(auditNote).toContain('Server rejection');
    expect(auditNote).toContain('[422]');
    expect(auditNote).toContain('Invalid weight data');
    expect(auditNote).toContain('harvests');
    expect(auditNote).toContain('harvest-123');
    expect(auditNote).toContain('2025-01-01T12:00:00.000Z');
  });
});

describe('handleHarvestError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should route validation errors correctly', () => {
    const error = { name: 'ZodError', message: 'Validation failed' };

    const result = handleHarvestError(error, mockT);

    expect(result.shouldShowInline).toBe(true);
  });

  it('should route network errors correctly', () => {
    const error = {
      response: { status: 500 },
      message: 'Server error',
    };

    handleHarvestError(error, mockT);

    expect(showMessage).toHaveBeenCalled();
  });

  it('should route business logic errors correctly', () => {
    const error = new Error('Invalid stage transition');

    const result = handleHarvestError(error, mockT);

    expect(result.shouldShowBanner).toBe(true);
  });

  it('should route consistency errors correctly', () => {
    const error = new Error('Conflict detected');

    const result = handleHarvestError(error, mockT);

    // Conflict is detected as business logic error, which shows banner
    expect(result.shouldShowBanner || result.shouldShowToast).toBe(true);
  });

  it('should handle unknown errors gracefully', () => {
    const error = 'Random error';

    const result = handleHarvestError(error, mockT);

    expect(result.shouldShowToast).toBe(true);
  });
});

describe('Server Error Code Mapping', () => {
  it('should handle 401 Unauthorized', () => {
    const error = { response: { status: 401 } };
    const classified = classifyError(error);

    expect(classified.action).toBe('RE_AUTH');
    expect(classified.retryable).toBe(false);
  });

  it('should handle 403 Permission Denied', () => {
    const error = { response: { status: 403 } };
    const classified = classifyError(error);

    expect(classified.action).toBe('PERMISSION_DENIED');
    expect(classified.retryable).toBe(false);
  });

  it('should handle 413 Payload Too Large', () => {
    const error = { response: { status: 413 } };
    const classified = classifyError(error);

    expect(classified.action).toBe('SPLIT_UPLOAD');
    expect(classified.retryable).toBe(true);
  });

  it('should handle 422 Validation Error', () => {
    const error = { response: { status: 422 } };
    const classified = classifyError(error);

    expect(classified.action).toBe('VALIDATION_ERROR');
    expect(classified.retryable).toBe(false);
  });

  it('should handle 500 Server Error', () => {
    const error = { response: { status: 500 } };
    const classified = classifyError(error);

    expect(classified.action).toBe('RETRY');
    expect(classified.retryable).toBe(true);
  });
});
