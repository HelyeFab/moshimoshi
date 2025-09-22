import { test, expect } from '../helpers/test-base';

test.describe('Performance Regression Tests', () => {
  test('page load performance metrics', async ({ page }) => {
    // Test homepage load performance
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    // Performance targets
    expect(metrics.domInteractive).toBeLessThan(3000); // Interactive within 3s
    expect(metrics.loadComplete).toBeLessThan(5000); // Full load within 5s
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // FCP within 2s
  });

  test('API response time performance', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    
    // Measure API response times
    const apiTimes: number[] = [];
    
    page.on('requestfinished', async request => {
      if (request.url().includes('/api/')) {
        const timing = request.timing();
        apiTimes.push(timing.responseEnd);
      }
    });
    
    // Navigate and trigger API calls
    await page.goto('/dashboard');
    await page.goto('/review');
    
    // Wait for APIs to complete
    await page.waitForTimeout(2000);
    
    // Check API performance
    const avgResponseTime = apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length;
    const maxResponseTime = Math.max(...apiTimes);
    
    expect(avgResponseTime).toBeLessThan(200); // Average under 200ms
    expect(maxResponseTime).toBeLessThan(1000); // No API over 1s
  });

  test('review session performance', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    await page.goto('/review');
    
    // Start review session
    const startTime = Date.now();
    await page.getByRole('button', { name: /Start/i }).first().click();
    
    // Wait for first item to load
    await page.waitForSelector('[data-testid="review-item"], .review-card', { timeout: 5000 });
    const loadTime = Date.now() - startTime;
    
    // Queue generation should be fast
    expect(loadTime).toBeLessThan(2000);
    
    // Measure review interaction performance
    const interactionTimes: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const actionStart = Date.now();
      
      const showBtn = page.getByRole('button', { name: /Show/i }).first();
      if (await showBtn.isVisible()) {
        await showBtn.click();
        await page.waitForSelector('[data-testid="answer"], .answer', { timeout: 2000 });
      }
      
      const ratingBtn = page.getByRole('button', { name: /Good/i }).first();
      if (await ratingBtn.isVisible()) {
        await ratingBtn.click();
        await page.waitForTimeout(100);
      }
      
      interactionTimes.push(Date.now() - actionStart);
    }
    
    // All interactions should be snappy
    const avgInteraction = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;
    expect(avgInteraction).toBeLessThan(500);
  });

  test('memory usage remains stable', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    
    // Get initial memory usage
    const getMemoryUsage = () => page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    const initialMemory = await getMemoryUsage();
    
    // Perform heavy operations
    for (let i = 0; i < 10; i++) {
      await page.goto('/review');
      await page.goto('/dashboard');
      await page.goto('/settings');
    }
    
    // Complete multiple review sessions
    await page.goto('/review');
    for (let session = 0; session < 3; session++) {
      const startBtn = page.getByRole('button', { name: /Start/i }).first();
      if (await startBtn.isVisible()) {
        await startBtn.click();
        
        for (let i = 0; i < 5; i++) {
          const showBtn = page.getByRole('button', { name: /Show/i }).first();
          if (await showBtn.isVisible()) {
            await showBtn.click();
            await page.waitForTimeout(100);
          }
          
          const ratingBtn = page.getByRole('button', { name: /Good/i }).first();
          if (await ratingBtn.isVisible()) {
            await ratingBtn.click();
            await page.waitForTimeout(100);
          }
        }
      }
    }
    
    const finalMemory = await getMemoryUsage();
    
    // Memory shouldn't grow excessively (less than 50MB increase)
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    expect(memoryIncrease).toBeLessThan(50);
  });

  test('bundle size and resource loading', async ({ page }) => {
    const resources: { url: string; size: number; type: string }[] = [];
    
    page.on('response', async response => {
      const url = response.url();
      const headers = response.headers();
      
      if (url.includes('.js') || url.includes('.css')) {
        const size = parseInt(headers['content-length'] || '0');
        const type = url.includes('.js') ? 'javascript' : 'css';
        resources.push({ url, size, type });
      }
    });
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Calculate total bundle sizes
    const jsSize = resources
      .filter(r => r.type === 'javascript')
      .reduce((sum, r) => sum + r.size, 0);
    
    const cssSize = resources
      .filter(r => r.type === 'css')
      .reduce((sum, r) => sum + r.size, 0);
    
    // Bundle size limits (in bytes)
    expect(jsSize).toBeLessThan(500 * 1024); // JS under 500KB
    expect(cssSize).toBeLessThan(100 * 1024); // CSS under 100KB
    
    // Check for code splitting (should have multiple JS chunks)
    const jsChunks = resources.filter(r => r.type === 'javascript').length;
    expect(jsChunks).toBeGreaterThan(1);
  });

  test('database query performance', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    
    // Monitor API calls that likely involve database queries
    const dbOperations: { endpoint: string; duration: number }[] = [];
    
    page.on('requestfinished', async request => {
      if (request.url().includes('/api/')) {
        const timing = request.timing();
        const endpoint = new URL(request.url()).pathname;
        dbOperations.push({
          endpoint,
          duration: timing.responseEnd
        });
      }
    });
    
    // Trigger various database operations
    await page.goto('/dashboard'); // User data fetch
    await page.goto('/review'); // Queue generation
    await page.goto('/settings'); // Settings fetch
    
    // Start a review to trigger more DB operations
    const startBtn = page.getByRole('button', { name: /Start/i }).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      
      // Complete a few reviews
      for (let i = 0; i < 3; i++) {
        const showBtn = page.getByRole('button', { name: /Show/i }).first();
        if (await showBtn.isVisible()) {
          await showBtn.click();
          await page.waitForTimeout(100);
          await page.getByRole('button', { name: /Good/i }).first().click();
          await page.waitForTimeout(100);
        }
      }
    }
    
    // Analyze database operation performance
    const avgDuration = dbOperations.reduce((sum, op) => sum + op.duration, 0) / dbOperations.length;
    const slowQueries = dbOperations.filter(op => op.duration > 500);
    
    expect(avgDuration).toBeLessThan(200); // Average query under 200ms
    expect(slowQueries.length).toBe(0); // No slow queries
  });

  test('concurrent user load simulation', async ({ page, context, testUser }) => {
    const { email, password } = await testUser.signUp();
    
    // Simulate multiple concurrent sessions
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);
    
    // All sessions login with same user (simulating multiple devices)
    for (const p of pages) {
      await p.goto('/auth/login');
      await p.fill('input[name="email"]', email);
      await p.fill('input[name="password"]', password);
      await p.click('button[type="submit"]');
      await p.waitForURL(/(dashboard|home)/);
    }
    
    // Perform concurrent operations
    const operations = pages.map(async (p, index) => {
      const startTime = Date.now();
      
      // Each session does different operations
      if (index === 0) {
        await p.goto('/review');
        await p.getByRole('button', { name: /Start/i }).first().click();
      } else if (index === 1) {
        await p.goto('/dashboard');
        await p.reload();
      } else {
        await p.goto('/settings');
        await p.goto('/dashboard');
      }
      
      return Date.now() - startTime;
    });
    
    const times = await Promise.all(operations);
    
    // All operations should complete reasonably fast even under concurrent load
    times.forEach(time => {
      expect(time).toBeLessThan(3000);
    });
    
    // Cleanup
    for (const p of pages) {
      await p.close();
    }
  });

  test('cache effectiveness', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    
    // First load - cold cache
    const firstLoadStart = Date.now();
    await page.goto('/dashboard');
    const firstLoadTime = Date.now() - firstLoadStart;
    
    // Navigate away and back - warm cache
    await page.goto('/settings');
    
    const secondLoadStart = Date.now();
    await page.goto('/dashboard');
    const secondLoadTime = Date.now() - secondLoadStart;
    
    // Second load should be significantly faster
    expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.7);
    
    // Check cache headers
    const cachedResources: string[] = [];
    page.on('response', response => {
      const headers = response.headers();
      if (headers['cache-control'] && headers['cache-control'].includes('max-age')) {
        cachedResources.push(response.url());
      }
    });
    
    await page.reload();
    
    // Should have cached resources
    expect(cachedResources.length).toBeGreaterThan(0);
  });
});