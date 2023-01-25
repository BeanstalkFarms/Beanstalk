import React, { useState } from 'react';
import type { NextPage } from 'next'
import CallsModule from '../components/CallsModule';
import { ethers } from 'ethers';
import Sunrises from '../components/Sunrises';
import FertQueue from '../components/FertQueue';
import { Storage } from '../generated/Beanstalk'; 
import Page from '../components/layout/Page';

const BEAN            = "0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab";
const BEANCRV3        = "0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49";
const UNRIPE_BEAN     = "0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449";
const UNRIPE_BEANCRV3 = "0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D";


export const localeNumber = (decimals: number, maxFractionDigits?: number) => 
  (v: ethers.BigNumber) => parseFloat(ethers.utils.formatUnits(v, decimals)).toLocaleString('en-us', { maximumFractionDigits: maxFractionDigits || 3 });
export const percentNumber = (decimals: number) =>
  (v: ethers.BigNumber) => `${(parseFloat(ethers.utils.formatUnits(v, decimals))*100).toFixed(4)}%`

const COL_ITEM = "space-y-4 min-w-[300px]";

const Home: NextPage = () => {
  const [raw, setRaw] = useState(false);
  const rightHeader = (
    <>
      <label htmlFor="raw">Show raw values</label>
      <input id="raw" type="checkbox" checked={raw} onChange={() => setRaw(!raw)} />
    </>
  );
  return (
    <Page rightHeader={rightHeader}>
      <div className={COL_ITEM}>
        <CallsModule
          title="Sun"
          slots={[
            ['Paused', 'paused'],
            ['Season', 'season'],
            ['Season Time', 'seasonTime'],
          ]}
          raw={raw}
        />
        <Sunrises />
        <CallsModule
          title="Owner"
          slots={[
            ['Owner', 'owner', (owner) => `${owner.substring(0,15)}...`],
          ]}
          raw={raw}
        />
      </div>
      <div className={COL_ITEM}>
        <CallsModule
          title="Silo"
          slots={[
            ["Withdraw Freeze", "withdrawFreeze"],
          ]}
          raw={raw}
        />
        <CallsModule
          title="BDV"
          slots={[
            ["Beans", "bdv", localeNumber(6, 6), [BEAN, ethers.utils.parseUnits('1', 6)]],
            ["Bean:3CRV", "bdv", localeNumber(6, 6), [BEANCRV3, ethers.utils.parseUnits('1', 18)]],
            ["Unripe Beans", "bdv", localeNumber(6, 6), [UNRIPE_BEAN, ethers.utils.parseUnits('1', 6)]],
            ["Unripe Bean:3CRV", "bdv", localeNumber(6, 6), [UNRIPE_BEANCRV3, ethers.utils.parseUnits('1', 6)]],
          ]}
          raw={raw}
        />
        <CallsModule
          title="Convert"
          slots={[
            ["1 BEAN -> BEAN:3CRV",     "getAmountOut", localeNumber(18, 6), [BEAN, BEANCRV3, ethers.utils.parseUnits('1', 6)]],
            ["1 urBEAN -> urBEAN:3CRV", "getAmountOut", localeNumber(6, 6),  [UNRIPE_BEAN, UNRIPE_BEANCRV3, ethers.utils.parseUnits('1', 6)]],
            ["1 BEAN:3CRV -> BEAN",     "getAmountOut", localeNumber(6, 6),  [BEANCRV3, BEAN, ethers.utils.parseUnits('1', 18)]],
            ["1 urBEAN:3CRV -> urBEAN", "getAmountOut", localeNumber(6, 6),  [UNRIPE_BEANCRV3, UNRIPE_BEAN, ethers.utils.parseUnits('1', 6)]],
            ["Max: BEAN -> BEAN:3CRV",  "getMaxAmountIn",  localeNumber(6, 6),  [BEAN, BEANCRV3]],
            ["Max: urBEAN -> urBEAN:3CRV",  "getMaxAmountIn",  localeNumber(6, 6),  [UNRIPE_BEAN, UNRIPE_BEANCRV3]],
            ["Max: BEAN:3CRV -> BEAN",     "getMaxAmountIn", localeNumber(18, 6),  [BEANCRV3, BEAN]],
            ["Max: urBEAN:3CRV -> urBEAN", "getMaxAmountIn", localeNumber(6, 6),  [UNRIPE_BEANCRV3, UNRIPE_BEAN]],
          ]}
          raw={raw}
          multicall={false}
        />
      </div>
      <div className={COL_ITEM}>
        <CallsModule
          title="Field"
          slots={[
            ["Pods", "totalPods", localeNumber(6)],
            ["Soil", "totalSoil", localeNumber(6)],
            ["Temperature", "yield", percentNumber(2)],
            ["Harvested Pods", "totalHarvested", localeNumber(6)],
            ["Harvestable Index", "harvestableIndex", localeNumber(6)],
            ["Weather", "weather", (value: Storage.WeatherStructOutput) => ({
              startSoil: value.startSoil.toString(),
              lastDSoil: value.lastDSoil.toString(),
              lastSowTime: value.lastSowTime.toString(),
              nextSowTime: value.nextSowTime.toString(),
              yield: value.yield.toString(),
            })]
          ]}
          raw={raw}
        />
        <CallsModule
          title="Field"
          slots={[
            ["Pods", "totalPods", localeNumber(6)],
            ["Soil", "totalSoil", localeNumber(6)],
            ["Temperature", "yield", percentNumber(2)],
            ["Harvested Pods", "totalHarvested", localeNumber(6)],
            ["Harvestable Index", "harvestableIndex", localeNumber(6)]
          ]}
          raw={raw}
        />
      </div>
      <div className={COL_ITEM}>
        <CallsModule
          title="Fertilizer"
          slots={[
            // Whether the Fertilizer system is being used
            ['Is Fertilizing?', 'isFertilizing', undefined, undefined, 'True if Beanstalk still owes beans to Fertilizer.'],
            // BPF indices
            ['Current BPF', 'beansPerFertilizer', localeNumber(6), undefined, 'The current number of Beans paid per Fertilizer.'],
            ['End BPF', 'getEndBpf', localeNumber(6), undefined, 'The BPF at which Fertilizer bought during this Season will stop receiving new Bean mints.'],
            // Amounts of Fertilizer, Beans, etc.
            ['Fertilized Beans', 'totalFertilizedBeans', localeNumber(6), undefined, 'Beans paid to Fertilizer.'],
            ['Unfertilized Beans', 'totalUnfertilizedBeans', localeNumber(6), undefined, 'Beans owed to Fertilizer.'],
            ['Fertilized + Unfertilized Beans', 'totalFertilizerBeans', localeNumber(6), undefined, 'Fertilized Beans + Unfertilized Beans'],
            ['Active Fertilizer', 'getActiveFertilizer', localeNumber(0), undefined, 'The number of Fertilizer currently receiving Bean mints.'],
            // Recapitalization Progress
            ['Remaining Recap', 'remainingRecapitalization', localeNumber(6), undefined, 'The number of USDC remaining to be raised. 1 USDC can purchase 1 FERT.'], // measured in USDC
            ['Recap Paid Percent', 'getRecapPaidPercent', percentNumber(6)],
          ]}
          raw={raw}
        />
        <CallsModule
          title="Unripe"
          slots={[
            ['Is Unripe? (BEAN)', 'isUnripe', undefined, [UNRIPE_BEAN]],
            ['Is Unripe? (BEAN:3CRV)', 'isUnripe', undefined, [UNRIPE_BEANCRV3]],
            ['Total Underlying (BEAN)', 'getTotalUnderlying', localeNumber(6), [UNRIPE_BEAN]],
            ['Total Underlying (BEAN:3CRV)', 'getTotalUnderlying', localeNumber(18), [UNRIPE_BEANCRV3]],
            ['% of Sprouts Fertilized', 'getRecapPaidPercent', percentNumber(6)],
            ["Underlying Per Unripe----------", 'isUnripe', undefined, [UNRIPE_BEAN]],
            ['Penalized Underlying per Unripe (BEAN)', 'getPenalty', localeNumber(6), [UNRIPE_BEAN]],
            ['Penalized Underlying per Unripe (BEAN:3CRV)', 'getPenalty', localeNumber(18), [UNRIPE_BEANCRV3]],
            ['Underlying per Unripe (BEAN)', 'getUnderlyingPerUnripeToken', localeNumber(6), [UNRIPE_BEAN]],
            ['Underlying per Unripe (BEAN:3CRV)', 'getUnderlyingPerUnripeToken', localeNumber(18), [UNRIPE_BEANCRV3]],
            ["Chop Rate-------------", 'isUnripe', undefined, [UNRIPE_BEAN]],
            ['Chop Rate (BEAN)', 'getPercentPenalty', percentNumber(6), [UNRIPE_BEAN]],
            ['Chop Rate (BEAN:3CRV)', 'getPercentPenalty', percentNumber(6), [UNRIPE_BEANCRV3]],
            ['% Recapitalized (BEAN)', 'getRecapFundedPercent', percentNumber(6), [UNRIPE_BEAN]],
            ['% Recapitalized (BEAN:3CRV)', 'getRecapFundedPercent', percentNumber(6), [UNRIPE_BEANCRV3]],
          ]}
          raw={raw}
        />
      </div>
      <div className={COL_ITEM}>
        <FertQueue />
      </div>
      <div className={COL_ITEM}>
        <CallsModule
          title="Season of Plenty"
          slots={[
            ["Rain", "rain", (value: Storage.RainStructOutput) => ({
              roots: localeNumber(12)(value.roots).toString(),
              pods: localeNumber(6)(value.pods).toString()
            })],
            ["Seasons", "time", (value: Storage.SeasonStructOutput) => ({
              lastSopStart: value.lastSop.toString(),
              lastSopEnd: value.lastSopSeason.toString(),
              rainStart: value.rainStart.toString(),
              raining: value.raining.toString(),
              sopTime: (value.withdrawSeasons + 1).toString()
            })]
          ]}
          raw={raw}
        />
      </div>
    </Page>
  )
}

export default Home
