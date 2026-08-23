export type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  execution: 'execute';
  appearance: 'interaction-only';
  callback: (token: string) => void;
  'error-callback': (code: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
};

export type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

export class TurnstileTokenBroker {
  private readonly api: TurnstileApi;

  private readonly container: HTMLElement;

  private readonly siteKey: string;

  private widgetId: string | null = null;

  private queue: Promise<void> = Promise.resolve();

  private rejectActive: ((error: Error) => void) | null = null;

  private generation = 0;

  constructor(api: TurnstileApi, container: HTMLElement, siteKey: string) {
    this.api = api;
    this.container = container;
    this.siteKey = siteKey;
  }

  getToken(action: string): Promise<string> {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(action)) {
      return Promise.reject(new Error('Invalid security-check action.'));
    }

    const generation = this.generation;
    const token = this.queue.then(() => {
      if (generation !== this.generation) {
        throw new Error('Security check was reset. Try again.');
      }
      return this.executeToken(action);
    });
    this.queue = token.then(
      () => undefined,
      () => undefined
    );
    return token;
  }

  private executeToken(action: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.rejectActive = reject;
      const finish = (result: { token: string } | { error: Error }) => {
        const widgetId = this.widgetId;
        this.widgetId = null;
        this.rejectActive = null;
        if (widgetId !== null) this.api.remove(widgetId);
        if ('token' in result) resolve(result.token);
        else reject(result.error);
      };

      this.widgetId = this.api.render(this.container, {
        sitekey: this.siteKey,
        action,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token) => finish({ token }),
        'error-callback': (code) =>
          finish({
            error: new Error(`Security check failed (${code}). Try again.`),
          }),
        'expired-callback': () =>
          finish({ error: new Error('Security check expired. Try again.') }),
        'timeout-callback': () =>
          finish({ error: new Error('Security check timed out. Try again.') }),
      });
      this.api.execute(this.widgetId);
    });
  }

  dispose(): void {
    this.generation += 1;
    if (this.widgetId !== null) this.api.remove(this.widgetId);
    this.rejectActive?.(new Error('Security check was reset. Try again.'));
    this.rejectActive = null;
    this.widgetId = null;
  }
}

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-api';
const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstilePromise: Promise<TurnstileApi> | null = null;

export function loadTurnstileApi(): Promise<TurnstileApi> {
  const turnstileWindow = window as typeof window & {
    turnstile?: TurnstileApi;
  };
  if (turnstileWindow.turnstile)
    return Promise.resolve(turnstileWindow.turnstile);
  if (turnstilePromise) return turnstilePromise;

  turnstilePromise = new Promise<TurnstileApi>((resolve, reject) => {
    const handleLoad = () => {
      if (turnstileWindow.turnstile) resolve(turnstileWindow.turnstile);
      else reject(new Error('Security check did not initialize.'));
    };
    const handleError = () =>
      reject(new Error('Security check failed to load.'));
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.defer = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    turnstilePromise = null;
    throw error;
  });

  return turnstilePromise;
}
