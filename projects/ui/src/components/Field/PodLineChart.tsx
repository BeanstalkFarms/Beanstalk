import React from 'react';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import {  Bar } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { withTooltip } from '@visx/tooltip';
import BigNumber from 'bignumber.js';
import { Stack, Tooltip, Typography } from '@mui/material';
import { PlotMap, displayBN } from '~/util';
import Row from '~/components/Common/Row';
import { FC } from '~/types';

type GraphProps = {
  width: number;
  harvestableIndex: BigNumber;
  height: number;
  farmerPlots: PlotMap<BigNumber>;
  podLineSize: BigNumber;
}

// plot config
const margin = {
  top: 20,
  bottom: 20,
  left: 0,
  right: 0,
};

const plotMarker2 = (width: number, height: number) => (
  <svg x={width} y={height} width="55" height="55" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28.5" cy="27.5" r="20.5" fill="white" />
    <mask id="mask0_4136_38978" maskUnits="userSpaceOnUse" x="13" y="13" width="31" height="31">
      <circle cx="28.418" cy="28.0664" r="15" fill="#FFFFFF" />
    </mask>
    <g mask="url(#mask0_4136_38978)">
      <rect x="9.41797" y="10.0664" width="22" height="22" fill="#EDF550" />
      <rect
        x="21.7617"
        y="9.38672"
        width="14.772"
        height="25.7324"
        transform="rotate(-30 21.7617 9.38672)"
        fill="#B72D3F" />
      <rect x="31.418" y="25" width="15" height="12" fill="#2B668B" />
      <rect
        x="12.2773"
        y="19.7188"
        width="36.2205"
        height="14.5583"
        transform="rotate(30 12.2773 19.7188)"
        fill="#1D455B" />
    </g>
  </svg>
);

const PodLineChart: FC<GraphProps> = withTooltip(({
  width,
  harvestableIndex,
  height,
  farmerPlots,
  podLineSize
}) => {
  // scales
  const xScale = scaleLinear<number>({
    domain: [0, podLineSize.toNumber()],
    range: [0, width - 49]
  });

  // const yScale = scaleLinear<number>({
  //   domain: [0, 18],
  //   range: [height - margin.top, margin.bottom]
  // });

  return (
    <svg width={width} height={height}>
      <Bar
        key={0}
        x={0}
        y={20}
        width={width}
        height={20}
        fill="#9e8773"
        rx={10}
      />
      {Object.keys(farmerPlots).map((key) => (
        <Tooltip
          key={key}
          title={(
            <Stack width={150}>
              <Row gap={1} justifyContent="space-between">
                <Typography>Place in line:</Typography>
                <Typography>{displayBN(new BigNumber(key).minus(harvestableIndex))}</Typography>
              </Row>
              <Row gap={1} justifyContent="space-between">
                <Typography>Num Pods:</Typography>
                <Typography>{displayBN(new BigNumber(farmerPlots[key]))}</Typography>
              </Row>
            </Stack>
          )}
        >
          {plotMarker2(xScale(new BigNumber(key).minus(harvestableIndex).toNumber()), 2)}
        </Tooltip>
      ))}
    </svg>
  );
});

/**
 * Wrap the graph in a ParentSize handler.
 */

const SimplePodLineChart: FC<{
  harvestableIndex: BigNumber;
  farmerPlots: PlotMap<BigNumber>;
  podLineSize: BigNumber;
}> = (props) => (
  <ParentSize debounceTime={10}>
    {({ width: visWidth, height: visHeight }) => (
      <PodLineChart
        harvestableIndex={props.harvestableIndex}
        width={visWidth}
        height={50}
        farmerPlots={props.farmerPlots}
        podLineSize={props.podLineSize}
      />
    )}
  </ParentSize>
);

export default SimplePodLineChart;
