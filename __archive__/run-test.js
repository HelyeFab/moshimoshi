#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Simple test runner that uses ts-jest directly
const testFile = process.argv[2];

if (!testFile) {
  console.log('Usage: node run-test.js <test-file>');
  process.exit(1);
}

const jestConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        forceConsistentCasingInFileNames: true,
        incremental: true,
        paths: {
          "@/*": ["./src/*"]
        }
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|nanoid)/)'
  ],
  roots: [process.cwd()],
  testMatch: [`**/${path.basename(testFile)}`],
  verbose: true
};

// Write temporary config
const fs = require('fs');
const configPath = path.join(process.cwd(), 'jest.config.temp.json');
fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));

try {
  // Run jest with the temporary config
  execSync(`npx jest --config=${configPath} --no-coverage`, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  // Jest will handle its own error output
} finally {
  // Clean up temp config
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}