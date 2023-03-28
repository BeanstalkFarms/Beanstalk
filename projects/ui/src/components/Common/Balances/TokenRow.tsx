import React from 'react';
import { Typography, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { Token } from '~/classes';
import TokenIcon from '../TokenIcon';
import Dot from '~/components/Common/Dot';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const TokenRow: FC<{
  /* Label */
  label: string;
  /* Display a tooltip when hovering over the label */
  labelTooltip?: string | JSX.Element;
  /* Matches color shown in pie chart */
  color?: string;
  /* */
  showColor?: boolean;
  /* If this row represents a Token, pass it */
  token?: Token;
  /* The amount of Token */
  amount?: string | JSX.Element;
  /* Display a tooltip when hovering over the amount */
  amountTooltip?: string | JSX.Element;
  /* The USD value of the amount of Token */
  value?: string | JSX.Element;
  /* Fade this row out when others are selected */
  isFaded: boolean;
  /* Show a border when this row is selected */
  isSelected?: boolean;
  /* Handlers */
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  onClick?: () => void;
}> = ({
  label,
  labelTooltip,
  color,
  showColor,
  token,
  amount,
  amountTooltip,
  value,
  isFaded = false,
  isSelected = false,
  onMouseOver,
  onMouseOut,
  onClick
}) => (
  <Row
    alignItems="flex-start"
    justifyContent="space-between"
    sx={{
      cursor: onMouseOver ? 'pointer' : 'inherit',
      py: 0.75,
      px: 0.75,
      opacity: isFaded ? 0.3 : 1,
      outline: isSelected ? `1px solid ${BeanstalkPalette.lightestGrey}` : null,
      borderRadius: 1,
    }}
    onMouseOver={onMouseOver}
    onFocus={onMouseOver}
    onMouseOut={onMouseOut}
    onBlur={onMouseOut}
    onClick={onClick}
  >
    {/* 5px gap between color and typography; shift circle back width+gap px */}
    <Row gap={0.5}>
      {color && (
        <Dot
          color={showColor ? color : 'transparent'}
          sx={{
            mt: '-2px',
            ml: '-13px'
          }}
        />
      )}
      <Typography variant="body1" color="text.primary" sx={token ? { display: 'block' } : undefined}>
        {label}
      </Typography>
      {labelTooltip && (
        <Tooltip title={labelTooltip} placement="top">
          <HelpOutlineIcon
            sx={{ color: 'text.secondary', fontSize: '14px' }}
          />
        </Tooltip>
      )}
    </Row>
    <Tooltip title={amountTooltip || ''} placement="right">
      <div>
        <Row gap={0.5}>
          {token && <TokenIcon token={token} />}
          {amount && (
            <Typography variant="body1" textAlign="right">
              {amount}
            </Typography>
          )}
          {value && (
            <Typography variant="body1" textAlign="right" display="block">
              {value}
            </Typography>
          )}
        </Row>
      </div>
    </Tooltip>
  </Row>
);

export default TokenRow;
