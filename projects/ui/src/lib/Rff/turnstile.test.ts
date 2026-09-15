// @vitest-environment jsdom
import { vi } from 'vitest';
import { requestTurnstileToken, type TurnstileApi } from './turnstile';

let container: HTMLDivElement;
let options: Parameters<TurnstileApi['render']>[1];
let api: TurnstileApi;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  api = {
    render: vi.fn((_container, input) => {
      options = input;
      return 'widget';
    }),
    remove: vi.fn(),
  };
  window.turnstile = api;
});
afterEach(() => {
  container.remove();
  delete window.turnstile;
  vi.useRealTimers();
});
async function start(signal = new AbortController().signal) {
  const result = requestTurnstileToken(container, 'site-key', signal);
  await Promise.resolve();
  await Promise.resolve();
  return { result };
}
it('gets a fresh single-use token for each action and removes completed widgets', async () => {
  const first = await start();
  options.callback('first');
  await expect(first.result).resolves.toBe('first');
  const second = await start();
  options.callback('second');
  await expect(second.result).resolves.toBe('second');
  expect(api.render).toHaveBeenCalledTimes(2);
  expect(api.remove).toHaveBeenCalledTimes(2);
});
it.each(['error-callback', 'expired-callback', 'timeout-callback'] as const)(
  'rejects %s and allows retry',
  async (callback) => {
    const { result } = await start();
    const rejected = expect(result).rejects.toThrow(/verification/i);
    options[callback]();
    await rejected;
    expect(api.remove).toHaveBeenCalledWith('widget');
    const retry = await start();
    options.callback('retry');
    await expect(retry.result).resolves.toBe('retry');
  }
);
it('cancels and cleans up when the screen closes', async () => {
  const controller = new AbortController();
  const { result } = await start(controller.signal);
  const rejected = expect(result).rejects.toThrow(/cancelled/i);
  controller.abort();
  await rejected;
  expect(api.remove).toHaveBeenCalledWith('widget');
});
it('times out rather than leaving an action pending forever', async () => {
  vi.useFakeTimers();
  const { result } = await start();
  const rejected = expect(result).rejects.toThrow(/timed out/i);
  vi.advanceTimersByTime(120_000);
  await rejected;
  expect(api.remove).toHaveBeenCalledWith('widget');
});
it('reports a blocked script and can load it again on retry', async () => {
  delete window.turnstile;
  const first = await start();
  const rejected = expect(first.result).rejects.toThrow(/load verification/i);
  document
    .querySelector('script[src*="challenges.cloudflare.com"]')!
    .dispatchEvent(new Event('error'));
  await rejected;
  const retry = await start();
  window.turnstile = api;
  document
    .querySelector('script[src*="challenges.cloudflare.com"]')!
    .dispatchEvent(new Event('load'));
  await Promise.resolve();
  await Promise.resolve();
  options.callback('loaded');
  await expect(retry.result).resolves.toBe('loaded');
});
it('fails clearly if the service has no site key', async () => {
  await expect(
    requestTurnstileToken(container, '', new AbortController().signal)
  ).rejects.toThrow(/not configured/);
  expect(api.render).not.toHaveBeenCalled();
});
