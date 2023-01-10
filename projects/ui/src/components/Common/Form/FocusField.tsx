import { Box, ClickAwayListener } from '@mui/material';
import React from 'react';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { FC } from '~/types';

const CTA_GREY = '#F0F0F0';

type IInputFieldBorder = {
  enabled?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
};

const InputFieldBorder: FC<IInputFieldBorder> = ({
  children,
  enabled = true,
  fullWidth = false,
  disabled = false,
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const activeRef = React.useRef<boolean>(false);

  const handleMouseOver = () => {
    if (!ref.current || activeRef.current || disabled) return;
    ref.current.style.borderColor = BeanstalkPalette.hoverGreen;
  };

  const handleMouseLeave = () => {
    if (!ref.current || activeRef.current || disabled) return;
    ref.current.style.borderColor = BeanstalkPalette.inputGrey;
  };

  const handleOnClick = () => {
    if (!ref.current || activeRef.current || disabled) return;
    ref.current.style.padding = '0px';
    ref.current.style.border = '2px solid';
    ref.current.style.borderColor = BeanstalkPalette.theme.winter.primary;
    activeRef.current = true;
  };

  const handleClickAway = () => {
    if (!ref.current || !activeRef.current || disabled) return;
    ref.current.style.padding = '1px';
    ref.current.style.border = '1px solid';
    ref.current.style.borderColor = BeanstalkPalette.inputGrey;
    activeRef.current = false;
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Box
      ref={ref}
      sx={{
        borderRadius: 1,
        border: '1px solid',
        padding: '1px',
        boxSizing: 'border-box',
        backgroundColor: 'white',
        borderColor: CTA_GREY,
      }}
      width={fullWidth ? '100%' : undefined}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      onClick={handleOnClick}
    >
      <ClickAwayListener onClickAway={handleClickAway}>
        <Box width="100%" px={2} py={1}>
          {children}
        </Box>
      </ClickAwayListener>
    </Box>
  );
};

export default InputFieldBorder;
