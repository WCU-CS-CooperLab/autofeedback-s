// Setup nock to disable all external calls
import nock from 'nock'
nock.disableNetConnect()

// By default, debug messages are written to the console which can make the test output confusing
// Instead, bind to stdout and hide all debug messages
const processStdoutWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = (str, encoding, cb) => {
  return false
}

const processStderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = (str, encoding, cb) => {
  //if (str.toString().match(/Hello/)) return false
  processStderrWrite(str, encoding, cb)
}

export default {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  preset: 'ts-jest/presets/default-esm', 
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@actions/github|@octokit)/)',
  ],
  verbose: true,
  moduleNameMapper: {
    // 1. Map relative imports ending in .js to look for the .ts file
    '^(\\.{1,2}/.*)\\.js$': '$1',
    
    
    "^#(.*)": "<rootDir>/node_modules/$1"
  },
}