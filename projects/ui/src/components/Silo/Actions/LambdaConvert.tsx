import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import TokenIcon from '~/components/Common/TokenIcon';
import useSdk from '~/hooks/sdk';
import { InfoOutlined } from '@mui/icons-material';
import Row from '~/components/Common/Row';
import stalkIconGrey from '~/img/beanstalk/stalk-icon-grey.svg';
import seedIconGrey from '~/img/beanstalk/seed-icon-grey.svg';
import { formatTV } from '~/util';
import { TokenValue } from '@beanstalk/sdk';
import { BeanstalkPalette } from '~/components/App/muiTheme';

import { LongArrowRight } from '~/components/Common/SystemIcons';
import { useTokenDepositsContext } from '../Token/TokenDepositsContext';

const LambdaConvert = () => {
  const sdk = useSdk();
  const { selected, token } = useTokenDepositsContext();
  const [combine, setCombine] = useState(false);

  const totalDeltaStalk = sdk.tokens.STALK.fromHuman('50');

  const totalDeltaStalkPct = TokenValue.fromHuman(0.000001, 0);

  const deltaSeed = sdk.tokens.SEEDS.fromHuman('150');

  const stalkPerSeason = sdk.tokens.SEEDS.fromHuman('2.012345564');

  useEffect(() => {
    if (selected.size <= 1 && combine) {
      setCombine((prev) => !prev);
    }
  }, [selected, combine]);

  return (
    <Stack gap={1}>
      <Box px={1}>
        <Typography variant="subtitle1">
          {selected.size} Deposit{selected.size === 1 ? '' : 's'} selected
        </Typography>
      </Box>
      <Card sx={{ background: 'white', borderColor: 'white', p: 2 }}>
        <Stack gap={1.5}>
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Stack>
              <Row gap={0.5}>
                <TokenIcon
                  token={sdk.tokens.STALK}
                  logoOverride={stalkIconGrey}
                  css={{ width: '20px', height: '20px' }}
                />
                <Typography variant="subtitle1" color="text.secondary">
                  {sdk.tokens.STALK.symbol}
                </Typography>
              </Row>
              <Typography
                variant="bodySmall"
                color="text.secondary"
                sx={{ pl: 2.5 }}
              >
                Ownership of Beanstalk{' '}
                <Tooltip title="Ownership of Beanstalk">
                  <InfoOutlined
                    sx={{
                      display: 'inline',
                      mb: 0.3,
                      height: '12px',
                      width: '12px',
                      color: 'text.secondary',
                    }}
                  />
                </Tooltip>
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="subtitle1" color="primary" align="right">
                + {formatTV(totalDeltaStalk, 2)}
              </Typography>
              <Typography
                variant="bodySmall"
                color="text.tertiary"
                align="right"
              >
                +{' '}
                {totalDeltaStalkPct.gte(0.01)
                  ? formatTV(totalDeltaStalkPct, 2)
                  : '<0.01'}
                %
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Stack>
              <Row gap={0.5}>
                <TokenIcon
                  token={sdk.tokens.SEEDS}
                  logoOverride={seedIconGrey}
                  css={{ width: '20px', height: '20px' }}
                />
                <Typography variant="subtitle1" color="text.secondary">
                  {sdk.tokens.SEEDS.symbol}
                </Typography>
              </Row>
              <Typography
                variant="bodySmall"
                color="text.secondary"
                sx={{ pl: 2.5 }}
              >
                Stalk Growth per Season{' '}
                <Tooltip title="Stalk grown per season">
                  <InfoOutlined
                    sx={{
                      display: 'inline',
                      mb: 0.3,
                      height: '12px',
                      width: '12px',
                      color: 'text.secondary',
                    }}
                  />
                </Tooltip>
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="subtitle1" color="primary" align="right">
                + {formatTV(deltaSeed, 2)}
              </Typography>
              <Typography
                variant="bodySmall"
                color="text.tertiary"
                align="right"
              >
                + {formatTV(stalkPerSeason, 6)}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Card>
      <Stack gap={1}>
        {combine && selected.size > 1 && (
          <Card sx={{ p: 2, background: 'white', borderColor: 'white' }}>
            <Row justifyContent="space-between">
              <Typography color="text.secondary">
                {selected.size} {token.symbol} Deposits
              </Typography>
              <LongArrowRight color="black" />
              <Typography color="text.secondary">
                1 {token.symbol} Deposit
              </Typography>
            </Row>
          </Card>
        )}
        {selected.size > 1 && (
          <Card
            sx={{
              px: 2,
              py: 1.5,
              borderColor: combine
                ? BeanstalkPalette.logoGreen
                : BeanstalkPalette.lightestGrey,
              background: combine ? BeanstalkPalette.lightestGreen : 'white',
            }}
          >
            <Row justifyContent="space-between">
              <Typography color={combine ? 'primary' : 'text.secondary'}>
                Combine Deposits of the same asset into one Deposit
              </Typography>
              <Switch
                value={combine}
                onChange={() => setCombine((prev) => !prev)}
              />
            </Row>
          </Card>
        )}
      </Stack>
      <Button size="large" disabled={!selected.size}>
        {selected.size ? 'Update Deposits' : 'Select Deposits'}
      </Button>
    </Stack>
  );
};

export default LambdaConvert;
