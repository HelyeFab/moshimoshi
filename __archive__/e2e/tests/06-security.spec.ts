import { test, expect } from '../helpers/test-base';

test.describe('Security Tests - OWASP Top 10', () => {
  test('protects against XSS attacks', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Try to inject script tag in input fields
    const xssPayload = '<script>alert("XSS")</script>';
    await page.fill('input[name="email"]', xssPayload);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Check that script is not executed
    const alertFired = await page.evaluate(() => {
      return new Promise(resolve => {
        const originalAlert = window.alert;
        window.alert = () => {
          window.alert = originalAlert;
          resolve(true);
        };
        setTimeout(() => resolve(false), 1000);
      });
    });
    
    expect(alertFired).toBeFalsy();
    
    // Check that input is properly escaped in error messages
    const errorMessage = page.locator('[role="alert"], .error-message').first();
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.innerHTML();
      expect(errorText).not.toContain('<script>');
    }
  });

  test('prevents SQL injection attempts', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Try SQL injection payloads
    const sqlPayloads = [
      "' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "'; DROP TABLE users--"
    ];
    
    for (const payload of sqlPayloads) {
      await page.fill('input[name="email"]', payload);
      await page.fill('input[name="password"]', payload);
      await page.click('button[type="submit"]');
      
      // Should show validation error, not database error
      const error = await page.locator('[role="alert"], .error').first().textContent();
      expect(error).toBeTruthy();
      expect(error).not.toContain('SQL');
      expect(error).not.toContain('database');
      expect(error).not.toContain('syntax');
    }
  });

  test('implements proper authentication', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/auth|login/);
    
    // Check that auth token is not accessible from JavaScript
    const tokenExposed = await page.evaluate(() => {
      return !!(window.localStorage.getItem('token') || 
               window.sessionStorage.getItem('token') ||
               document.cookie.includes('token'));
    });
    
    // Token should be httpOnly or not directly accessible
    if (tokenExposed) {
      const cookieHttpOnly = await page.evaluate(() => {
        // Can't directly check httpOnly from JS, but check if cookie exists
        return !document.cookie.includes('token');
      });
      expect(cookieHttpOnly).toBeTruthy();
    }
  });

  test('implements CSRF protection', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    
    // Check for CSRF token in forms
    await page.goto('/settings');
    
    const forms = await page.locator('form').all();
    for (const form of forms.slice(0, 3)) { // Check first 3 forms
      const csrfToken = await form.evaluate((f) => {
        const csrfInput = f.querySelector('input[name*="csrf"], input[name*="token"]');
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        return !!(csrfInput || csrfMeta);
      });
      
      // Forms making state changes should have CSRF protection
      const method = await form.getAttribute('method');
      if (method && method.toLowerCase() === 'post') {
        expect(csrfToken).toBeTruthy();
      }
    }
  });

  test('enforces secure headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    
    if (headers) {
      // Check for security headers
      const securityHeaders = {
        'x-frame-options': ['DENY', 'SAMEORIGIN'],
        'x-content-type-options': ['nosniff'],
        'strict-transport-security': ['max-age'],
        'x-xss-protection': ['1', 'mode=block']
      };
      
      for (const [header, expectedValues] of Object.entries(securityHeaders)) {
        const headerValue = headers[header];
        if (headerValue) {
          const hasExpectedValue = expectedValues.some(val => 
            headerValue.toLowerCase().includes(val.toLowerCase())
          );
          expect(hasExpectedValue).toBeTruthy();
        }
      }
      
      // Check CSP header
      const csp = headers['content-security-policy'];
      if (csp) {
        expect(csp).toContain("default-src");
        expect(csp).not.toContain("unsafe-inline");
        expect(csp).not.toContain("unsafe-eval");
      }
    }
  });

  test('rate limiting is implemented', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Attempt multiple rapid login attempts
    const attempts = [];
    for (let i = 0; i < 10; i++) {
      attempts.push(
        page.evaluate(async () => {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'wrong'
            })
          });
          return response.status;
        })
      );
    }
    
    const results = await Promise.all(attempts);
    
    // Should see rate limiting (429) after multiple attempts
    const rateLimited = results.some(status => status === 429);
    expect(rateLimited).toBeTruthy();
  });

  test('sensitive data is not exposed in responses', async ({ page }) => {
    // Create a test user and login
    const { email, password } = await testUser.signUp();
    
    // Intercept API responses
    const apiResponses: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiResponses.push(response);
      }
    });
    
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    
    // Check API responses for sensitive data
    for (const response of apiResponses) {
      try {
        const json = await response.json();
        const stringified = JSON.stringify(json);
        
        // Check for exposed sensitive data
        expect(stringified).not.toContain('password');
        expect(stringified).not.toContain('creditCard');
        expect(stringified).not.toContain('ssn');
        expect(stringified).not.toContain('secret');
        
        // If user data is returned, check password is not included
        if (json.user || json.data?.user) {
          const userData = json.user || json.data.user;
          expect(userData.password).toBeUndefined();
          expect(userData.passwordHash).toBeUndefined();
        }
      } catch {
        // Not a JSON response, skip
      }
    }
  });

  test('implements secure password requirements', async ({ page }) => {
    await page.goto('/auth/signup');
    
    // Test weak passwords
    const weakPasswords = [
      '123456',
      'password',
      'qwerty',
      'abc123',
      'test'
    ];
    
    for (const weakPassword of weakPasswords) {
      await page.fill('input[name="password"]', weakPassword);
      await page.fill('input[name="confirmPassword"]', weakPassword);
      
      // Trigger validation
      await page.click('button[type="submit"]');
      
      // Should show password strength error
      const error = await page.locator('[role="alert"], .error, .password-error').first();
      await expect(error).toBeVisible();
      
      const errorText = await error.textContent();
      expect(errorText).toMatch(/weak|strong|length|character/i);
    }
  });

  test('prevents path traversal attacks', async ({ page }) => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];
    
    for (const payload of pathTraversalPayloads) {
      const response = await page.request.get(`/api/files/${payload}`, {
        failOnStatusCode: false
      });
      
      // Should return 400 or 404, not file contents
      expect([400, 404, 403]).toContain(response.status());
      
      const text = await response.text();
      expect(text).not.toContain('root:');
      expect(text).not.toContain('Administrator');
    }
  });

  test('validates and sanitizes all inputs', async ({ page }) => {
    await page.goto('/auth/signup');
    
    // Test various malicious inputs
    const maliciousInputs = [
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '../../etc/passwd',
      '${7*7}',
      '{{7*7}}',
      '%00',
      '\x00',
      '0x0a'
    ];
    
    for (const input of maliciousInputs) {
      await page.fill('input[name="email"]', input);
      await page.click('button[type="submit"]');
      
      // Should show validation error
      const error = await page.locator('[role="alert"], .error').first();
      await expect(error).toBeVisible();
      
      // Error should not execute or render malicious content
      const errorHtml = await error.innerHTML();
      expect(errorHtml).not.toContain('<img');
      expect(errorHtml).not.toContain('javascript:');
      expect(errorHtml).not.toContain('49'); // Result of 7*7
    }
  });

  test('implements secure session management', async ({ page, context, testUser }) => {
    const { email, password } = await testUser.signUp();
    
    // Check session cookie attributes
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => 
      c.name.includes('session') || c.name.includes('auth')
    );
    
    if (sessionCookie) {
      // Session cookie should be secure in production
      if (page.url().startsWith('https')) {
        expect(sessionCookie.secure).toBeTruthy();
      }
      
      // Should have httpOnly flag
      expect(sessionCookie.httpOnly).toBeTruthy();
      
      // Should have SameSite attribute
      expect(sessionCookie.sameSite).toBeTruthy();
    }
    
    // Test session timeout
    // This would need to be adjusted based on actual timeout settings
    await page.goto('/dashboard');
    
    // Wait for potential session timeout (shortened for testing)
    await page.waitForTimeout(5000);
    
    // Session should still be valid for reasonable timeout
    await page.reload();
    await expect(page).not.toHaveURL(/login/);
  });
});