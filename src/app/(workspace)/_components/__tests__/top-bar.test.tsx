import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { TopBar } from '../top-bar'
import { useAuthContext } from '../../_auth/auth-context'
import { useOfflineContext } from '../../_contexts/offline-context'
import { useGlobalMessagesContext } from '../../_contexts/global-messages-context'

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock auth context
jest.mock('../../_auth/auth-context', () => ({
  useAuthContext: jest.fn(),
}))

// Mock offline context
jest.mock('../../_contexts/offline-context', () => ({
  useOfflineContext: jest.fn(),
}))

// Mock global messages context
jest.mock('../../_contexts/global-messages-context', () => ({
  useGlobalMessagesContext: jest.fn(),
}))

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Suppress jsdom "Not implemented: navigation" warnings
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn((...args) => {
    const firstArg = args[0]
    if (
      (typeof firstArg === 'string' && firstArg.includes('Not implemented: navigation')) ||
      (firstArg instanceof Error && firstArg.message?.includes('Not implemented: navigation')) ||
      (typeof firstArg === 'object' && firstArg?.type === 'not implemented')
    ) {
      return
    }
    originalConsoleError(...args)
  })
})

afterAll(() => {
  console.error = originalConsoleError
})

describe('TopBar', () => {
  let mockRouter: any
  let mockPush: jest.Mock
  let mockAddMessage: jest.Mock
  let mockLocation: { href: string }

  beforeAll(() => {
    jest.useRealTimers()

    // Mock window.location once for all tests
    mockLocation = { href: '' }
    delete (window as any).location
    ;(window as any).location = mockLocation
  })

  afterAll(() => {
    jest.useFakeTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset location href for each test
    mockLocation.href = ''

    // Setup router mock
    mockPush = jest.fn()
    mockRouter = {
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)

    // Setup pathname mock (default to /prompts)
    ;(usePathname as jest.Mock).mockReturnValue('/prompts')

    // Setup search params mock (default to empty)
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())

    // Setup auth context mock
    ;(useAuthContext as jest.Mock).mockReturnValue({
      user: { email: 'test@example.com', id: '123' },
      status: 'authenticated',
    })

    // Setup offline context mock (default to online)
    ;(useOfflineContext as jest.Mock).mockReturnValue({
      isOffline: false,
      lastChangedAt: null,
    })

    // Setup global messages context mock
    mockAddMessage = jest.fn()
    ;(useGlobalMessagesContext as jest.Mock).mockReturnValue({
      addMessage: mockAddMessage,
      messages: [],
      removeMessage: jest.fn(),
      addErrorFromApi: jest.fn(),
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initial Rendering', () => {
    it('should render the header with branding', () => {
      render(<TopBar />)

      expect(screen.getByText('Promptana')).toBeInTheDocument()
    })

    it('should display user email', () => {
      render(<TopBar />)

      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('should render search form with placeholder', () => {
      render(<TopBar />)

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveValue('')
    })

    it('should render sign out button', () => {
      render(<TopBar />)

      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    })

    it('should initialize search query from URL params', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('q', 'test query')
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)

      render(<TopBar />)

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).toHaveValue('test query')
    })

    it('should show "Search" button when not on search page', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/prompts')

      render(<TopBar />)

      expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument()
    })

    it('should show "Update" button when on search page', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/search')

      render(<TopBar />)

      expect(screen.getByRole('button', { name: /^update$/i })).toBeInTheDocument()
    })
  })

  describe('Logo/Branding Navigation', () => {
    it('should navigate to /prompts when logo is clicked', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const logo = screen.getByText('Promptana')
      await user.click(logo)

      expect(mockPush).toHaveBeenCalledWith('/prompts')
    })
  })

  describe('Search Input Interaction', () => {
    it('should update query state when user types', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      await user.type(searchInput, 'test query')

      expect(searchInput).toHaveValue('test query')
    })

    it('should disable search input when offline', () => {
      ;(useOfflineContext as jest.Mock).mockReturnValue({
        isOffline: true,
        lastChangedAt: new Date(),
      })

      render(<TopBar />)

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).toBeDisabled()
    })
  })

  describe('Search Submit Validation', () => {
    it('should prevent search when offline', async () => {
      ;(useOfflineContext as jest.Mock).mockReturnValue({
        isOffline: true,
        lastChangedAt: new Date(),
      })

      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      const submitButton = screen.getByRole('button', { name: /search/i })

      // Try to submit (button should be disabled but test the form handler)
      expect(submitButton).toBeDisabled()

      // Even if somehow submitted, it should show error
      await user.type(searchInput, 'test')
      const form = searchInput.closest('form')
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
        form.dispatchEvent(submitEvent)
      }

      await waitFor(() => {
        expect(screen.getByText(/search is unavailable while offline/i)).toBeInTheDocument()
      })

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should disable submit button when query exceeds 500 characters', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /search/i })

      const longQuery = 'a'.repeat(501)
      await user.click(searchInput)
      await user.paste(longQuery)

      expect(submitButton).toBeDisabled()
    })

    it('should allow exactly 500 characters', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /search/i })

      const maxQuery = 'a'.repeat(500)
      await user.click(searchInput)
      await user.paste(maxQuery)
      await user.click(submitButton)

      expect(mockPush).toHaveBeenCalledWith(`/search?q=${maxQuery}`)
      expect(screen.queryByText(/search query must be 500 characters or fewer/i)).not.toBeInTheDocument()
    })
  })

  describe('Search Navigation', () => {
    it('should navigate to search page with query parameter', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      const submitButton = screen.getByRole('button', { name: /search/i })

      await user.type(searchInput, 'test query')
      await user.click(submitButton)

      expect(mockPush).toHaveBeenCalledWith('/search?q=test+query')
    })

    it('should handle empty query by deleting query parameter', async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('q', 'existing query')
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)

      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /search/i })

      await user.clear(searchInput)
      await user.click(submitButton)

      expect(mockPush).toHaveBeenCalledWith('/search?')
    })

    it('should preserve other search params when updating query', async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('page', '2')
      searchParams.set('sort', 'date')
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)

      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      const submitButton = screen.getByRole('button', { name: /search/i })

      await user.type(searchInput, 'test')
      await user.click(submitButton)

      expect(mockPush).toHaveBeenCalledWith('/search?page=2&sort=date&q=test')
    })

    it('should update query parameter if already exists in URL', async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('q', 'old query')
      searchParams.set('page', '1')
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)

      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /search/i })

      // Clear and replace with new query
      await user.clear(searchInput)
      await user.type(searchInput, 'new query')
      await user.click(submitButton)

      expect(mockPush).toHaveBeenCalledWith('/search?q=new+query&page=1')
    })
  })

  describe('Sign Out Functionality', () => {
    it('should show error message when sign out API returns non-401 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<TopBar />)
      const user = userEvent.setup()

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      await user.click(signOutButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Sign-out failed',
          })
        )
        expect(mockAddMessage.mock.calls[0][0].message).toMatch(/couldn.t sign you out/)
      })

      expect(mockLocation.href).toBe('')
    })

    it('should show error message when sign out API returns 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      })

      render(<TopBar />)
      const user = userEvent.setup()

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      await user.click(signOutButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Sign-out failed',
          })
        )
        expect(mockAddMessage.mock.calls[0][0].message).toMatch(/couldn.t sign you out/)
      })

      expect(mockLocation.href).toBe('')
    })

    it('should handle network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<TopBar />)
      const user = userEvent.setup()

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      await user.click(signOutButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Sign-out failed',
          })
        )
        expect(mockAddMessage.mock.calls[0][0].message).toMatch(/couldn.t sign you out due to a network error/)
      })

      expect(mockLocation.href).toBe('')
    })

    it('should not redirect if sign out fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<TopBar />)
      const user = userEvent.setup()

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      await user.click(signOutButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalled()
      })

      // Location should not change
      expect(mockLocation.href).toBe('')
    })
  })

  describe('Offline Behavior', () => {
    it('should disable search input when offline', () => {
      ;(useOfflineContext as jest.Mock).mockReturnValue({
        isOffline: true,
        lastChangedAt: new Date(),
      })

      render(<TopBar />)

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).toBeDisabled()
    })

    it('should disable submit button when offline', () => {
      ;(useOfflineContext as jest.Mock).mockReturnValue({
        isOffline: true,
        lastChangedAt: new Date(),
      })

      render(<TopBar />)

      const submitButton = screen.getByRole('button', { name: /search/i })
      expect(submitButton).toBeDisabled()
    })

    it('should enable search when coming back online', () => {
      const { rerender } = render(<TopBar />)

      // Initially offline
      ;(useOfflineContext as jest.Mock).mockReturnValue({
        isOffline: true,
        lastChangedAt: new Date(),
      })
      rerender(<TopBar />)

      let searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).toBeDisabled()

      // Come back online
      ;(useOfflineContext as jest.Mock).mockReturnValue({
        isOffline: false,
        lastChangedAt: new Date(),
      })
      rerender(<TopBar />)

      searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).not.toBeDisabled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in search query', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      const submitButton = screen.getByRole('button', { name: /search/i })

      await user.type(searchInput, 'test & special < > " chars')
      await user.click(submitButton)

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/search?q='))
    })

    it('should handle whitespace-only query', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      const submitButton = screen.getByRole('button', { name: /search/i })

      await user.type(searchInput, '   ')
      await user.click(submitButton)

      // Whitespace is valid, should navigate
      expect(mockPush).toHaveBeenCalledWith('/search?q=+++')
    })

    it('should handle rapid form submissions', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      const submitButton = screen.getByRole('button', { name: /search/i })

      await user.type(searchInput, 'test')
      
      // Submit multiple times rapidly
      await user.click(submitButton)
      await user.click(submitButton)
      await user.click(submitButton)

      // All submissions should work
      expect(mockPush).toHaveBeenCalledTimes(3)
    })

    it('should handle missing user email gracefully', () => {
      ;(useAuthContext as jest.Mock).mockReturnValue({
        user: { email: '', id: '123' },
        status: 'authenticated',
      })

      render(<TopBar />)

      // Component should still render
      expect(screen.getByText('Promptana')).toBeInTheDocument()
    })

    it('should handle form submission with Enter key', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i)

      await user.type(searchInput, 'test query')
      await user.type(searchInput, '{Enter}')

      expect(mockPush).toHaveBeenCalledWith('/search?q=test+query')
    })

    it('should maintain query state when navigating between pages', () => {
      const searchParams = new URLSearchParams()
      searchParams.set('q', 'persisted query')
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)

      const { rerender } = render(<TopBar />)

      // Change pathname
      ;(usePathname as jest.Mock).mockReturnValue('/search')
      rerender(<TopBar />)

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).toHaveValue('persisted query')
    })

    it('should handle query at exactly 500 characters boundary', async () => {
      render(<TopBar />)
      const user = userEvent.setup()

      const searchInput = screen.getByPlaceholderText(/search prompts/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /search/i })

      // Test at boundary
      const boundaryQuery = 'a'.repeat(500)
      await user.click(searchInput)
      await user.paste(boundaryQuery)

      expect(submitButton).not.toBeDisabled()

      await user.click(submitButton)

      expect(mockPush).toHaveBeenCalled()
      expect(screen.queryByText(/search query must be 500 characters or fewer/i)).not.toBeInTheDocument()
    })
  })

  describe('Button States and Text', () => {
    it('should show "Search" on non-search pages', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/prompts')

      render(<TopBar />)

      expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^update$/i })).not.toBeInTheDocument()
    })

    it('should show "Update" on search page', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/search')

      render(<TopBar />)

      expect(screen.getByRole('button', { name: /^update$/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument()
    })

    it('should show "Update" when on /search with query params', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/search')
      const searchParams = new URLSearchParams()
      searchParams.set('q', 'test')
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)

      render(<TopBar />)

      expect(screen.getByRole('button', { name: /^update$/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible form elements', () => {
      render(<TopBar />)

      const searchInput = screen.getByPlaceholderText(/search prompts/i)
      expect(searchInput).toHaveAttribute('type', 'text')

      const submitButton = screen.getByRole('button', { name: /search/i })
      expect(submitButton).toHaveAttribute('type', 'submit')

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      expect(signOutButton).toHaveAttribute('type', 'button')
    })
  })
})

