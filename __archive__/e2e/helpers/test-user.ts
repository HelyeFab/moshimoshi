import { Page } from '@playwright/test';

export class TestUser {
  private createdUsers: string[] = [];
  
  constructor(private page: Page) {}

  async signUp(email?: string, password?: string) {
    const testEmail = email || `test${Date.now()}@example.com`;
    const testPassword = password || 'Test123!@#';
    
    await this.page.goto('/signup');
    await this.page.fill('input[name="email"]', testEmail);
    await this.page.fill('input[name="password"]', testPassword);
    await this.page.fill('input[name="confirmPassword"]', testPassword);
    await this.page.click('button[type="submit"]');
    
    await this.page.waitForURL(/dashboard|home/);
    this.createdUsers.push(testEmail);
    
    return { email: testEmail, password: testPassword };
  }

  async login(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL(/dashboard|home/);
  }

  async logout() {
    await this.page.click('button[aria-label="User menu"]');
    await this.page.click('text=Logout');
    await this.page.waitForURL('/');
  }

  async cleanup() {
    // Cleanup created test users if needed
    for (const email of this.createdUsers) {
      try {
        // Call cleanup API endpoint if available
        await this.page.request.delete('/api/test/cleanup-user', {
          data: { email }
        });
      } catch (error) {
        console.log(`Failed to cleanup user ${email}:`, error);
      }
    }
  }
}