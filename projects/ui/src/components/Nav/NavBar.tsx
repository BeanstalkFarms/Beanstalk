import React from 'react';
import { AppBar, Box } from '@mui/material';
import WalletButton from '~/components/Common/Connection/WalletButton';
import NetworkButton from '~/components/Common/Connection/NetworkButton';
import PriceButton from './Buttons/PriceButton';
import SunButton from './Buttons/SunButton';
import LinkButton from './Buttons/LinkButton';
import AboutButton from './Buttons/AboutButton';
import ROUTES from './routes';
import HoverMenu from './HoverMenu';
import {
  NAV_BORDER_HEIGHT,
  NAV_ELEM_HEIGHT,
  NAV_HEIGHT,
} from '~/hooks/app/usePageDimensions';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { PAGE_BORDER_COLOR } from '../App/muiTheme';

const NavBar: FC<{}> = ({ children }) => (
  <AppBar
    // Using position: sticky means that
    // the main content region will always start
    // below the header, regardless of height!
    className="navbar"
    sx={{
      position: 'sticky',
      bgcolor: 'background.default',
      borderBottom: `${NAV_BORDER_HEIGHT}px solid ${PAGE_BORDER_COLOR}`,
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
        <Row sx={{ display: { lg: 'flex', xs: 'none' } }} height="100%">
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

export default NavBar;
