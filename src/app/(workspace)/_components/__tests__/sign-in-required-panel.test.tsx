import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { SignInRequiredPanel } from '../sign-in-required-panel'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Suppress jsdom "Not implemented: navigation" warnings
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn((...args) => {
    const firstArg = args[0]
    // Check if it's the jsdom navigation error
    if (
      (typeof firstArg === 'string' && firstArg.includes('Not implemented: navigation')) ||
      (firstArg instanceof Error && firstArg.message?.includes('Not implemented: navigation')) ||
      (typeof firstArg === 'object' && firstArg?.type === 'not implemented')
    ) {
      return // Suppress jsdom navigation warnings
    }
    originalConsoleError(...args)
  })
})

afterAll(() => {
  console.error = originalConsoleError
})

describe('SignInRequiredPanel', () => {
  let mockLocation: { href: string }

  beforeAll(() => {
    // Use real timers for userEvent to work properly
    jest.useRealTimers()
  })

  afterAll(() => {
    // Restore fake timers if needed
    jest.useFakeTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset cookies
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    })
    
    // Mock window.location.href - suppress jsdom errors
    mockLocation = { href: '' }
    delete (window as any).location
    window.location = mockLocation as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initial Rendering', () => {
    it('should render in sign-in mode by default', () => {
      render(<SignInRequiredPanel />)

      expect(screen.getByRole('heading', { name: /sign in to promptana/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
      expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument()
    })

    it('should display provided error message', () => {
      const errorMessage = 'Session expired. Please sign in again.'
      render(<SignInRequiredPanel errorMessage={errorMessage} />)

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(errorMessage)
    })

    it('should render all form fields in sign-in mode', () => {
      render(<SignInRequiredPanel />)

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    })
  })

  describe('Mode Switching', () => {
    it('should switch from sign-in to sign-up mode', async () => {
      render(<SignInRequiredPanel />)
      const user = userEvent.setup()

      const signUpLink = screen.getByRole('button', { name: /sign up/i })
      await user.click(signUpLink)

      expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument()
    })

    it('should switch from sign-up to sign-in mode', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      // Switch to sign-up
      await user.click(screen.getByRole('button', { name: /sign up/i }))
      
      // Switch back to sign-in
      await user.click(screen.getByRole('button', { name: /sign in$/i }))

      expect(screen.getByRole('heading', { name: /sign in to promptana/i })).toBeInTheDocument()
      expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument()
    })

    it('should clear errors when switching modes', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      // Trigger validation errors
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/email is required/i)).toBeInTheDocument()

      // Switch mode
      await user.click(screen.getByRole('button', { name: /sign up/i }))

      // Errors should be cleared
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
    })

    it('should clear password fields when switching modes', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'mypassword123')

      // Switch to sign-up
      await user.click(screen.getByRole('button', { name: /sign up/i }))

      // Password should be cleared
      const newPasswordInput = screen.getByLabelText(/^password$/i)
      expect(newPasswordInput).toHaveValue('')
    })
  })

  describe('Email Validation', () => {
    it('should show error for empty email', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true')
    })

    it('should show error for invalid email format', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'invalid-email')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument()
    })

    it('should accept valid email formats', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'user@example.com')

      // Should not show email error (will show password error instead)
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
    })

    it('should clear email error when user starts typing', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      // Trigger validation
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/email is required/i)).toBeInTheDocument()

      // Start typing
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'u')

      // Error should be cleared
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
    })
  })

  describe('Password Validation', () => {
    it('should show error for empty password', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'user@example.com')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('aria-invalid', 'true')
    })

    it('should show error for password shorter than 6 characters', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, '12345')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument()
    })

    it('should accept password with 6 or more characters', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'fake-token', refreshToken: 'fake-refresh' }),
      })

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, '123456')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.queryByText(/password must be at least 6 characters/i)).not.toBeInTheDocument()
    })

    it('should clear password error when user starts typing', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'user@example.com')

      // Trigger validation
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/password is required/i)).toBeInTheDocument()

      // Start typing
      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'a')

      // Error should be cleared
      expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument()
    })
  })

  describe('Confirm Password Validation (Sign-Up Mode)', () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)
      
      // Switch to sign-up mode
      await user.click(screen.getByRole('button', { name: /sign up/i }))
    })

    it('should show error for empty confirm password', async () => {
      const user = userEvent.setup()

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      expect(screen.getByText(/please confirm your password/i)).toBeInTheDocument()
    })

    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup()

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password456')

      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    it('should accept matching passwords', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: '', refreshToken: null }),
      })

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument()
    })

    it('should clear confirm password error when user starts typing', async () => {
      const user = userEvent.setup()

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      // Trigger validation
      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      expect(screen.getByText(/please confirm your password/i)).toBeInTheDocument()

      // Start typing
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      await user.type(confirmPasswordInput, 'p')

      // Error should be cleared
      expect(screen.queryByText(/please confirm your password/i)).not.toBeInTheDocument()
    })
  })

  describe('Form Submission - Sign In', () => {
    it('should not submit when validation fails', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should call login API with correct credentials', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'fake-token', refreshToken: 'fake-refresh' }),
      })

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
        })
      })
    })

    it('should display error message on failed sign-in', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Invalid credentials' } }),
      })

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'wrongpassword')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
    })

    it('should display default error message when response has no error details', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/sign-in failed. please check your credentials and try again/i)).toBeInTheDocument()
      })
    })

    it('should handle network errors during sign-in', async () => {
      const user = userEvent.setup()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/couldn't sign you in due to a network error/i)).toBeInTheDocument()
      })
    })

    it('should disable form during submission', async () => {
      const user = userEvent.setup()
      mockFetch.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toHaveTextContent(/signing in/i)
        expect(submitButton).toBeDisabled()
        expect(emailInput).toBeDisabled()
        expect(passwordInput).toBeDisabled()
      })
    })
  })

  describe('Form Submission - Sign Up', () => {
    it('should call signup API with correct credentials', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: '', refreshToken: null }),
      })

      render(<SignInRequiredPanel />)

      // Switch to sign-up mode
      await user.click(screen.getByRole('button', { name: /sign up/i }))

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(emailInput, 'newuser@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/signup', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newuser@example.com', password: 'password123' }),
        })
      })
    })

    it('should show email confirmation message when accessToken is empty', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: '', refreshToken: null }),
      })

      render(<SignInRequiredPanel />)

      // Switch to sign-up mode
      await user.click(screen.getByRole('button', { name: /sign up/i }))

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(emailInput, 'newuser@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/account created! please check your email/i)).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /sign in to promptana/i })).toBeInTheDocument()
      })
    })

    it('should display error message on failed sign-up', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Email already exists' } }),
      })

      render(<SignInRequiredPanel />)

      // Switch to sign-up mode
      await user.click(screen.getByRole('button', { name: /sign up/i }))

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(emailInput, 'existing@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
      })
    })

    it('should handle network errors during sign-up', async () => {
      const user = userEvent.setup()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<SignInRequiredPanel />)

      // Switch to sign-up mode
      await user.click(screen.getByRole('button', { name: /sign up/i }))

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

      await user.type(emailInput, 'newuser@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/couldn't create your account due to a network error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed JSON response gracefully', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/sign-in failed. please check your credentials and try again/i)).toBeInTheDocument()
      })
    })

    it('should handle whitespace-only email as invalid', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, '   ')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })

    it('should handle whitespace-only password as invalid', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, '      ')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })

    it('should show multiple validation errors simultaneously', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      // Switch to sign-up mode
      await user.click(screen.getByRole('button', { name: /sign up/i }))

      // Submit without filling anything
      const submitButton = screen.getByRole('button', { name: /^create account$/i })
      await user.click(submitButton)

      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      expect(screen.getByText(/please confirm your password/i)).toBeInTheDocument()
    })

    it('should only set refresh token cookie when provided', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'fake-token', refreshToken: null }),
      })

      render(<SignInRequiredPanel />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      await user.type(emailInput, 'user@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(document.cookie).toContain('sb-access-token=fake-token')
        expect(document.cookie).not.toContain('sb-refresh-token')
      })
    })

    it('should accept email with various valid formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@subdomain.example.com',
      ]

      for (const email of validEmails) {
        const user = userEvent.setup()
        const { unmount } = render(<SignInRequiredPanel />)

        const emailInput = screen.getByLabelText(/email/i)
        await user.type(emailInput, email)

        const submitButton = screen.getByRole('button', { name: /^sign in$/i })
        await user.click(submitButton)

        expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument()

        unmount()
      }
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on form fields with errors', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)

      expect(emailInput).toHaveAttribute('aria-invalid', 'true')
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error')
      expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
      expect(passwordInput).toHaveAttribute('aria-describedby', 'password-error')
    })

    it('should have status region with live announcements', () => {
      render(<SignInRequiredPanel errorMessage="Test error" />)

      const statusRegion = screen.getByRole('status')
      expect(statusRegion).toHaveAttribute('aria-live', 'polite')
      expect(statusRegion).toHaveTextContent('Test error')
    })

    it('should clear ARIA error attributes when error is resolved', async () => {
      const user = userEvent.setup()
      render(<SignInRequiredPanel />)

      // Trigger error
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })
      await user.click(submitButton)

      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('aria-invalid', 'true')

      // Fix error
      await user.type(emailInput, 'u')

      // ARIA attributes should still exist but error message should be gone
      await waitFor(() => {
        expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
      })
    })
  })
})

