import React from 'react';
import { Box, Button, Card, Grid, Stack, Tooltip, Typography } from '@mui/material';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { Link as RouterLink } from 'react-router-dom';
import TokenIcon from '~/components/Common/TokenIcon';
import { BEAN } from '~/constants/tokens';
import useSetting from '~/hooks/app/useSetting';
import Row from '~/components/Common/Row';
import WhitelistBadge from '~/components/Market/Wells/WhitelistBadge';

const ARROW_CONTAINER_WIDTH = 20;
const TOOLTIP_COMPONENT_PROPS = {
  tooltip: {
    sx: {
      maxWidth: 'none !important',
      boxShadow: '0px 6px 20px 10px rgba(255,255,255,0.3) !important'
    }
  }
};

/**
 *
 */
const Wells : React.FC = () => {
  /// Settings
  const [denomination] = useSetting('denomination');

  return (
    <Card>
      <Box
        display="flex"
        sx={{
          px: 3,      // 1 + 2 from Table Body
          pt: '14px', // manually adjusted
          pb: '5px',  // manually adjusted
          borderBottomStyle: 'solid',
          borderBottomColor: 'secondary.main',
          borderBottomWidth: 1.5,
        }}
      >
        <Grid container alignItems="flex-end">
          <Grid item md={3.75} xs={4}>
            <Typography color="gray">Liquidity Well</Typography>
          </Grid>
          <Grid item md={2.25} xs={0} display={{ xs: 'none', md: 'block' }}>
            <Tooltip title="Tooltip">
              <Typography color="gray">
                Type
              </Typography>
            </Tooltip>
          </Grid>
          <Grid item md={2} xs={0} display={{ xs: 'none', md: 'block' }}>
            <Tooltip title="Total Value Deposited in the Silo.">
              <Typography color="gray">Total Liquidity</Typography>
            </Tooltip>
          </Grid>
          <Grid item md={2} xs={0} display={{ xs: 'none', md: 'block' }}>
            <Typography color="gray">Volume (7D)</Typography>
          </Grid>
          <Grid item md={2} xs={8} sx={{ textAlign: 'right', paddingRight: { xs: 0, md: `${ARROW_CONTAINER_WIDTH}px` } }}>
            <Tooltip title="Title">
              <Typography color="gray">deltaB</Typography>
            </Tooltip>
          </Grid>
        </Grid>
      </Box>
      <Stack gap={1} sx={{ p: 1 }}>
        <Box key="1">
          <Button
            component={RouterLink}
            to="/market/wells/1"
            fullWidth
            variant="outlined"
            color="secondary"
            size="large"
            sx={{
              textAlign: 'left',
              px: 2,
              py: 1.5,
            }}
          >
            <Grid container alignItems="center">
              {/**
                * Cell: Token
                */}
              <Grid item md={3.75} xs={7}>
                <Row gap={1}>
                  <Row gap={0.1}>
                    <TokenIcon token={BEAN[1]} />
                    <TokenIcon token={BEAN[1]} />
                  </Row>
                  <Typography color="black" display="inline">
                    BEAN/ETH
                  </Typography>
                  <WhitelistBadge isWhitelisted />
                </Row>
              </Grid>

              {/**
                * Cell: Type
                */}
              <Grid item md={2.25} xs={0} display={{ xs: 'none', md: 'block' }}>
                <Tooltip placement="right" title="Tooltip">
                  <Typography display="inline" color="black">
                    Constant Product
                  </Typography>
                </Tooltip>
              </Grid>

              {/**
                * Cell: Total Liquidity
                */}
              <Grid item md={2} xs={0} display={{ xs: 'none', md: 'block' }}>
                <Tooltip
                  placement="right"
                  componentsProps={TOOLTIP_COMPONENT_PROPS}
                  title="Tooltip"
                >
                  <Typography display="inline" color="black">
                    Constant Product
                  </Typography>
                </Tooltip>
              </Grid>

              {/**
                * Cell: Volume
                */}
              <Grid item md={2} xs={0} display={{ xs: 'none', md: 'block' }}>
                <Typography color="black">
                  $500,000
                </Typography>
              </Grid>

              {/**
                * Cell: deltaB
                */}
              <Grid item md={2} xs={5}>
                <Row justifyContent="flex-end">
                  <Tooltip
                    placement="left"
                    componentsProps={TOOLTIP_COMPONENT_PROPS}
                    title="Toooltip">
                    <Typography color="black">
                      -10,000
                    </Typography>
                  </Tooltip>
                  <Stack display={{ xs: 'none', md: 'block' }} sx={{ width: ARROW_CONTAINER_WIDTH }} alignItems="center">
                    <ArrowRightIcon />
                  </Stack>
                </Row>
              </Grid>
            </Grid>
          </Button>
        </Box>
      </Stack>
    </Card>
  );
};

export default Wells;
