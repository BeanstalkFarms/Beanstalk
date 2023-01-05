import React from 'react';
import {
  Button,
  Card,
  MenuList,
  Tooltip,
  Typography,
} from '@mui/material';
import DropdownIcon from '~/components/Common/DropdownIcon';
import useToggle from '~/hooks/display/useToggle';
import { RouteData } from './routes';
import MenuItem from './MenuItem';

import { FC } from '~/types';

const HoverMenu: FC<{
  items: RouteData[];
}> = ({
  children,
  items
}) => {
  const [open, show, hide] = useToggle();
  return (
    <Tooltip
      components={{ Tooltip: Card }}
      title={(
        <MenuList sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {items.map((item) => (
            <MenuItem key={item.path} item={item} onClick={hide} />
          ))}
        </MenuList>
      )}
      onOpen={show}
      onClose={hide}
      enterTouchDelay={50}
      leaveTouchDelay={10000}
      disableFocusListener
      placement="bottom-start"
      sx={{ 
        marginTop: 10,
        border: '1px solid',
        borderColor: 'divider'
      }}
      componentsProps={{
        popper: {
          sx: {
            // background: 'yellow',
            paddingTop: 0.5,
          }
        }
        
      }}
    >
      {/* Partial duplicate of LinkButton */}
      <Button
        size="small"
        variant="text"
        endIcon={<DropdownIcon open={open} />}
        sx={{
          color: 'text.primary',
          px: 1.5,
          fontSize: '1rem',
          fontWeight: '400',
        }}
        className={open ? 'Mui-focusVisible' : ''}
      >
        <Typography variant="subtitle1">
          {children}
        </Typography>
      </Button>
    </Tooltip>
  );
};

export default HoverMenu;
