import React from 'react';

import { Box, styled } from '@mui/material';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';

import { BeanstalkPalette } from '../App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const PaginationItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>(({ isActive, theme }) => theme.unstable_sx({
  height: '5px',
  minWidth: '20px',
  width: '100%',
  borderRadius: 0.5,
  background: isActive
    ? theme.palette.primary.main
    : BeanstalkPalette.lightestGrey,
  cursor: 'pointer',
}));

const PaginationArrow: FC<{
  disabled: boolean;
  isRightArrow?: boolean;
  onClick: () => void;
}> = ({ disabled, isRightArrow = false, onClick }) => (
  <KeyboardBackspaceIcon
    onClick={onClick}
    sx={{
      transform: `rotate(${isRightArrow ? '180' : '0'}deg)`,
      cursor: disabled ? 'default' : 'pointer',
      color: disabled ? 'text.tertiary' : 'text.primary',
      ':hover': { 
        color: disabled ? 'text.tertiary' : 'primary.main'
      }
    }}
  />
);

interface Props {
  total: number;
  page: number;
  onPageClick: (page: number) => void;
  config?: {
    showNavigationButton?: boolean;
  };
}

const PaginationControl: FC<Props> = ({
  total,
  page,
  onPageClick,
  config: { showNavigationButton = true } = {},
}) => {
  const canDecrement = page > 0;
  const canIncrement = page < total - 1;

  return (
    <Row width="100%" gap={1.5}>
      {showNavigationButton ? (
        <PaginationArrow
          disabled={!canDecrement}
          onClick={() => {
            canDecrement && onPageClick(page - 1);
          }}
        />
      ) : null}
      {Array(total)
        .fill(null)
        .map((_item, idx) => (
          <PaginationItem
            key={idx}
            isActive={idx === page}
            onClick={() => onPageClick(idx)}
          />
        ))}
      {showNavigationButton ? (
        <PaginationArrow
          disabled={!canIncrement}
          onClick={() => {
            canIncrement && onPageClick(page + 1);
          }}
          isRightArrow
        />
      ) : null}
    </Row>
  );
};

export default PaginationControl;
