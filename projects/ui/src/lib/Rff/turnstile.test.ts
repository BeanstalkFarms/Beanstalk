import { describe, expect, it } from 'vitest';

import {
  TurnstileTokenBroker,
  type TurnstileApi,
  type TurnstileRenderOptions,
} from './turnstile';

describe('RFF Turnstile token broker', () => {
  it('executes an interaction-only challenge and returns its single-use token', async () => {
    let options: TurnstileRenderOptions | undefined;
    const calls: string[] = [];
    const api: TurnstileApi = {
      render: (_container, nextOptions) => {
        options = nextOptions;
        return 'widget-1';
      },
      execute: (widgetId) => calls.push(`execute:${widgetId}`),
      remove: (widgetId) => calls.push(`remove:${widgetId}`),
    };
    const broker = new TurnstileTokenBroker(api, {} as HTMLElement, 'site-key');

    const tokenPromise = broker.getToken('rff_quote');
    options!.callback('fresh-token');

    await expect(tokenPromise).resolves.toBe('fresh-token');
    expect(options).toMatchObject({
      sitekey: 'site-key',
      action: 'rff_quote',
      execution: 'execute',
      appearance: 'interaction-only',
    });
    expect(calls).toEqual(['execute:widget-1', 'remove:widget-1']);
  });

  it('rejects with a useful error and removes a failed widget', async () => {
    let options: TurnstileRenderOptions | undefined;
    const removed: string[] = [];
    const api: TurnstileApi = {
      render: (_container, nextOptions) => {
        options = nextOptions;
        return 'widget-2';
      },
      execute: () => undefined,
      remove: (widgetId) => removed.push(widgetId),
    };
    const broker = new TurnstileTokenBroker(api, {} as HTMLElement, 'site-key');

    const tokenPromise = broker.getToken('rff_submit');
    options!['error-callback']('network-error');

    await expect(tokenPromise).rejects.toThrow(
      'Security check failed (network-error). Try again.'
    );
    expect(removed).toEqual(['widget-2']);
  });
});
