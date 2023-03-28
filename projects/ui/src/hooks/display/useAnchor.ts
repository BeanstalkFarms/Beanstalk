import { useCallback, useState } from 'react';

export default function useAnchor() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const toggle = useCallback((event?: any) => { // React.MouseEvent<any>
    setAnchor(anchor ? null : (event?.currentTarget || null));
  }, [anchor]);
  return [anchor, toggle] as const;
}
