import { Typography, Stack } from '@mui/material';
import React from 'react';
import Row from '../Common/Row';
import AddressIcon from '~/components/Common/AddressIcon';
import useFarmerBalancesWithFiatValue from '~/hooks/farmer/useFarmerBalancesWithFiatValue';
import TokenBalanceTable from '~/components/Balances/TokenBalanceTable';

/**
 * Show a card containing a TokenBalanceTable for
 * INTERNAL and EXTERNAL balances.
 */
const TokenBalanceCards: React.FC<{}> = () => {
  const { internal, external } = useFarmerBalancesWithFiatValue();
  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} gap={2} width="100%">
      <TokenBalanceTable
        rows={internal}
        title={<Typography variant="h4">🚜 Farm Balance</Typography>}
        pageName="Farm"
      />
      <TokenBalanceTable
        rows={external}
        title={
          <Row gap={0.5}>
            <AddressIcon size={16} />
            <Typography variant="h4" component="span">
              Circulating Balance
            </Typography>
          </Row>
        }
        pageName="Circulating"
      />
    </Stack>
  );
};

export default TokenBalanceCards;
