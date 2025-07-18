import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

// Mock external services that shouldn't be called during tests
jest.mock('snmp-native', () => ({
  createSession: jest.fn().mockReturnValue({
    get: jest.fn(),
    getBulk: jest.fn(),
    getNext: jest.fn(),
    walk: jest.fn(),
    close: jest.fn(),
  }),
}));

jest.mock('@influxdata/influxdb-client', () => ({
  InfluxDB: jest.fn().mockImplementation(() => ({
    getWriteApi: jest.fn().mockReturnValue({
      writePoint: jest.fn(),
      writePoints: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
    }),
    getQueryApi: jest.fn().mockReturnValue({
      queryRows: jest.fn(),
      query: jest.fn(),
    }),
    close: jest.fn(),
  })),
  Point: jest.fn().mockImplementation(() => ({
    tag: jest.fn().mockReturnThis(),
    intField: jest.fn().mockReturnThis(),
    floatField: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
  })),
  HttpError: class HttpError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'HttpError';
    }
  },
}));

// Global test utilities
global.beforeAll(async () => {
  // Global setup that runs before all tests
});

global.afterAll(async () => {
  // Global cleanup that runs after all tests
});