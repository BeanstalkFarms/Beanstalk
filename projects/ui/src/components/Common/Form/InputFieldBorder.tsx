import React, { useEffect, useRef } from 'react';
import { Box, BoxProps, ClickAwayListener } from '@mui/material';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { FC } from '~/types';

const InputFieldBorder: FC<
  {
    enabled?: boolean;
    fullWidth?: boolean;
    disabled?: boolean;
  } & BoxProps
> = ({
  children,
  enabled = true,
  fullWidth = false,
  disabled = false,
  ...props
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<boolean>(false);

  const handleMouseOver = () => {
    if (!ref.current || activeRef.current || disabled) return;
    ref.current.style.borderColor = BeanstalkPalette.textBlue;
  };

  const handleMouseLeave = () => {
    if (!ref.current || activeRef.current || disabled) return;
    ref.current.style.borderColor = BeanstalkPalette.inputGrey;
  };

  const handleOnClick = () => {
    if (!ref.current || activeRef.current || disabled) return;
    ref.current.style.borderColor = BeanstalkPalette.theme.winter.primary;
    activeRef.current = true;
  };

  const handleClickAway = () => {
    if (!ref.current || !activeRef.current || disabled) return;
    ref.current.style.borderColor = BeanstalkPalette.inputGrey;
    activeRef.current = false;
  };

  useEffect(() => {
    if (!enabled || !ref.current) return;
    if (disabled) {
      ref.current.style.borderColor = BeanstalkPalette.inputGrey;
    }
  }, [enabled, disabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Box
      ref={ref}
      sx={{
        borderRadius: 1,
        border: '0.75px solid',
        borderColor: BeanstalkPalette.inputGrey,
        // padding: '0.2px',
        boxSizing: 'border-box',
        backgroundColor: BeanstalkPalette.white,
      }}
      width={fullWidth ? '100%' : undefined}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      onClick={handleOnClick}
    >
      <ClickAwayListener onClickAway={handleClickAway}>
        <Box
          px={2}
          py={1}
          {...props}
          sx={{ ...props.sx, boxSizing: 'border-box' }}
        >
          {children}
        </Box>
      </ClickAwayListener>
    </Box>
  );
};

export default InputFieldBorder;
