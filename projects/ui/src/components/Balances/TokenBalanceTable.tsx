import { Typography, Stack, Grid, Card, Box } from '@mui/material';
import React from 'react';
import Row from '../Common/Row';
import { displayFullBN } from '~/util';
import { TokenBalanceWithFiatValue } from '~/hooks/farmer/useFarmerBalancesWithFiatValue';
import { BeanstalkPalette } from '../App/muiTheme';

const TokenBalanceTable: React.FC<{
  rows: TokenBalanceWithFiatValue[];
  title: JSX.Element;
  pageName?: string;
}> = ({ rows, title, pageName }) => (
  <Card sx={{ width: '100%' }}>
    <Stack spacing={1.5} pt={2} pb={1} height="100%">
      <Box px={2} pb={0.5}>
        {title}
      </Box>
      {rows.length > 0 ? (
        <Stack spacing={1} px={1}>
          <>
            <Grid container direction="row" px={2}>
              <Grid item {...{ xs: 6, sm: 5, lg: 3.5 }}>
                <Typography color="text.secondary">Token</Typography>
              </Grid>
              <Grid item {...{ xs: 6, sm: 4, lg: 4.5 }} pl={1}>
                <Stack textAlign={{ xs: 'right', sm: 'left' }}>
                  <Typography color="text.secondary">Amount</Typography>
                </Stack>
              </Grid>
              <Grid
                item
                {...{ xs: 0, sm: 3, lg: 4 }}
                display={{ xs: 'none', sm: 'block' }}
              >
                <Stack>
                  <Typography textAlign="right" color="text.secondary">
                    Value
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
            <Stack spacing={1}>
              {rows.map(({ token, amount, value }, i) => (
                <Stack
                  {...{ px: 2, py: 1 }}
                  sx={{
                    background: BeanstalkPalette.white,
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                  key={i}
                >
                  <Grid
                    container
                    direction="row"
                    spacing={2}
                    alignItems="center"
                  >
                    <Grid item {...{ xs: 6, sm: 5, lg: 3.5 }}>
                      <Row gap={1} alignItems="center">
                        <img
                          src={token.logo}
                          alt=""
                          height="20px"
                          width="20px"
                          style={{ borderRadius: '50%' }}
                        />
                        <Typography>{token.symbol}</Typography>
                      </Row>
                    </Grid>
                    <Grid item {...{ xs: 6, sm: 4, lg: 4.5 }}>
                      <Stack textAlign={{ xs: 'right', sm: 'left' }}>
                        <Typography>
                          {displayFullBN(amount, token.displayDecimals)}{' '}
                          {token.symbol}
                        </Typography>
                      </Stack>
                    </Grid>
                    <Grid
                      item
                      {...{ xs: 0, sm: 3, lg: 4 }}
                      display={{ xs: 'none', sm: 'block' }}
                    >
                      <Stack>
                        <Typography textAlign="right">
                          ${displayFullBN(value, 2)}
                        </Typography>
                      </Stack>
                    </Grid>
                  </Grid>
                </Stack>
              ))}
            </Stack>
          </>
        </Stack>
      ) : (
        <Stack height="100%" alignItems="center" justifyContent="center" pb={2}>
          <Typography color="text.tertiary">
            {`You don't have any tokens in your ${pageName} Balance`}
          </Typography>
        </Stack>
      )}
    </Stack>
  </Card>
);

export default TokenBalanceTable;
