import React from 'react';
import {
  Box,
  Button,
  ButtonProps,
  Stack,
  Tooltip,
  Typography,
  StackProps as MuiStackProps,
  TypographyProps
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { BeanstalkPalette, FontSize } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';

/**
 * Shows a standard Button with various slots for standard sizing
 * and positioning of elements, like tooltips and tags.
 * Rewards dialog (Mow, Plant, Enroot, Claim All buttons)
 * Pick dialog (Pick, Pick and Deposit)
 * PillSelectField (provides buttons for things like DestinationField)
 * Governance page
 */
import { FC } from '~/types';

const GAP = 2;

const DescriptionButton: FC<ButtonProps & {
  /** Title */
  title?: string;
  /** Description displayed below the title. */
  description?: string;
  /** Icon displayed next to the title. */
  icon?: React.ReactNode | string;
  /** Small element displayed on the right side of the button. */
  tag?: JSX.Element;
  /** Tooltip message to show next to the title if provided. */
  titleTooltip?: string;
  /** Whether the button is currently selected. */
  isSelected?: boolean;
  /** Props to apply to the first <Stack> that controls the button's internal layout. */
  StackProps?: MuiStackProps;
  /** Props applied to the title <Typography>. */
  TitleProps?: TypographyProps;
}> = ({
  title,
  description,
  icon,
  tag,
  isSelected,
  titleTooltip,
  StackProps,
  TitleProps,
  sx,
  ...props
}) => (
  <Button
    variant="outlined"
    color="secondary"
    sx={{
      textAlign: 'left',
      px: GAP,
      py: GAP,
      ...sx,
      // Prevents the button's flex properties from
      // changing the internal layout.
      display: 'block',
      color: 'inherit',
      borderColor: isSelected ? 'primary.main' : 'divider',
      backgroundColor: isSelected ? BeanstalkPalette.theme.winter.primaryHover : null,
      '&:hover': {
        backgroundColor: isSelected ? BeanstalkPalette.theme.winter.primaryHover : null,
        borderColor: 'primary.main'
      },
      height: 'auto'
    }}
    {...props}
  >
    <Row gap={0.5} justifyContent="space-between" {...StackProps}>
      {/* Icon + Title */}
      <Stack gap={0.5}>
        <Row gap={0.25}>
          {icon && (
            <>
              {icon}&nbsp;
            </>
          )}
          <Typography variant="bodyMedium" {...TitleProps}>
            {title}
            <Tooltip title={titleTooltip || ''} placement="top" sx={{ pointerEvents: 'all' }}>
              <>
                {titleTooltip && (
                  <>
                    &nbsp;
                    <HelpOutlineIcon sx={{ color: 'text.tertiary', fontSize: FontSize.sm, display: 'inline' }} />
                  </>
                )}
              </>
            </Tooltip>
          </Typography>
        </Row>
        {/* Description */}
        {description && (
          <Typography>
            {description}
          </Typography>
        )}
      </Stack>
      {tag && (
        <Box sx={{ flexWrap: 'nowrap' }}>
          {tag}
        </Box>
      )}
    </Row>
  </Button>
);

export default DescriptionButton;
