import { useCallback, useState } from 'react';

export default function useToggle(
  onShow?: (e?: any) => void,
  onHide?: (e?: any) => void
) {
  const [open, setOpen] = useState(false);
  // `e?: any` -> if the callback is used
  // as an event handler, pass the event
  // through to the onShow/onHide helpers.
  const show = useCallback(
    (e?: any) => {
      setOpen(true);
      onShow?.(e);
    },
    [onShow]
  );
  const hide = useCallback(
    (e?: any) => {
      setOpen(false);
      onHide?.(e);
    },
    [onHide]
  );
  return [open, show, hide] as const;
}
