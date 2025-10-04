import { subscribeToNewsletter, unsubscribeFromNewsletter, isValidEmail } from '@/services/newsletterService';

// Mock fetch
global.fetch = jest.fn();

describe('newsletterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('name@subdomain.example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('subscribeToNewsletter', () => {
    it('should successfully subscribe with valid email', async () => {
      const mockResponse = {
        success: true,
        message: 'Successfully subscribed!',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await subscribeToNewsletter('test@example.com', 'blog');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully subscribed!');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/newsletter/subscribe',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ email: 'test@example.com', source: 'blog' }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Invalid email address' },
        }),
      });

      const result = await subscribeToNewsletter('invalid@email', 'blog');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid email address');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await subscribeToNewsletter('test@example.com', 'blog');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to subscribe');
    });

    it('should use default source if not provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Subscribed' }),
      });

      await subscribeToNewsletter('test@example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/newsletter/subscribe',
        expect.objectContaining({
          body: JSON.stringify({ email: 'test@example.com', source: 'blog' }),
        })
      );
    });
  });

  describe('unsubscribeFromNewsletter', () => {
    it('should successfully unsubscribe with valid email', async () => {
      const mockResponse = {
        success: true,
        message: 'Successfully unsubscribed',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await unsubscribeFromNewsletter('test@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully unsubscribed');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/newsletter/unsubscribe',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      );
    });

    it('should handle unsubscribe errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Subscriber not found' },
        }),
      });

      const result = await unsubscribeFromNewsletter('notfound@example.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscriber not found');
    });

    it('should handle network errors during unsubscribe', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const result = await unsubscribeFromNewsletter('test@example.com');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to unsubscribe');
    });
  });
});
