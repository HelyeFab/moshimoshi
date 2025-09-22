import { test as base, expect } from '@playwright/test';
import { TestUser } from './test-user';

type TestFixtures = {
  testUser: TestUser;
};

export const test = base.extend<TestFixtures>({
  testUser: async ({ page }, use) => {
    const user = new TestUser(page);
    await use(user);
    await user.cleanup();
  },
});

export { expect };