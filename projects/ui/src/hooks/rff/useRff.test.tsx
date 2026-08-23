// @vitest-environment jsdom

import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';

import type {
  TurnstileApi,
  TurnstileRenderOptions,
} from '~/lib/Rff/turnstile';
import { useRffTurnstile } from './useRff';

describe('useRffTurnstile', () => {
  it('rebinds the security widget when a dialog container is remounted', async () => {
    const renders: Array<{
      container: HTMLElement;
      options: TurnstileRenderOptions;
    }> = [];
    const removed: string[] = [];
    const api: TurnstileApi = {
      render: (container, options) => {
        renders.push({ container, options });
        return `widget-${renders.length}`;
      },
      execute: () => undefined,
      remove: (widgetId) => removed.push(widgetId),
    };
    (window as typeof window & { turnstile?: TurnstileApi }).turnstile = api;

    let getToken: ((action: string) => Promise<string>) | undefined;
    const Harness: React.FC<{ open: boolean }> = ({ open }) => {
      const turnstile = useRffTurnstile('site-key');
      useEffect(() => {
        getToken = turnstile.getToken;
      }, [turnstile.getToken]);
      return open ? <div ref={turnstile.containerRef} /> : null;
    };

    const view = render(<Harness open />);
    let firstToken: Promise<string> | undefined;
    await act(async () => {
      firstToken = getToken!('rff_quote');
      await Promise.resolve();
    });
    renders[0]!.options.callback('first');
    await expect(firstToken).resolves.toBe('first');
    const firstContainer = renders[0]!.container;

    view.rerender(<Harness open={false} />);
    view.rerender(<Harness open />);

    let secondToken: Promise<string> | undefined;
    await act(async () => {
      secondToken = getToken!('rff_quote');
      await Promise.resolve();
    });
    expect(renders[1]!.container).not.toBe(firstContainer);
    renders[1]!.options.callback('second');
    await expect(secondToken).resolves.toBe('second');
    expect(removed).toEqual(['widget-1', 'widget-2']);

    delete (window as typeof window & { turnstile?: TurnstileApi }).turnstile;
  });
});
