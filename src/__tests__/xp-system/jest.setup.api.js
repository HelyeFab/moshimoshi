/**
 * Jest Setup for API Tests
 * Sets up global Request/Response before any code loads
 */

// Mock Headers
class MockHeaders {
  constructor() {
    this.headers = new Map()
  }

  get(name) {
    return this.headers.get(name) || null
  }

  set(name, value) {
    this.headers.set(name, value)
  }

  has(name) {
    return this.headers.has(name)
  }

  append(name, value) {
    this.headers.set(name, value)
  }

  delete(name) {
    this.headers.delete(name)
  }

  forEach(cb) {
    this.headers.forEach(cb)
  }
}

// Mock Request
class MockRequest {
  constructor(url, init = {}) {
    this.url = url
    this.method = init.method || 'GET'
    this.headers = new MockHeaders()
    this.body = init.body

    if (init.headers) {
      Object.entries(init.headers).forEach(([k, v]) => {
        this.headers.set(k, v)
      })
    }
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
  }

  clone() {
    return new MockRequest(this.url, {
      method: this.method,
      body: this.body,
      headers: this.headers
    })
  }
}

// Mock Response
class MockResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new MockHeaders()
    this.ok = this.status >= 200 && this.status < 300

    if (init.headers) {
      Object.entries(init.headers).forEach(([k, v]) => {
        this.headers.set(k, v)
      })
    }
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
  }

  clone() {
    return new MockResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers
    })
  }
}

// Set globals
global.Request = MockRequest
global.Response = MockResponse
global.Headers = MockHeaders
global.fetch = jest.fn(() =>
  Promise.resolve(new MockResponse(JSON.stringify({ success: true })))
)

// Export for use
module.exports = {
  MockRequest,
  MockResponse,
  MockHeaders
}