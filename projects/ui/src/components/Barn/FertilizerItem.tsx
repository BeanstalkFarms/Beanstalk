import React from 'react';
import { Stack, Tooltip, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import TokenIcon from '~/components/Common/TokenIcon';
import humidityIcon from '~/img/beanstalk/humidity-icon.svg';
import { displayBN, displayFullBN } from '~/util';
import { SPROUTS } from '~/constants/tokens';
import FertilizerImage, { FertilizerState } from './FertilizerImage';
import { FertilizerTooltip } from './FertilizerItemTooltips';
import { ZERO_BN } from '~/constants';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import { FontWeight } from '../App/muiTheme';

export type FertilizerData = {
  /**
   * The ID of this Fertilizer 1155 token.
   * Corresponds to the "BPF" (Beans per Fertilizer).
   * Humidity and BPF are linked, though not deterministically.
   * A subgraph query is required to match these up. Subgraph
   * support will be added during June. For now ID is fixed to
   * 6_000_000 and season to 6_074.
   */
  id?: BigNumber;
  /**
   * The amount of Fertilizer owned at this ID.
   */
  amount: BigNumber;
  /**
   * The Humidity at which this Fertilizer was bought.
   */
  humidity: BigNumber | undefined;
  /**
   * The amount of Beans remaining to be paid to this Fertilizer.
   */
  sprouts: BigNumber | undefined;
  /**
   * The amount of Beans remaining already paid to this Fertilizer.
   */
  rinsableSprouts?: BigNumber | undefined;
  /**
   * The percentage this Fertilizer has been paid back.
   */
  progress?: number;
  /**
   * The Season in which this Fertilizer was bought.
   */
  season?: BigNumber;
  /**
   * font weight of 'Sprouts text'
   */
  fontWeight?: keyof typeof FontWeight;
}

const FertilizerItem: FC<FertilizerData & {
  /**
   * Customize the Fertilizer image used.
   * Fertilizer can be `unused` -> `active` -> `used`.
   */
  state?: FertilizerState;
  /**
   * Change copy and animations when we're purchasing new FERT.
   */
  isNew?: boolean;
  /**
   * 
   */
  tooltip: FertilizerTooltip;
}> = ({
  id,
  amount,
  humidity,
  rinsableSprouts,
  sprouts,
  progress,
  tooltip,
  state,
  isNew,
  fontWeight = 'bold'
}) => (
  <Stack width="100%" alignItems="center" rowGap={0.75}>
    <FertilizerImage
      isNew={isNew}
      state={state}
      progress={progress}
      id={id}
      />
    {amount.eq(0) ? (
      <Typography textAlign="center">x0</Typography>
    ) : (
      <Stack width="100%" direction="column" rowGap={0.25}>
        <Row justifyContent="space-between">
          {/* <Typography sx={{ fontSize: '14px', opacity: 1 }} color="text.secondary"> */}
          <Typography sx={{ fontSize: '14px', opacity: 0.8 }} color="text.secondary">
            x{displayFullBN(amount, 0)}
          </Typography>
          <Tooltip title={tooltip.humidity} placement="right">
            <Row gap={0.2} alignItems="center">
              <img alt="" src={humidityIcon} height="13px" />
              <Typography sx={{ fontSize: '14px', opacity: 0.6 }} color="text.secondary">
                {humidity ? `${humidity.times(100).toNumber().toLocaleString('en-us', { maximumFractionDigits: 1 })}%` : '---'}
              </Typography>
            </Row>
          </Tooltip>
        </Row>
        <Tooltip
          title={
            tooltip.name === 'my-fertilizer'
              ? tooltip.reward(rinsableSprouts, (sprouts || ZERO_BN).minus(rinsableSprouts || ZERO_BN))
              : tooltip.reward}
          placement="right">
          <Row justifyContent="space-between">
            <Typography sx={{ fontSize: '14px' }} color="text.primary" fontWeight={fontWeight}>
              Sprouts
            </Typography>
            <Row alignItems="center" gap={0.2}>
              <TokenIcon token={SPROUTS} css={{ width: '14px' }} />
              <Typography sx={{ fontSize: '14px' }} color="text.primary" fontWeight={fontWeight}>
                {sprouts ? displayBN(sprouts) : '?'}
              </Typography>
            </Row>
          </Row>
        </Tooltip>
      </Stack>
      )}
  </Stack>
);

export default FertilizerItem;
