import React, { useState } from 'react';
import { Stack, Typography, Box } from '@mui/material';
import BigNumber from 'bignumber.js';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { BeanstalkToken } from '@beanstalk/sdk';
import { Link } from 'react-router-dom';
import { displayFullBN } from '~/util';
import EmbeddedCard from '../Common/EmbeddedCard';
import Row from '../Common/Row';
import TokenIcon from '../Common/TokenIcon';
import { BeanstalkPalette } from '../App/muiTheme';

const ThinDivider: React.FC<{}> = () => (
  <Box
    sx={{
      width: '100%',
      borderTop: '0.5px solid',
      borderColor: BeanstalkPalette.lightestGrey,
      height: '0.5px',
    }}
  />
);

const FieldInfo: React.FC<{
  harvestableIndex: BigNumber;
  PODS: BeanstalkToken;
}> = ({ harvestableIndex, PODS }) => {
  const [open, setOpen] = useState(false);

  const handleOnClick = () => {
    setOpen((prev) => !prev);
  };

  return (
    <Stack gap={2}>
      <EmbeddedCard>
        <Row p={2} width="100%" justifyContent="space-between">
          <Stack gap={0.25}>
            <Row gap={0.5}>
              <Typography>Pods Previously Harvested:</Typography>
              <TokenIcon token={PODS} />
              <Typography component="span" variant="h4">
                {displayFullBN(harvestableIndex, 0)}
              </Typography>
            </Row>
            <Typography color="text.secondary">
              Paid back by Beanstalk since Season 1, does not count towards the
              current Pod Line
            </Typography>
          </Stack>
          <Link to="/analytics?field=harvested">
            <ChevronRightIcon fontSize="small" />
          </Link>
        </Row>
      </EmbeddedCard>
      <EmbeddedCard>
        <Stack p={2} gap={2}>
          <Typography variant="h4">🌾 Overview</Typography>
          <ThinDivider />
          <Typography>
            The Field is Beanstalk&#39;s credit facility. Beanstalk relies on a
            decentralized set of creditors to maintain Bean price stability.
            Farmers who Sow Beans (lend Beans to Beanstalk) are known as Sowers.
            Beans are Sown in exchange for Pods, the Beanstalk-native debt
            asset. Loans to Beanstalk are issued with a fixed interest rate,
            known as Temperature, and an unknown maturity date.
          </Typography>
          {open ? (
            <>
              <Typography>
                The number of Pods received from 1 Sown Bean is determined by
                the Temperature at the time of Sowing. Newly issued Pods
                accumulate in the back of the Pod Line. The front of the Pod
                Line receives 1/3 of new Bean mints when there are more than
                zero Unfertilized Sprouts (Sprouts are issued by the Barn). If
                there are no Unfertilized Sprouts, the front of the Pod Line
                receives 1/2 of new Bean mints.
              </Typography>
              <Typography>
                Pods Ripen into Harvestable Pods that can be Harvested
                (redeemed) for 1 Bean each on a First In, First Out (FIFO)
                basis. There is no penalty for waiting to Harvest Pods.
              </Typography>
              <Typography>
                Pods are tradeable on the Pod Market. Pods can also be
                Transferred to another address directly.
              </Typography>
            </>
          ) : null}
          <ThinDivider />
          <Typography
            onClick={handleOnClick}
            sx={{
              alignSelf: 'center',
              cursor: 'pointer',
              ':hover': {
                color: 'primary.main',
              },
            }}
          >
            {open ? 'View less' : 'View more'}
          </Typography>
        </Stack>
      </EmbeddedCard>
    </Stack>
  );
};

export default FieldInfo;
