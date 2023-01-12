import { Button, Typography } from '@mui/material';
import React from 'react';
import AddressIcon from '../AddressIcon';
import Row from '../Row';

export enum BalanceFrom {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  TOTAL = 'total',
}

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

const options: BalanceFrom[] = [
  BalanceFrom.TOTAL,
  BalanceFrom.EXTERNAL,
  BalanceFrom.INTERNAL,
];

const BalanceOriginField: React.FC<{
  balanceFrom: BalanceFrom;
  setBalanceFrom: (v: BalanceFrom) => void;
}> = ({ balanceFrom, setBalanceFrom }) => {
  console.log('selected: ', balanceFrom);
  return (
    <Row gap={1}>
      {options.map((option) => {
        const isSelected = balanceFrom === option;
        return (
          <Button
            key={option.toString()}
            variant="outlined"
            // color="primary"
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
                {option.toString().toLowerCase()} Balance
              </Typography>
            </Row>
          </Button>
        );
      })}
    </Row>
  );
};

export default BalanceOriginField;
