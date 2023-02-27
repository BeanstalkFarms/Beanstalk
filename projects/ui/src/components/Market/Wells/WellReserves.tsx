import React, { useEffect, useState } from 'react';
import { Card, Divider, Stack, Typography } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import Row from '~/components/Common/Row';
import WhitelistBadge from '~/components/Market/Wells/WhitelistBadge';
import TokenIcon from '~/components/Common/TokenIcon';
import { BEAN } from '~/constants/tokens';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import useWell from '~/hooks/wells/useWell';
import PriceFunctionBadge from './PriceFunctionBadge';

export type WellProps = {
  wellId: string;
};

// Box on the right of the Well Detail page
const WellReserves: React.FC<WellProps> = ({ wellId }) => {
  const { well, loading } = useWell(wellId);

  // Loading spinner?
  return (
    <Card sx={{ height: '100%', p: 1 }}>
      {!loading && (
        <Stack justifyContent="space-between" height="100%">
          <Stack p={1} pb={2} gap={1}>
            <Row justifyContent="space-between">
              <Typography variant="h4">Well Reserves</Typography>
            </Row>
            <Stack gap={1}>
              <Row justifyContent="space-between">
                <Row gap={0.5}>
                  <TokenIcon token={BEAN[1]} />
                  <Typography>{well.reserves!.token1}</Typography>
                </Row>
                <Typography>
                  {well.reserves!.token1Amount.toLocaleString('en-us')}
                </Typography>
              </Row>
              <Row justifyContent="space-between">
                <Row gap={0.5}>
                  <TokenIcon token={BEAN[1]} />
                  <Typography>{well.reserves!.token2}</Typography>
                </Row>
                <Typography>
                  {well.reserves!.token2Amount.toLocaleString('en-us')}
                </Typography>
              </Row>
            </Stack>
          </Stack>
          <Stack gap={1}>
            <Stack p={1} gap={1}>
              {/* // TODO: Spacer? Divider? */}
              {/* // TODO: Smaller style */}
              <Row justifyContent="space-between">
                <Typography>USD Value</Typography>
              </Row>
              <Row justifyContent="space-between">
                <Typography>{well.reserves!.usdTotal}</Typography>
              </Row>
            </Stack>
          </Stack>
          <Stack gap={1}>
            <Stack p={1} gap={1}>
              {/* // TODO: Smaller style */}
              <Row justifyContent="space-between">
                <Typography>Pricing Function</Typography>
              </Row>
              {/* // TODO: Stylized  */}
              <Row justifyContent="space-between">
                <PriceFunctionBadge name={"ConstantProduct2"} />
              </Row>
            </Stack>
          </Stack>
          {/* TODO: if whitelisted, link to specific pool in the silo */}
          <Stack gap={1}>
            <Stack p={1} gap={1}>
              <Row justifyContent="space-between">
                <Typography>LP Reward</Typography>
              </Row>
              <Row justifyContent="space-between">
                <Typography>TODO</Typography>
              </Row>
            </Stack>
          </Stack>
        </Stack>
      )}
    </Card>
  );
};
export default WellReserves;
