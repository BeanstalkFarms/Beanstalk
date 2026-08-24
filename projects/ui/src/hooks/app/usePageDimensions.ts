import { useMemo } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import useChainState from '~/hooks/chain/useChainState';
import useRffBannerVisibility from './useRffBannerVisibility';

/// Navbar Positioning
export const BANNER_HEIGHT = 35;
export const RFF_BANNER_HEIGHT = 56;
export const RFF_BANNER_HEIGHT_MOBILE = 112;
export const NAV_HEIGHT = 64;
export const NAV_BORDER_HEIGHT = 1;
export const NAV_ELEM_HEIGHT = 45;

export default function useNavHeight(hasBanner: boolean = false) {
  const { isArbitrum } = useChainState();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isVisible: isRffBannerVisible } = useRffBannerVisibility();

  return useMemo(
    () => {
      const contextualBannerHeight = hasBanner ? BANNER_HEIGHT : 0;
      const rffBannerHeight = isArbitrum && isRffBannerVisible
        ? isMobile
          ? RFF_BANNER_HEIGHT_MOBILE
          : RFF_BANNER_HEIGHT
        : 0;

      return (
        contextualBannerHeight +
        rffBannerHeight +
        NAV_HEIGHT +
        NAV_BORDER_HEIGHT
      );
    },
    [hasBanner, isArbitrum, isMobile, isRffBannerVisible]
  );
}
