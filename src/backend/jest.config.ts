import type { Config } from '@jest/types'; // v29.6.2

const config: Config.InitialOptions = {
  // Use ts-jest as the default preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the testing environment
  testEnvironment: 'node',

  // Define root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Configure test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],

  // Configure TypeScript transformation
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Set up module path aliases for clean imports
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@config/(.*)': '<rootDir>/src/config/$1',
    '@models/(.*)': '<rootDir>/src/db/models/$1',
    '@interfaces/(.*)': '<rootDir>/src/interfaces/$1',
    '@services/(.*)': '<rootDir>/src/services/$1',
    '@utils/(.*)': '<rootDir>/src/utils/$1',
    '@middleware/(.*)': '<rootDir>/src/middleware/$1',
    '@controllers/(.*)': '<rootDir>/src/controllers/$1',
    '@validators/(.*)': '<rootDir>/src/validators/$1',
    '@types/(.*)': '<rootDir>/src/types/$1'
  },

  // Configure coverage reporting
  coverageDirectory: '<rootDir>/coverage',
  
  // Specify which files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/app.ts',
    '!src/types/**/*',
    '!src/config/**/*',
    '!src/**/*.interface.ts',
    '!src/**/*.constant.ts'
  ],

  // Set minimum coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Setup files to run before tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],

  // Test execution configuration
  testTimeout: 10000,
  maxWorkers: '50%',
  verbose: true,
  clearMocks: true,
  restoreMocks: true,

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/.git/'
  ],

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ]
};

export default config;