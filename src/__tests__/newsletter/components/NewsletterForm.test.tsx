import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewsletterForm } from '@/components/blog/NewsletterForm';
import * as newsletterService from '@/services/newsletterService';

// Mock the newsletter service
jest.mock('@/services/newsletterService', () => ({
  subscribeToNewsletter: jest.fn(),
  isValidEmail: jest.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));

describe('NewsletterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form with input and button', () => {
    render(<NewsletterForm />);

    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
  });

  it('should show error for empty email submission', async () => {
    render(<NewsletterForm />);

    const button = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/please enter your email address/i)).toBeInTheDocument();
    });

    expect(newsletterService.subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('should show error for invalid email format', async () => {
    render(<NewsletterForm />);

    const input = screen.getByPlaceholderText(/enter your email/i);
    const button = screen.getByRole('button', { name: /subscribe/i });

    fireEvent.change(input, { target: { value: 'invalid-email' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    expect(newsletterService.subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('should successfully subscribe with valid email', async () => {
    (newsletterService.subscribeToNewsletter as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Thank you for subscribing!',
    });

    render(<NewsletterForm source="blog" />);

    const input = screen.getByPlaceholderText(/enter your email/i);
    const button = screen.getByRole('button', { name: /subscribe/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/thank you for subscribing!/i)).toBeInTheDocument();
    });

    expect(newsletterService.subscribeToNewsletter).toHaveBeenCalledWith('test@example.com', 'blog');
  });

  it('should show loading state during submission', async () => {
    (newsletterService.subscribeToNewsletter as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, message: 'Subscribed' }), 100))
    );

    render(<NewsletterForm />);

    const input = screen.getByPlaceholderText(/enter your email/i);
    const button = screen.getByRole('button', { name: /subscribe/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/subscribing/i)).toBeInTheDocument();
    });

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/subscribed/i)).toBeInTheDocument();
    });
  });

  it('should handle subscription errors', async () => {
    (newsletterService.subscribeToNewsletter as jest.Mock).mockResolvedValue({
      success: false,
      message: 'Subscription failed. Please try again.',
    });

    render(<NewsletterForm />);

    const input = screen.getByPlaceholderText(/enter your email/i);
    const button = screen.getByRole('button', { name: /subscribe/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/subscription failed/i)).toBeInTheDocument();
    });
  });

  it('should clear input field on successful subscription', async () => {
    (newsletterService.subscribeToNewsletter as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Subscribed!',
    });

    render(<NewsletterForm />);

    const input = screen.getByPlaceholderText(/enter your email/i) as HTMLInputElement;
    const button = screen.getByRole('button', { name: /subscribe/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should disable input and button during loading', async () => {
    (newsletterService.subscribeToNewsletter as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, message: 'Done' }), 100))
    );

    render(<NewsletterForm />);

    const input = screen.getByPlaceholderText(/enter your email/i);
    const button = screen.getByRole('button', { name: /subscribe/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
    });
  });

  it('should use custom source prop', async () => {
    (newsletterService.subscribeToNewsletter as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Subscribed',
    });

    render(<NewsletterForm source="homepage" />);

    const input = screen.getByPlaceholderText(/enter your email/i);
    const button = screen.getByRole('button', { name: /subscribe/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(newsletterService.subscribeToNewsletter).toHaveBeenCalledWith('test@example.com', 'homepage');
    });
  });
});
