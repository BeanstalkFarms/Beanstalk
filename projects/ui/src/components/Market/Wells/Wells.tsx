import React, { useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Grid,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { Link as RouterLink } from 'react-router-dom';
import TokenIcon from '~/components/Common/TokenIcon';
import { BEAN } from '~/constants/tokens';
import Row from '~/components/Common/Row';
import WhitelistBadge from '~/components/Market/Wells/WhitelistBadge';
import { Token } from '@beanstalk/sdk';
import useWell from '~/hooks/wells/useWell';

const ARROW_CONTAINER_WIDTH = 20;
const TOOLTIP_COMPONENT_PROPS = {
  tooltip: {
    sx: {
      maxWidth: 'none !important',
      boxShadow: '0px 6px 20px 10px rgba(255,255,255,0.3) !important',
    },
  },
};

// These should come by way of the SDK then
export enum WellFunctionType {
  CONSTANT_PRODUCT = 0,
  STABLE_SWAP = 1,
}

export type Well = {
  name: string;
  tokens: Token[];
  wellFunctionType: WellFunctionType;

  icon?: string;
  /** */
  // eslint-disable-next-line
  compact?: boolean;
};

// TODO: How to get this? Env var? WELL ADDRESS
const WELL_ID = '0xa6AB86f760ae5D6fbF06056a7887b816610A4668';

/**
 * Wells listing on main Explore page
 */
const Wells: React.FC = () => {
  const { well, loading: wellIsLoading } = useWell(WELL_ID);

  return (
    <Card>
      <Box
        display="flex"
        sx={{
          px: 3, // 1 + 2 from Table Body
          pt: '14px', // manually adjusted
          pb: '5px', // manually adjusted
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
              <Typography color="gray">Type</Typography>
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
          <Grid
            item
            md={2}
            xs={8}
            sx={{
              textAlign: 'right',
              paddingRight: { xs: 0, md: `${ARROW_CONTAINER_WIDTH}px` },
            }}
          >
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
            to={`/market/wells/${WELL_ID}`}
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
            {!wellIsLoading && (
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
                      {well!.name}
                    </Typography>
                    <WhitelistBadge isWhitelisted />
                  </Row>
                </Grid>

                {/**
                 * Cell: Type
                 */}
                <Grid
                  item
                  md={2.25}
                  xs={0}
                  display={{ xs: 'none', md: 'block' }}
                >
                  <Tooltip placement="right" title="Tooltip">
                    <Typography display="inline" color="black">
                      {well!.type}
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
                      {well!.type}
                    </Typography>
                  </Tooltip>
                </Grid>

                {/**
                 * Cell: Volume
                 */}
                <Grid item md={2} xs={0} display={{ xs: 'none', md: 'block' }}>
                  <Typography color="black">{well!.type}</Typography>
                </Grid>

                {/**
                 * Cell: deltaB
                 */}
                <Grid item md={2} xs={5}>
                  <Row justifyContent="flex-end">
                    <Tooltip
                      placement="left"
                      componentsProps={TOOLTIP_COMPONENT_PROPS}
                      title="Toooltip"
                    >
                      <Typography color="black">{well!.type}</Typography>
                    </Tooltip>
                    <Stack
                      display={{ xs: 'none', md: 'block' }}
                      sx={{ width: ARROW_CONTAINER_WIDTH }}
                      alignItems="center"
                    >
                      <ArrowRightIcon />
                    </Stack>
                  </Row>
                </Grid>
              </Grid>
            )}
          </Button>
        </Box>
      </Stack>
    </Card>
  );
};

export default Wells;
