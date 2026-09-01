// @vitest-environment jsdom

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import toast, { Toaster } from 'react-hot-toast';
import { vi } from 'vitest';

import { useAppVersionGuard } from './AppVersionGuard';

const originalFetch = globalThis.fetch;
const originalMatchMedia = window.matchMedia;

const GuardHarness = () => {
  useAppVersionGuard(true);
  return null;
};

describe('AppVersionGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ buildId: 'new-deployment' }),
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
  });

  afterEach(() => {
    toast.remove();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('offers an explicit reload instead of reloading a hidden wallet flow', async () => {
    render(
      <>
        <Toaster />
        <GuardHarness />
      </>
    );

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText('A new Beanstalk version is available.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});
