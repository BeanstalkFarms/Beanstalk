import React from 'react';
import {
  Box,
  Button,
  ButtonProps,
  Stack,
  StackProps,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';
import Row from './Row';

export type SelectionItemProps = {
  /**
   *
   */
  selected: boolean;
  /**
   * Placement of the check icon
   */
  checkIcon?: 'top-left' | 'top-right' | 'left';
  /**
   * NOTE: only 'card' variant supports title
   */
  title?: string | JSX.Element;
  /**
   * NOTE: pill & circle variants ignore 'title' and 'checkIcon' props
   */
  variant?: 'pill' | 'card' | 'circle';
  /**
   *
   */
  isHovered?: boolean;
  /**
   * Relevant to only 'card' && circle variant
   */
  gap?: number;
  /**
   * whether to show light background on hover. Default true
   */
  backgroundOnHover?: boolean;
  /**
   *
   */
  stackProps?: StackProps;
} & Omit<ButtonProps, 'variant' | 'title'>;

const SelectionItem: React.FC<SelectionItemProps> = ({
  children,
  selected,
  title,
  variant = 'card',
  checkIcon,
  disabled = false,
  isHovered,
  backgroundOnHover = true,
  gap = 1,
  stackProps,
  ...props
}) => {
  const isPill = variant === 'pill';
  const isCircle = variant === 'circle';
  const isCard = variant === 'card';
  const checkIconLeft = checkIcon === 'left';

  return (
    <Button
      variant="outlined"
      fullWidth
      disabled={disabled}
      {...props}
      sx={{
        border: '1px solid',
        borderRadius: isPill ? 2.2 : 1,
        ':not(.Mui-disabled)': {
          color: selected && isPill ? 'primary.main' : 'text.secondary',
          borderColor: selected ? 'primary.main' : 'text.light',
          backgroundColor:
            backgroundOnHover && (isHovered || selected)
              ? 'primary.light'
              : BeanstalkPalette.white,
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: !backgroundOnHover
              ? BeanstalkPalette.white
              : 'primary.light',
          },
        },
        '&.Mui-disabled': {
          filter: `grayscale(${disabled ? 1 : 0})`,
        },
        p: 0,
        px: isPill ? 1 : 0,
        py: isPill ? '2px' : 0,
        height: 'unset',
        minHeight: 0,
        boxSizing: 'border-box',
        minWidth: 0,
        ...props.sx,
      }}
    >
      {isPill ? (
        <>{children}</>
      ) : (
        <Stack
          width="100%"
          p={isCard ? 1 : 0}
          direction={checkIconLeft ? 'row' : 'column'}
          gap={gap}
          sx={{
            borderRadius: isCircle ? '50%' : undefined,
            ...stackProps?.sx,
          }}
          {...stackProps}
        >
          {(title || checkIcon) && isCard ? (
            <Row
              direction={checkIcon === 'top-right' ? 'row-reverse' : 'row'}
              justifyContent={
                checkIcon === 'top-left' ? 'flex-start' : 'space-between'
              }
              alignItems={checkIcon === 'left' ? 'center' : undefined}
              gap={0.5}
            >
              {checkIcon ? (
                <Box sx={{ maxWidth: FontSize.base, height: FontSize.base }}>
                  <CheckCircleRoundedIcon
                    sx={{
                      borderRadius: '100%',
                      border: `${selected ? 0 : 1}px solid`,
                      borderColor: selected ? 'primary.main' : 'text.light',
                      color: selected ? 'primary.main' : 'transparent',
                      transform: `scale(${selected ? 1.2 : 1})`,
                      width: '100%',
                      height: 'auto',
                    }}
                  />
                </Box>
              ) : null}
              {title ? (
                typeof title === 'string' ? (
                  <Typography color="inherit">{title}</Typography>
                ) : (
                  <>{title}</>
                )
              ) : null}
            </Row>
          ) : null}
          <Box sx={{ display: 'flex', flexGrow: '1' }}>{children}</Box>
        </Stack>
      )}
    </Button>
  );
};
export default SelectionItem;
