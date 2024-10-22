import React from 'react';
import { Button, Typography } from '@mui/material';
import { IconSize } from '~/components/App/muiTheme';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { CHAIN_INFO } from '~/constants';
import { useResolvedChainId } from '~/hooks/chain/useChainId';
import AddressIcon from './AddressIcon';

const FarmerChip: FC<{ account: string }> = ({ account }) => {
  const chainId = useResolvedChainId();
  return (
    <Button
      size="small"
      variant="text"
      color="primary"
      sx={{
        fontWeight: 400,
        color: 'text.primary',
      }}
      href={`${CHAIN_INFO[chainId].explorer}/address/${account}`}
      target="_blank"
      rel="noreferrer"
    >
      <Row gap={0.5}>
        <AddressIcon address={account} size={IconSize.xs} />
        <Typography>{account.substring(0, 6)}</Typography>
      </Row>
    </Button>
  );
};

export default FarmerChip;
