# Testing Guide

This project uses **Jest** for unit testing and **Playwright** for end-to-end testing.

## Unit Tests (Jest)

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Unit Tests

Unit tests are located in `__tests__` directories or next to the files they test with `.test.ts` or `.spec.ts` extensions.

Example test structure:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    
    render(<MyComponent onClick={handleClick} />);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Best Practices

- Use `describe` blocks to organize related tests
- Use `beforeEach` and `afterEach` for setup and cleanup
- Use specific matchers (`toBeInTheDocument`, `toHaveBeenCalledTimes`, etc.)
- Mock external dependencies
- Test user interactions with `@testing-library/user-event`
- Avoid snapshot testing for dynamic content

## E2E Tests (Playwright)

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in UI mode (recommended for development)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Show test report
npm run test:e2e:report

# Generate tests with codegen
npm run test:e2e:codegen
```

### Writing E2E Tests

E2E tests are located in the `e2e/` directory.

#### Using Page Object Model

```typescript
import { test, expect } from './fixtures/test-fixtures';

test('should navigate using page object', async ({ homePage }) => {
  await homePage.navigate();
  await homePage.clickSignIn();
  
  expect(await homePage.isOnHomePage()).toBeTruthy();
});
```

#### Direct Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should display home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Promptana/);
});
```

### Best Practices

- Use Page Object Model for maintainable tests
- Use browser contexts for test isolation
- Use locators (`getByRole`, `getByTestId`) for resilient element selection
- Implement test hooks (`beforeEach`, `afterEach`) for setup/teardown
- Use visual comparison with `toHaveScreenshot()` when needed
- Leverage the codegen tool for recording tests
- Use trace viewer for debugging failures
- Run tests in parallel for speed

## Configuration

### Jest Configuration

Configuration is in `jest.config.js`. Key settings:

- **testEnvironment**: `jsdom` for React component testing
- **setupFilesAfterEnv**: `jest.setup.js` for test environment setup
- **moduleNameMapper**: Maps `@/*` to `src/*` for imports
- **testPathIgnorePatterns**: Ignores `node_modules`, `.next`, `e2e`

### Playwright Configuration

Configuration is in `playwright.config.ts`. Key settings:

- **testDir**: `./e2e` - E2E tests location
- **browsers**: Chromium only (Desktop Chrome)
- **baseURL**: `http://localhost:3000`
- **webServer**: Automatically starts dev server before tests

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run unit tests
  run: npm test

- name: Run E2E tests
  run: npm run test:e2e
```

## Troubleshooting

### Jest Issues

- **Import errors**: Check `moduleNameMapper` in `jest.config.js`
- **React 19 warnings**: This is expected with Testing Library 15
- **Async warnings**: Make sure to use `await` with async operations

### Playwright Issues

- **Browser not installed**: Run `npx playwright install chromium`
- **Port conflicts**: Change `baseURL` in `playwright.config.ts`
- **Timeout errors**: Increase timeout in config or use `test.setTimeout()`

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)

