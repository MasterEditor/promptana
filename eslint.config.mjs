import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  // E2E test files - disable React hooks rules (Playwright's "use" is not a React hook)
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Jest config file - allow require()
  {
    files: ['jest.config.js', 'jest.setup.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Test files - relax strict typing
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // UI components - allow empty interface extensions (common pattern for React component props)
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  // Global rule adjustments
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Allow empty interfaces that extend other interfaces (common React pattern)
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      // Disable the overly strict set-state-in-effect rule
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);

export default eslintConfig;
