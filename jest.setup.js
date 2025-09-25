// Jest Setup File
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Import proper structuredClone polyfill from core-js
require('core-js/stable/structured-clone');

// Use fake-indexeddb for testing
require('fake-indexeddb/auto');

// Mock localStorage with actual storage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Firebase
jest.mock('@/lib/firebase/client', () => {
  const mockBatch = {
    set: jest.fn(),
    commit: jest.fn(() => Promise.resolve())
  };

  const mockDoc = jest.fn(() => ({
    id: 'mock-doc-id',
    path: 'mock/path'
  }));

  const mockCollection = jest.fn(() => ({
    doc: mockDoc
  }));

  return {
    firestore: {
      collection: mockCollection,
      doc: mockDoc,
      getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
      setDoc: jest.fn(() => Promise.resolve()),
      serverTimestamp: jest.fn(() => new Date()),
      writeBatch: jest.fn(() => mockBatch)
    }
  };
});

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  User: jest.fn()
}));

// Mock getSession from auth/session
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(() => Promise.resolve({
    uid: 'test-user-123',
    email: 'test@example.com',
  })),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js server modules
global.Request = class Request {
  constructor(input, init) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init?.method || 'GET';
    this.headers = new Map();
    if (init?.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
    this.body = init?.body;
  }

  json() {
    return Promise.resolve(this.body ? JSON.parse(this.body) : {});
  }

  text() {
    return Promise.resolve(this.body || '');
  }
};

global.Response = class Response {
  constructor(body, init) {
    this.body = body;
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.headers = new Map();
    if (init?.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
  }

  json() {
    return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body);
  }

  text() {
    return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body));
  }
};

jest.mock('next/server', () => ({
  NextRequest: global.Request,
  NextResponse: {
    json: (data, init) => {
      const response = new global.Response(JSON.stringify(data), init);
      response.body = JSON.stringify(data);
      return response;
    },
  },
}));

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});