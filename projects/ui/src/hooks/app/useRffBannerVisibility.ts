import { useCallback, useEffect, useState } from 'react';

const DISMISSAL_STORAGE_KEY = 'beanstalk:rff-banner-dismissed-until';
const VISIBILITY_CHANGE_EVENT = 'beanstalk:rff-banner-visibility-change';
const DISMISSAL_DURATION_MS = 24 * 60 * 60 * 1000;

const getDismissedUntil = () => {
  if (typeof window === 'undefined') return 0;

  try {
    const storedValue = window.localStorage.getItem(DISMISSAL_STORAGE_KEY);
    const dismissedUntil = Number(storedValue);
    return Number.isFinite(dismissedUntil) ? dismissedUntil : 0;
  } catch {
    return 0;
  }
};

const getIsVisible = () => getDismissedUntil() <= Date.now();

export default function useRffBannerVisibility() {
  const [isVisible, setIsVisible] = useState(getIsVisible);

  useEffect(() => {
    const syncVisibility = () => setIsVisible(getIsVisible());

    window.addEventListener('storage', syncVisibility);
    window.addEventListener(VISIBILITY_CHANGE_EVENT, syncVisibility);

    const dismissedUntil = getDismissedUntil();
    const remainingDismissalTime = dismissedUntil - Date.now();
    const expiryTimer =
      remainingDismissalTime > 0
        ? window.setTimeout(syncVisibility, remainingDismissalTime)
        : undefined;

    return () => {
      window.removeEventListener('storage', syncVisibility);
      window.removeEventListener(VISIBILITY_CHANGE_EVENT, syncVisibility);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, [isVisible]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(
        DISMISSAL_STORAGE_KEY,
        String(Date.now() + DISMISSAL_DURATION_MS)
      );
    } catch {
      // The banner still dismisses for this page view if storage is unavailable.
    }

    setIsVisible(false);
    window.dispatchEvent(new Event(VISIBILITY_CHANGE_EVENT));
  }, []);

  return { isVisible, dismiss };
}
