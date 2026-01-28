import React from 'react';

// Import after mocking
import AddInventoryItemScreen from '@/app/(app)/inventory/add';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

afterEach(cleanup);

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  setParams: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const mockCreateInventoryItem = jest.fn();
jest.mock('@/lib/inventory/inventory-item-service', () => ({
  createInventoryItem: mockCreateInventoryItem,
}));

describe('AddInventoryItemScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateInventoryItem.mockResolvedValue({ success: true });
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(<AddInventoryItemScreen />);
      expect(
        await screen.findByTestId('add-inventory-item-screen')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('name-input')).toBeOnTheScreen();
      expect(screen.getByTestId('category-Nutrients')).toBeOnTheScreen();
      expect(screen.getByTestId('unit-input')).toBeOnTheScreen();
      expect(screen.getByTestId('min-stock-input')).toBeOnTheScreen();
      expect(screen.getByTestId('reorder-multiple-input')).toBeOnTheScreen();
      expect(screen.getByTestId('lead-time-input')).toBeOnTheScreen();
      expect(screen.getByTestId('sku-input')).toBeOnTheScreen();
      expect(screen.getByTestId('barcode-input')).toBeOnTheScreen();
      expect(screen.getByTestId('submit-button')).toBeOnTheScreen();
    });

    test('displays form header with cancel button', async () => {
      const { user } = setup(<AddInventoryItemScreen />);
      const cancelButton = screen.getByTestId('cancel-button');
      expect(cancelButton).toBeOnTheScreen();

      await user.press(cancelButton);
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form Interactions', () => {
    test('allows typing in SKU and barcode fields', async () => {
      const { user } = setup(<AddInventoryItemScreen />);

      const skuInput = screen.getByTestId('sku-input');
      const barcodeInput = screen.getByTestId('barcode-input');

      await user.type(skuInput, 'TEST-SKU-123');
      await user.type(barcodeInput, '123456789012');

      expect(skuInput).toHaveProp('value', 'TEST-SKU-123');
      expect(barcodeInput).toHaveProp('value', '123456789012');
    });
  });

  describe('Form Validation', () => {
    test('shows validation error for empty name', async () => {
      const { user } = setup(<AddInventoryItemScreen />);

      const unitInput = screen.getByTestId('unit-input');
      await user.type(unitInput, 'kg');

      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeOnTheScreen();
      });
    });

    test('shows validation error for empty unit', async () => {
      const { user } = setup(<AddInventoryItemScreen />);

      const nameInput = screen.getByTestId('name-input');
      await user.type(nameInput, 'Test Item');

      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Unit is required')).toBeOnTheScreen();
      });
    });
  });

  describe('SKU and Barcode Fields', () => {
    test('renders optional SKU and barcode fields', async () => {
      setup(<AddInventoryItemScreen />);

      const skuInput = screen.getByTestId('sku-input');
      const barcodeInput = screen.getByTestId('barcode-input');

      expect(skuInput).toBeOnTheScreen();
      expect(barcodeInput).toBeOnTheScreen();

      // Check placeholders
      expect(skuInput).toHaveProp(
        'placeholder',
        'inventory.form.sku_placeholder'
      );
      expect(barcodeInput).toHaveProp(
        'placeholder',
        'inventory.form.barcode_placeholder'
      );
    });
  });

  describe('Server Validation Errors', () => {
    test('maps server validation errors to form fields and clears global error', async () => {
      const { user } = setup(<AddInventoryItemScreen />);

      // Mock server validation errors
      mockCreateInventoryItem.mockResolvedValue({
        success: false,
        validationErrors: [
          { field: 'name', message: 'Name is required from server', value: '' },
          {
            field: 'sku',
            message: 'SKU already exists',
            value: 'DUPLICATE-SKU',
          },
        ],
        error: 'Validation failed',
      });

      // Fill required fields except name
      const unitInput = screen.getByTestId('unit-input');
      await user.type(unitInput, 'kg');

      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      // Wait for validation errors to appear
      await waitFor(() => {
        expect(
          screen.getByText('Name is required from server')
        ).toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(screen.getByText('SKU already exists')).toBeOnTheScreen();
      });

      // Global error should be cleared since field errors are present
      const globalErrorContainer = screen.queryByTestId(
        'global-error-container'
      );
      expect(globalErrorContainer).toBeNull();
    });

    test('shows global error when no field-specific validation errors', async () => {
      const { user } = setup(<AddInventoryItemScreen />);

      // Mock server error without validation errors
      mockCreateInventoryItem.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      // Fill required fields
      const nameInput = screen.getByTestId('name-input');
      await user.type(nameInput, 'Test Item');

      const unitInput = screen.getByTestId('unit-input');
      await user.type(unitInput, 'kg');

      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      // Wait for global error to appear
      await waitFor(() => {
        expect(
          screen.getByText('Database connection failed')
        ).toBeOnTheScreen();
      });
    });

    test('clears previous field errors before setting new ones', async () => {
      const { user } = setup(<AddInventoryItemScreen />);

      // First submission - mock validation errors
      mockCreateInventoryItem.mockResolvedValueOnce({
        success: false,
        validationErrors: [
          { field: 'name', message: 'First error', value: 'Test Item' },
        ],
      });

      // Fill required fields
      const nameInput = screen.getByTestId('name-input');
      await user.type(nameInput, 'Test Item');

      const unitInput = screen.getByTestId('unit-input');
      await user.type(unitInput, 'kg');

      const submitButton = screen.getByTestId('submit-button');
      await user.press(submitButton);

      // Wait for first error
      await waitFor(() => {
        expect(screen.getByText('First error')).toBeOnTheScreen();
      });

      // Second submission - different validation errors
      mockCreateInventoryItem.mockResolvedValueOnce({
        success: false,
        validationErrors: [
          { field: 'unitOfMeasure', message: 'Second error', value: 'kg' },
        ],
      });

      await user.press(submitButton);

      // First error should be cleared, second error should appear
      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(screen.getByText('Second error')).toBeOnTheScreen();
      });
    });
  });
});
