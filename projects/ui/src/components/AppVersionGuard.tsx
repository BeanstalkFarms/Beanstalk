/* global __BEANSTALK_APP_VERSION__ */
import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const VERSION_URL = '/version.json';
const INITIAL_CHECK_DELAY_MS = 30_000;
const CHECK_INTERVAL_MS = 5 * 60_000;
const FOCUS_CHECK_THROTTLE_MS = 60_000;

type AppVersion = typeof __BEANSTALK_APP_VERSION__;

const fetchLatestVersion = async (): Promise<
  Partial<AppVersion> | undefined
> => {
  const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return undefined;
  }

  return response.json();
};

const reloadApp = () => {
  window.location.reload();
};

export default function AppVersionGuard() {
  const isCheckingRef = useRef(false);
  const isStaleRef = useRef(false);
  const hasNotifiedRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return;
    }

    let isDisposed = false;

    const handleStaleVersion = () => {
      if (isDisposed || isStaleRef.current) {
        return;
      }

      isStaleRef.current = true;

      if (document.visibilityState === 'hidden') {
        reloadApp();
        return;
      }

      if (hasNotifiedRef.current) {
        return;
      }

      hasNotifiedRef.current = true;
      toast(
        <span>
          A new Beanstalk version is available.
          <button
            type="button"
            onClick={reloadApp}
            style={{
              marginLeft: 12,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
              textDecoration: 'underline',
            }}
          >
            Reload
          </button>
        </span>,
        { duration: Infinity, id: 'app-version-update' }
      );
    };

    const checkForLatestVersion = async (force = false) => {
      if (isDisposed || isStaleRef.current || isCheckingRef.current) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastCheckAtRef.current < FOCUS_CHECK_THROTTLE_MS) {
        return;
      }

      lastCheckAtRef.current = now;
      isCheckingRef.current = true;

      try {
        const latestVersion = await fetchLatestVersion();
        if (
          latestVersion?.buildId &&
          latestVersion.buildId !== __BEANSTALK_APP_VERSION__.buildId
        ) {
          handleStaleVersion();
        }
      } catch {
        // Version checks are best-effort; temporary network failures should not affect app usage.
      } finally {
        isCheckingRef.current = false;
      }
    };

    const handleFocus = () => {
      checkForLatestVersion();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isStaleRef.current) {
        reloadApp();
        return;
      }

      if (document.visibilityState === 'visible') {
        checkForLatestVersion(true);
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkForLatestVersion(true);
      }
    };

    const initialCheckId = window.setTimeout(() => {
      checkForLatestVersion(true);
    }, INITIAL_CHECK_DELAY_MS);
    const intervalId = window.setInterval(() => {
      checkForLatestVersion();
    }, CHECK_INTERVAL_MS);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
