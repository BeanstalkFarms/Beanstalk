import { useMemo } from 'react';

/// Navbar Positioning
export const BANNER_HEIGHT      = 35;
export const NAV_HEIGHT         = 64;
export const NAV_BORDER_HEIGHT  = 1;
export const NAV_ELEM_HEIGHT    = 45;

export default function useNavHeight(hasBanner : boolean = false) {
  return useMemo(() => (
    hasBanner
      ? BANNER_HEIGHT + NAV_HEIGHT + NAV_BORDER_HEIGHT
      :                 NAV_HEIGHT + NAV_BORDER_HEIGHT
  ), [hasBanner]);
}
