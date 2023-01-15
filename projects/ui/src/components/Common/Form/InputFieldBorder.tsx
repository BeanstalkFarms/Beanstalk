import { Box, BoxProps, ClickAwayListener } from '@mui/material';
import React, { useEffect, useMemo } from 'react';
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
  const ref = React.useRef<HTMLDivElement | null>(null);
  const activeRef = React.useRef<boolean>(false);

  const actions = useMemo(() => {
    const handleMouseOver = () => {
      if (!ref.current || activeRef.current || disabled) return;
      ref.current.style.borderColor =
        BeanstalkPalette.theme.winter.primaryHover;
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

    return {
      handleMouseOver,
      handleMouseLeave,
      handleOnClick,
      handleClickAway,
    };
  }, [disabled]);

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
        border: '1px solid',
        borderColor: BeanstalkPalette.inputGrey,
        padding: '1px',
        boxSizing: 'border-box',
        backgroundColor: BeanstalkPalette.white,
      }}
      width={fullWidth ? '100%' : undefined}
      onMouseOver={actions.handleMouseOver}
      onMouseLeave={actions.handleMouseLeave}
      onClick={actions.handleOnClick}
    >
      <ClickAwayListener onClickAway={actions.handleClickAway}>
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
