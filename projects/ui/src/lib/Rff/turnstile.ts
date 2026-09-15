export type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: 'interaction-only';
      retry: 'never';
      'response-field': false;
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
      'timeout-callback': () => void;
    }
  ) => string | undefined;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        reject(
          new Error(
            'Unable to load verification. Check your connection or content blocker and try again.'
          )
        );
      };
      const timer = setTimeout(fail, 15_000);
      script.onerror = fail;
      script.onload = () => {
        if (!window.turnstile) {
          fail();
          return;
        }
        clearTimeout(timer);
        resolve(window.turnstile);
      };
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  }
  return loading;
}

/** Render on demand: never cache or reuse a server-consumed token. */
export function requestTurnstileToken(
  container: HTMLElement,
  siteKey: string,
  signal: AbortSignal
): Promise<string> {
  if (!siteKey.trim())
    return Promise.reject(
      new Error(
        'Wallet verification is not configured. Please try again later.'
      )
    );
  let api: TurnstileApi | undefined;
  let widgetId: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void;
  let settled = false;
  return new Promise<string>((resolve, reject) => {
    const fail = (message: string) => {
      settled = true;
      reject(new Error(message));
    };
    abort = () => fail('Wallet verification cancelled.');
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(
      () => fail('Wallet verification timed out. Please try again.'),
      120_000
    );
    loadTurnstile()
      .then((loaded) => {
        if (settled) return;
        api = loaded;
        widgetId = api.render(container, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          retry: 'never',
          'response-field': false,
          callback: (token) => {
            if (!token) {
              fail('Wallet verification failed. Please try again.');
              return;
            }
            settled = true;
            resolve(token);
          },
          'error-callback': () =>
            fail('Wallet verification failed. Please try again.'),
          'expired-callback': () =>
            fail('Wallet verification expired. Please try again.'),
          'timeout-callback': () =>
            fail('Wallet verification timed out. Please try again.'),
        });
        if (widgetId === undefined)
          fail('Wallet verification could not start. Please try again.');
      })
      .catch((error) => {
        settled = true;
        reject(error);
      });
  }).finally(() => {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (api && widgetId !== undefined) api.remove(widgetId);
  });
}
