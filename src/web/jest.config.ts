import type { Config } from 'jest'; // v29.5.0

const config: Config = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set jsdom environment for DOM testing
  testEnvironment: 'jsdom',

  // Setup files to run after jest is initialized
  setupFilesAfterEnv: ['@testing-library/jest-dom'],

  // Module name mapping for project imports
  moduleNameMapper: {
    // Project path aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',

    // Handle style and asset imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/tests/__mocks__/fileMock.ts'
  },

  // Transform configuration for TypeScript and JavaScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },

  // Test file patterns
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/tests/**/*',
    '!src/**/*.stories.{ts,tsx}'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test timeout in milliseconds
  testTimeout: 10000,

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },

  // Watch plugins for better testing experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};

export default config;