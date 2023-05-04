import { FarmFromMode } from '@beanstalk/sdk';
import { Button, Typography } from '@mui/material';
import React from 'react';
import AddressIcon from '../AddressIcon';
import Row from '../Row';

export enum BalanceFrom {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  TOTAL = 'total',
}

export const balanceFromToMode = (from: BalanceFrom) => {
  switch (from) {
    case BalanceFrom.EXTERNAL: 
      return FarmFromMode.EXTERNAL;
    case BalanceFrom.INTERNAL:
      return FarmFromMode.INTERNAL;
    default:
      return FarmFromMode.INTERNAL_EXTERNAL;
  }
};

const selectedSx = {
  color: 'primary.main',
  borderColor: 'primary.main',
  backgroundColor: 'primary.light',
};

const unselectedSx = {
  color: 'text.primary',
  borderColor: 'text.light',
};

const SIZE = 20;

export const balanceFromLabels = {
  [BalanceFrom.INTERNAL]: 'Farm',
  [BalanceFrom.EXTERNAL]: 'Circulating',
  [BalanceFrom.TOTAL]: 'Combined',
};

const options: BalanceFrom[] = [
  BalanceFrom.TOTAL,
  BalanceFrom.EXTERNAL,
  BalanceFrom.INTERNAL,
];

const BalanceFromRow: React.FC<{
  balanceFrom: BalanceFrom;
  setBalanceFrom: (v: BalanceFrom) => void;
}> = ({ balanceFrom, setBalanceFrom }) => (
  <Row gap={1}>
    {options.map((option) => {
      const isSelected = balanceFrom === option;
      return (
        <Button
          key={option.toString()}
          variant="outlined"
          sx={{
            px: 0.75,
            py: 0.5,
            height: 'unset',
            backgroundColor: 'white',
            border: '1px solid',
            ':hover': {
              borderColor: 'text.light',
              background: 'primary.light',
              ...(isSelected ? selectedSx : {}),
            },
            ...(isSelected ? selectedSx : unselectedSx),
          }}
          onClick={() => setBalanceFrom(option)}
        >
          <Row gap={0.5}>
            {option !== BalanceFrom.INTERNAL ? (
              <AddressIcon size={SIZE} width={SIZE} height={SIZE} />
            ) : null}
            {option !== BalanceFrom.EXTERNAL ? (
              <Typography variant="body1">🚜</Typography>
            ) : null}
            <Typography
              color="text.primary"
              sx={{ textTransform: 'capitalize' }}
            >
              {balanceFromLabels[option]} Balance
            </Typography>
          </Row>
        </Button>
      );
    })}
  </Row>
);

export default BalanceFromRow;
