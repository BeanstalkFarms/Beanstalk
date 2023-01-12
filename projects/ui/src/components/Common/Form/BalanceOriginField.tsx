import { Button, Typography } from '@mui/material';
import React from 'react';
import AddressIcon from '../AddressIcon';
import Row from '../Row';
import { BalanceOrigin } from './TokenInputField';

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

const options = [
  BalanceOrigin.COMBINED,
  BalanceOrigin.CIRCULATING,
  BalanceOrigin.FARM,
] as const;

const BalanceOriginField: React.FC<{
  selected: BalanceOrigin;
  setSelected: (v: BalanceOrigin) => void;
}> = ({ selected, setSelected }) => {
  console.log('selected: ', selected);
  return (
    <Row gap={1}>
      {options.map((option) => {
        const isSelected = selected === option;
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
            onClick={() => setSelected(option)}
          >
            <Row gap={0.5}>
              {option !== BalanceOrigin.FARM ? (
                <AddressIcon size={SIZE} width={SIZE} height={SIZE} />
              ) : null}
              {option !== BalanceOrigin.CIRCULATING ? (
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
