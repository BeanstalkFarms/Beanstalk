import React, { useEffect, useMemo, useRef } from 'react';
import { Box, BoxProps, ClickAwayListener } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { FC } from '~/types';

const BorderEffect: FC<
  {
    enabled?: boolean;
    fullWidth?: boolean;
    disabled?: boolean;
  } & BoxProps
> = ({ children, enabled = true, fullWidth = false, disabled = false }) => {
  // ref for this component to control border color
  const ref = useRef<HTMLDivElement | null>(null);

  // ref state to keep track of active state
  const activeRef = useRef<boolean>(false);

  const theme = useTheme();

  const actions = useMemo(() => {
    const handleMouseOver = () => {
      if (!ref.current || activeRef.current || disabled) return;
      ref.current.style.boxShadow = `inset 0 0 0 1px ${BeanstalkPalette.textBlue}`;
    };

    const handleMouseLeave = () => {
      if (!ref.current || activeRef.current || disabled) return;
      ref.current.style.boxShadow = `inset 0 0 0 1px ${BeanstalkPalette.inputGrey}`;
    };

    const handleOnClick = () => {
      if (!ref.current || activeRef.current || disabled) return;
      ref.current.style.boxShadow = `inset 0 0 0 2px ${theme.palette.primary.main}`;
      activeRef.current = true;
    };

    const handleClickAway = () => {
      if (!ref.current || !activeRef.current || disabled) return;
      ref.current.style.boxShadow = `inset 0 0 0 1px ${BeanstalkPalette.inputGrey}`;
      activeRef.current = false;
    };

    return {
      handleMouseOver,
      handleMouseLeave,
      handleOnClick,
      handleClickAway,
    };
  }, [disabled, theme]);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    if (disabled) {
      ref.current.style.borderColor = BeanstalkPalette.inputGrey;
    }
  }, [enabled, disabled]);

  return !enabled ? (
    <>{children}</>
  ) : (
    <Box
      ref={ref}
      sx={{
        borderRadius: 1,
        border: 'none',
        boxShadow: `inset 0 0 0 1px ${BeanstalkPalette.inputGrey}`,
        backgroundColor: BeanstalkPalette.white,
      }}
      width={fullWidth ? '100%' : undefined}
      onMouseOver={actions.handleMouseOver}
      onMouseLeave={actions.handleMouseLeave}
      onClick={actions.handleOnClick}
    >
      <ClickAwayListener onClickAway={actions.handleClickAway}>
        <Box>{children}</Box>
      </ClickAwayListener>
    </Box>
  );
};

export default BorderEffect;
