import { Box, Button, ButtonProps, Stack, Typography } from '@mui/material';
import React from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { FontSize } from '~/components/App/muiTheme';
import Row from './Row';

export type SelectionItemProps = {
  /** 
   * 
   */
  selected: boolean;
  /** 
   * Placement of the check icon
   */
  checkIcon?: 'top-left' | 'top-right';
  /** 
   * 
   */
  title?: string | JSX.Element;
  /** 
   * NOTE: pill variant ignores 'title' and 'checkIcon' props
   */
  variant?: 'pill' | 'card';
  /** 
   * 
   */
  isHovered?: boolean;
} & Omit<ButtonProps, 'variant' | 'title'>;

/**
 * border & background color are applied when 'selected' is true
 * background color is applied when hovered
 */
const SelectionItem: React.FC<SelectionItemProps> = ({
  children,
  selected,
  title,
  variant = 'card',
  checkIcon,
  disabled = false,
  isHovered,
  ...props
}) => (
  <Button
    variant="outlined"
    fullWidth
    disabled={disabled}
    {...props}
    sx={{
      border: '1px solid',
      borderRadius: variant === 'pill' ? 2.2 : 1,
      ':not(.Mui-disabled)': {
        color: selected && variant === 'pill' ? 'primary.main' : 'text.secondary',
        borderColor: selected ? 'primary.main' : 'text.light',
        backgroundColor: selected || isHovered === true ? 'primary.light' : 'transparent',
        '&:hover': {
          backgroundColor: 'primary.light',
        },
      },
      '&.Mui-disabled': {
        filter: `grayscale(${disabled ? 1 : 0})`,
      },
      p: 0,
      px: variant === 'pill' ? 1 : 0,
      py: variant === 'pill' ? '2px' : 0,
      height: 'unset',
      minHeight: 0,
      boxSizing: 'border-box',
      width: 'unset',
      minWidth: 0,
      ...props.sx,
    }}
  >
    {variant === 'pill' ? (
      <>{children}</>
    ) : (
      <Stack width="100%" p={1} gap={1}>
        {title || checkIcon ? (
          <Row
            direction={checkIcon === 'top-right' ? 'row-reverse' : 'row'}
            justifyContent={checkIcon === 'top-left' ? 'flex-start' : 'space-between'}
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
            {title 
              ? typeof title === 'string' ? (
                <Typography color="inherit">{title}</Typography>
              ) : (
                <>{title}</>
              ) 
            : null}
          </Row>
        ) : null}
        <Box sx={{ boxSizing: 'border-box', px: 1 }}>{children}</Box>
      </Stack>
    )}
  </Button>
);
export default SelectionItem;
