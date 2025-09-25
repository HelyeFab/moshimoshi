/**
 * Jest Setup for Next.js API Testing
 */

// Import Next.js types
import type { NextRequest as NextRequestType } from 'next/server'
import type { NextResponse as NextResponseType } from 'next/server'

// Polyfill for Next.js Request/Response/Headers
class MockHeaders {
  private headers: Map<string, string> = new Map()

  append(name: string, value: string) {
    this.headers.set(name, value)
  }

  delete(name: string) {
    this.headers.delete(name)
  }

  get(name: string) {
    return this.headers.get(name) || null
  }

  has(name: string) {
    return this.headers.has(name)
  }

  set(name: string, value: string) {
    this.headers.set(name, value)
  }

  forEach(callback: (value: string, name: string) => void) {
    this.headers.forEach(callback)
  }
}

class MockRequest {
  public url: string
  public method: string
  public headers: MockHeaders
  public body: any

  constructor(input: string | URL, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.toString()
    this.method = init?.method || 'GET'
    this.headers = new MockHeaders()
    this.body = init?.body

    // Set headers from init
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          this.headers.set(key, value)
        })
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          this.headers.set(key, value)
        })
      } else {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, value as string)
        })
      }
    }
  }

  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body)
    }
    return this.body
  }

  async text() {
    if (typeof this.body === 'string') {
      return this.body
    }
    return JSON.stringify(this.body)
  }

  clone() {
    return new MockRequest(this.url, {
      method: this.method,
      body: this.body,
      headers: this.headers as any
    })
  }
}

class MockResponse {
  public body: any
  public status: number
  public statusText: string
  public headers: MockHeaders
  public ok: boolean

  constructor(body?: any, init?: ResponseInit) {
    this.body = body
    this.status = init?.status || 200
    this.statusText = init?.statusText || 'OK'
    this.headers = new MockHeaders()
    this.ok = this.status >= 200 && this.status < 300

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          this.headers.set(key, value)
        })
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          this.headers.set(key, value)
        })
      } else {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, value as string)
        })
      }
    }
  }

  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body)
    }
    return this.body
  }

  async text() {
    if (typeof this.body === 'string') {
      return this.body
    }
    return JSON.stringify(this.body)
  }

  clone() {
    return new MockResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers as any
    })
  }
}

// Create NextRequest mock
class MockNextRequest extends MockRequest {
  public nextUrl: any
  public geo?: any
  public ip?: string
  public cookies: Map<string, string> = new Map()

  constructor(input: string | URL, init?: RequestInit) {
    super(input, init)
    const url = typeof input === 'string' ? new URL(input) : input
    this.nextUrl = {
      pathname: url.pathname,
      searchParams: url.searchParams,
      href: url.href,
      origin: url.origin,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      search: url.search,
      hash: url.hash
    }
  }
}

// Create NextResponse mock
class MockNextResponse extends MockResponse {
  static json(body: any, init?: ResponseInit) {
    const response = new MockNextResponse(JSON.stringify(body), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...((init?.headers as any) || {})
      }
    })
    return response
  }

  static redirect(url: string | URL, status: number = 302) {
    return new MockNextResponse(null, {
      status,
      headers: {
        location: url.toString()
      }
    })
  }

  static error() {
    return new MockNextResponse(null, { status: 500 })
  }
}

// Set up globals
global.Request = MockRequest as any
global.Response = MockResponse as any
global.Headers = MockHeaders as any

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse
}))

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve(new MockResponse(JSON.stringify({ success: true })))
  ) as any
}

export { MockRequest, MockResponse, MockHeaders, MockNextRequest, MockNextResponse }