import React, { useEffect } from 'react';
import {
  Box, Button,
  Drawer,
  IconButton, Link, List, ListItemText, Stack, Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { IconSize } from '~/components/App/muiTheme';
import beanstalkLogo from '~/img/tokens/bean-logo-circled.svg';
import ROUTES from './routes';
import MenuItemMobile from './MenuItemMobile';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useToggle from '~/hooks/display/useToggle';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { BEANSTALK_ADDRESSES, CHAIN_INFO } from '~/constants';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const NavDrawer: FC<{
  open: boolean;
  hideDrawer: () => void;
}> = ({
  open,
  hideDrawer
}) => {
    const [openMore, showMore, hideMore] = useToggle();
    // Constants
    const chainInfo = useChainConstant(CHAIN_INFO);
    const beanstalkAddress = useChainConstant(BEANSTALK_ADDRESSES);

    /// closes more dropdown when drawer closes
    useEffect(() => {
      if (!open) hideMore();
    }, [open, hideMore]);

    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={hideDrawer}
        sx={{ height: '100vh' }}
        transitionDuration={0}
      >
        <Box position="fixed" sx={{ backgroundColor: 'background.paper', width: '100%', height: '100%', top: 0, overflowY: 'scroll' }}>
          {/* Beanstalk Logo & Close Button */}
          <Row alignItems="center" justifyContent="space-between" sx={{ p: 1.5 }}>
            <Box>
              <Link href="/" display="flex" alignItems="center">
                <img src={beanstalkLogo} alt="" width={IconSize.large} />
              </Link>
            </Box>
            <IconButton aria-label="close" onClick={hideDrawer} sx={{ mr: -0.8 }}>
              <CloseIcon sx={{ color: 'text.primary', fontSize: 35 }} />
            </IconButton>
          </Row>
          {/* Items */}
          <List sx={{ mt: 1, fontSize: 22 }}>
            {/* Individual Items */}
            {ROUTES.top.map((item) => (
              <Box key={item.path} sx={{ borderBottom: 2, borderColor: 'divider' }}>
                <MenuItemMobile
                  item={item}
                  onClick={hideDrawer}
                />
              </Box>
            ))}
            {/* More Dropdown */}
            <Box key="more" sx={{ borderBottom: 2, borderColor: 'divider' }}>
              <MenuItemMobile
                item={{ title: 'More', path: '#' }}
                onClick={openMore ? hideMore : showMore}
                endAdornment={<DropdownIcon open={openMore} sx={{ color: 'text.tertiary', height: IconSize.small }} />}
              />
              {/* Only show dropdown if openMore === true */}
              <Stack display={openMore ? 'block' : 'none'}>
                <Box sx={{ pl: 0.5 }}>
                  {ROUTES.more.map((item) => (
                    <MenuItemMobile
                      key={item.path}
                      item={item}
                      onClick={hideDrawer}
                    />
                  ))}
                </Box>
                <Box sx={{ px: 1, py: 0.6 }}>
                  <Button
                    fullWidth
                    href={`${chainInfo.explorer}/address/${beanstalkAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    variant="contained"
                    color="primary"
                    sx={{ py: 0.9, zIndex: 3000 }}
                  >
                    <Row alignItems="center" spacing={1}>
                      <ListItemText>
                        <Typography variant="h4">
                          Contract: {beanstalkAddress.slice(0, 6)}...
                        </Typography>
                      </ListItemText>
                      <Typography variant="body2" color="text.secondary">
                        <ArrowForwardIcon
                          sx={{ transform: 'rotate(-45deg)', fontSize: 12 }}
                        />
                      </Typography>
                    </Row>
                  </Button>
                </Box>
              </Stack>
            </Box>
          </List>
        </Box>
      </Drawer>
    );
  };

export default NavDrawer;
