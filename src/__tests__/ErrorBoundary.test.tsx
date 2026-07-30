import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';

const ThrowError = () => {
  throw new Error('Test Error');
};

describe('ErrorBoundary', () => {
  it('renders fallback UI when child throws an error', () => {
    // Suppress console.error for this expected error in test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('একটি সমস্যা দেখা দিয়েছে')).toBeTruthy();
    
    const reloadButton = screen.getByRole('button', { name: /পৃষ্ঠা রিফ্রেশ করুন/i });
    expect(reloadButton).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
