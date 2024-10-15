import React from 'react';
import { AppBar, Box, useMediaQuery, useTheme } from '@mui/material';
import WalletButton from '~/components/Common/Connection/WalletButton';
import NetworkButton from '~/components/Common/Connection/NetworkButton';
import {
  NAV_BORDER_HEIGHT,
  NAV_ELEM_HEIGHT,
  NAV_HEIGHT,
} from '~/hooks/app/usePageDimensions';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import useChainState from '~/hooks/chain/useChainState';
import PriceButton from './Buttons/PriceButton';
import SunButton from './Buttons/SunButton';
import LinkButton from './Buttons/LinkButton';
import AboutButton from './Buttons/AboutButton';
import ROUTES from './routes';
import HoverMenu from './HoverMenu';

import { PAGE_BORDER_COLOR } from '../App/muiTheme';
import BeanProgressIcon from '../Common/BeanProgressIcon';

const L1NavBar = ({ isMobile }: { isMobile: boolean }) => (
  <>
    <AppBar
      className="navbar"
      sx={{
        position: 'sticky',
        bgcolor: 'background.default',
        borderBottom: `${NAV_BORDER_HEIGHT}px solid ${PAGE_BORDER_COLOR}`,
        zIndex: 80,
      }}
    >
      {/* Desktop: Right Side */}
      <Row
        justifyContent="space-between"
        gap={isMobile ? 0 : 1}
        px={1}
        height={`${NAV_HEIGHT}px`}
      >
        <Box
          px={isMobile ? 1 : 2}
          height={`${NAV_HEIGHT}px`}
          sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: isMobile ? 0 : 2,
            alignItems: 'center',
          }}
        >
          <BeanProgressIcon size={25} enabled={false} variant="indeterminate" />
          <LinkButton key="/" to="/" title="Migration" />
          <LinkButton key="/l1transfer" to="/l1transfer" title="Transfer" />
        </Box>
        <Row gap={1}>
          <Box sx={{ display: { sm: 'block', xs: 'none' } }}>
            <NetworkButton sx={{ height: NAV_ELEM_HEIGHT }} />
          </Box>
          <WalletButton sx={{ height: NAV_ELEM_HEIGHT }} />
          <AboutButton sx={{ height: NAV_ELEM_HEIGHT }} />
        </Row>
      </Row>
    </AppBar>
  </>
);

const NavBar: FC<{}> = ({ children }) => {
  const { isArbitrum, isArbMainnet } = useChainState();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!isArbitrum) {
    return <L1NavBar isMobile={isMobile} />;
  }

  return (
    <AppBar
      // Using position: sticky means that
      // the main content region will always start
      // below the header, regardless of height!
      className="navbar"
      sx={{
        position: 'sticky',
        bgcolor: 'background.default',
        borderBottom: `${NAV_BORDER_HEIGHT}px solid ${PAGE_BORDER_COLOR}`,
        zIndex: 80,
      }}
    >
      {children}
      <Row
        justifyContent="space-between"
        height={`${NAV_HEIGHT}px`}
        px={1}
        gap={1}
      >
        {/* Desktop: Left Side */}
        <Row sx={{ flex: 1 }} height="100%" gap={1}>
          <PriceButton sx={{ height: NAV_ELEM_HEIGHT }} />
          <SunButton sx={{ height: NAV_ELEM_HEIGHT }} />
          <Row
            sx={{ display: { lg: 'flex', xs: 'none' } }}
            height="100%"
            data-cy="Navbar-links"
          >
            {ROUTES.top.map((item) => (
              <LinkButton
                key={item.path}
                to={item.path}
                title={item.title}
                tag={item.tag}
              />
            ))}
            <HoverMenu items={ROUTES.more}>More</HoverMenu>
          </Row>
        </Row>
        {/* Desktop: Right Side */}
        <Row justifyContent="flex-end" gap={1}>
          <Box sx={{ display: { sm: 'block', xs: 'none' } }}>
            <NetworkButton sx={{ height: NAV_ELEM_HEIGHT }} />
          </Box>
          <WalletButton sx={{ height: NAV_ELEM_HEIGHT }} />
          <AboutButton sx={{ height: NAV_ELEM_HEIGHT }} />
        </Row>
      </Row>
    </AppBar>
  );
};

export default NavBar;
