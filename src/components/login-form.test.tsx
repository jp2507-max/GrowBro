import React from 'react';
import { Pressable, Text } from 'react-native';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import type { LoginFormProps } from './login-form';
import { LoginForm } from './login-form';

const hasPlayServicesMock = jest.fn().mockResolvedValue(true);
const googleSignInMock = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => ({
  __esModule: true,
  GoogleSignin: {
    hasPlayServices: hasPlayServicesMock,
    signIn: googleSignInMock,
  },
  GoogleSigninButton: ({ onPress, testID }: any) => (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button">
      <Text>Google Sign-In</Text>
    </Pressable>
  ),
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: jest.fn(() => false),
}));

let showErrorMessageSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  const lib = require('@/lib');
  showErrorMessageSpy = jest
    .spyOn(lib, 'showErrorMessage')
    .mockImplementation(jest.fn());
});

afterEach(() => {
  cleanup();
  showErrorMessageSpy.mockRestore();
});

const onSubmitMock: jest.Mock<LoginFormProps['onSubmit']> = jest.fn();

describe('LoginForm Form ', () => {
  it('renders correctly', async () => {
    setup(<LoginForm />);
    expect(await screen.findByTestId('form-title')).toBeOnTheScreen();
  });

  it('should display required error when values are empty', async () => {
    const { user } = setup(<LoginForm />);

    const button = screen.getByTestId('login-button');
    expect(screen.queryByText(/Email is required/i)).not.toBeOnTheScreen();
    await user.press(button);
    expect(await screen.findByText(/Email is required/i)).toBeOnTheScreen();
    expect(screen.getByText(/Password is required/i)).toBeOnTheScreen();
  });

  it('should display matching error when email is invalid', async () => {
    const { user } = setup(<LoginForm />);

    const button = screen.getByTestId('login-button');
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');

    await user.type(emailInput, 'yyyyy');
    await user.type(passwordInput, 'test');
    await user.press(button);

    expect(await screen.findByText(/Invalid Email Format/i)).toBeOnTheScreen();
    expect(screen.queryByText(/Email is required/i)).not.toBeOnTheScreen();
  });

  it('Should call LoginForm with correct values when values are valid', async () => {
    const { user } = setup(<LoginForm onSubmit={onSubmitMock} />);

    const button = screen.getByTestId('login-button');
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');

    await user.type(emailInput, 'youssef@gmail.com');
    await user.type(passwordInput, 'password');
    await user.press(button);
    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
    });
    // expect.objectContaining({}) because we don't want to test the target event we are receiving from the onSubmit function
    expect(onSubmitMock).toHaveBeenCalledWith(
      {
        email: 'youssef@gmail.com',
        password: 'password',
      },
      expect.objectContaining({})
    );
  });

  it('should start Google sign-in and show error on missing token', async () => {
    googleSignInMock.mockResolvedValueOnce({
      type: 'success',
      data: { idToken: null },
    });

    const { user } = setup(<LoginForm />);

    const googleButton = screen.getByTestId('google-sign-in-button');

    await user.press(googleButton);

    await waitFor(() => {
      expect(showErrorMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('Google')
      );
    });

    expect(hasPlayServicesMock).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: true,
    });
    expect(googleSignInMock).toHaveBeenCalled();
  });
});
