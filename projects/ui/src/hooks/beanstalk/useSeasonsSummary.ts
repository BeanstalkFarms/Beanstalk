import {
  useSunButtonQuery,
  SunButtonQuery,
  useSeasonalLiquidityAndPriceByPoolQuery,
  SeasonalLiquidityAndPriceByPoolQuery,
} from '~/generated/graphql';
import { useAppSelector } from '~/state';
import BigNumber from 'bignumber.js';
import { toBNWithDecimals } from '~/util';
import { useMemo } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import { ZERO_BN } from '~/constants';
import useSdk from '../sdk';
import useSeason from './useSeason';
import useBeanstalkCaseData from './useBeanstalkCaseData';
import useSeedGauge from './useSeedGauge';

export type SeasonSummaryItem = {
  value: BigNumber | undefined;
  delta?: BigNumber;
  display?: string;
};

export type SeasonSummary = {
  season: SeasonSummaryItem;
  beanMints: SeasonSummaryItem;
  maxSoil: SeasonSummaryItem;
  maxTemperature: SeasonSummaryItem;
  bean2MaxLPRatio: SeasonSummaryItem;
  price: SeasonSummaryItem;
  l2sr: SeasonSummaryItem;
  podRate: SeasonSummaryItem;
  deltaPodDemand: SeasonSummaryItem;
};

type MergedSeasonData = {
  season: BigNumber;
  price: BigNumber;
  rewardBeans: BigNumber;
  beanSupply: BigNumber;
  deltaB: BigNumber;
  issuedSoil: BigNumber;
  temperature: BigNumber;
  podRate: BigNumber;
  soilSoldOut: boolean;
  blocksToSoldOutSoil: BigNumber;
  deltaSownBeans: BigNumber;
  caseId: BigNumber;
  bean2MaxLPRatio: BigNumber;
  totalLiquidity: BigNumber;
  largestLiquidityWellPrice: BigNumber;
};

const castQueries = (
  sunQuery: SunButtonQuery | undefined,
  priceAndLiquidityByPool: SeasonalLiquidityAndPriceByPoolQuery | undefined,
  currentSeason: BigNumber,
  sdk: BeanstalkSDK
): MergedSeasonData[] => {
  const beanDecimals = sdk.tokens.BEAN.decimals;
  const currSeason = currentSeason.toNumber();
  const mergedData = new Map<number, Partial<MergedSeasonData>>();

  const seasons = sunQuery?.seasons;
  const field = sunQuery?.fields;
  const silo = sunQuery?.silo;
  const prices = priceAndLiquidityByPool?.seasons;

  if (!seasons?.length || !field?.length || !silo?.length || !prices?.length) {
    return [];
  }

  // Process seasons data
  seasons.forEach((season) => {
    const seasonIndex = season.season;
    mergedData.set(seasonIndex, {
      ...mergedData.get(seasonIndex),
      season: new BigNumber(seasonIndex),
      price: new BigNumber(season.price),
      rewardBeans: toBNWithDecimals(
        season.season <= 6074 ? season.deltaBeans : season.rewardBeans,
        beanDecimals
      ),
      beanSupply: toBNWithDecimals(season.beans, beanDecimals),
      deltaB: toBNWithDecimals(season.deltaB, beanDecimals),
    });
  });

  // Process field data
  field.forEach((f) => {
    const seasonIndex = f.season;
    mergedData.set(seasonIndex, {
      ...mergedData.get(seasonIndex),
      issuedSoil: toBNWithDecimals(f.issuedSoil, beanDecimals),
      temperature: new BigNumber(f.temperature),
      podRate: new BigNumber(f.podRate),
      soilSoldOut: f.soilSoldOut,
      blocksToSoldOutSoil: new BigNumber(f.blocksToSoldOutSoil),
      deltaSownBeans: toBNWithDecimals(f.sownBeans, beanDecimals),
      caseId: new BigNumber(f.caseId),
    });
  });

  // Process silo data
  silo.forEach((s) => {
    const seasonIndex = s.season;
    mergedData.set(seasonIndex, {
      ...mergedData.get(seasonIndex),
      bean2MaxLPRatio: toBNWithDecimals(s.beanToMaxLpGpPerBdvRatio, 18),
    });
  });

  // Process liquidity and price data
  prices.forEach((data) => {
    const seasonIndex = data.season;
    const existingData = mergedData.get(seasonIndex) || {};
    const poolLiquidity = new BigNumber(data.pool.liquidityUSD);
    const poolPrice = new BigNumber(data.pool.lastPrice);

    mergedData.set(seasonIndex, {
      ...existingData,
      totalLiquidity: (existingData.totalLiquidity || ZERO_BN).plus(
        poolLiquidity
      ),
      largestLiquidityWellPrice: poolPrice.gt(
        existingData.largestLiquidityWellPrice || ZERO_BN
      )
        ? poolPrice
        : existingData.largestLiquidityWellPrice,
    });
  });

  // Create final array
  // no need to sort as Map retains insertion order
  return Array.from({ length: 25 }, (_, i) => {
    const seasonIndex = currSeason - i;
    const seasonData = mergedData.get(seasonIndex);
    return seasonData && seasonData.season
      ? (seasonData as MergedSeasonData)
      : null;
  }).filter((data): data is MergedSeasonData => data !== null);
};

const getAdjustmentDisplay = (value: BigNumber | undefined) => {
  if (!value) return '--';
  if (value.eq(0)) return 'No adjustment';
  return 'Expected adjustment';
};

const useSeasonsSummary = () => {
  const field = useAppSelector((s) => s._beanstalk.field);
  const { caseState } = useAppSelector((s) => s._beanstalk.case);
  const pools = useAppSelector((s) => s._bean.pools);
  const evaluation = useBeanstalkCaseData();
  const { data: seedGauge } = useSeedGauge();
  const season = useSeason();
  const sdk = useSdk();

  const maxPrevSeason = season.minus(25).toNumber();
  const currentSeason = season.toNumber();
  const skipQuery = season.lte(0);
  const twaDeltaB = evaluation?.twaDeltaB || ZERO_BN;

  // Queries
  const { data: seasonsData, loading: seasonsDataLoading } = useSunButtonQuery({
    fetchPolicy: 'cache-and-network',
    variables: {
      season_lte: currentSeason,
    },
    skip: skipQuery,
  });

  const { data: liquidityAndPrice, loading: liquidityAndPricesLoading } =
    useSeasonalLiquidityAndPriceByPoolQuery({
      fetchPolicy: 'cache-and-network',
      variables: {
        first: 1000,
        season_gte: maxPrevSeason,
        season_lte: currentSeason,
        pools: sdk.tokens.wellLPAddresses.map((address) => address),
      },
      context: { subgraph: 'bean' },
      skip: skipQuery || !Object.keys(pools).length,
    });

  const instantaneousDeltaB = sdk.tokens.wellLPAddresses.reduce(
    (prev, address) => {
      const poolDeltaB = pools[address]?.deltaB || ZERO_BN;
      return prev.plus(poolDeltaB);
    },
    ZERO_BN
  );

  const forecast = useMemo(() => {
    const beansMinted = twaDeltaB.gt(0) ? twaDeltaB : ZERO_BN;
    const maxTemp = field.temperature.max.plus(
      evaluation?.delta.temperature || 0
    );

    const summary: SeasonSummary = {
      season: {
        value: season.plus(1),
      },
      beanMints: {
        value: twaDeltaB?.gt(0) ? twaDeltaB : ZERO_BN,
      },
      maxSoil: {
        value: LibCases.calcMaxSoil(
          beansMinted,
          maxTemp,
          caseState.podRate,
          twaDeltaB,
          instantaneousDeltaB
        ),
      },
      maxTemperature: {
        value: field.temperature.max.plus(evaluation?.delta.temperature || 0),
        delta: evaluation?.delta.temperature,
        display: getAdjustmentDisplay(evaluation?.delta.temperature),
      },
      bean2MaxLPRatio: {
        value: seedGauge.bean2MaxLPRatio.value || ZERO_BN,
        delta: evaluation?.delta.bean2MaxLPGPPerBdvScalar.times(100) || ZERO_BN,
        display: getAdjustmentDisplay(
          evaluation?.delta.bean2MaxLPGPPerBdvScalar
        ),
      },
      price: {
        value: evaluation?.highestLiquidityWellPrice || ZERO_BN,
        display: evaluation?.stateDisplay.price,
      },
      l2sr: {
        value: caseState.l2sr,
        display: evaluation?.stateDisplay.l2sr,
      },
      podRate: {
        value: caseState.podRate,
        display: evaluation?.stateDisplay.podRate,
      },
      deltaPodDemand: {
        value: caseState.deltaPodDemand,
        display: evaluation?.stateDisplay.deltaPodDemand,
      },
    };
    return summary;
  }, [
    twaDeltaB,
    instantaneousDeltaB,
    field.temperature.max,
    evaluation,
    seedGauge.bean2MaxLPRatio,
    season,
    caseState,
  ]);

  const seasonsSummary = useMemo(() => {
    const arr: SeasonSummary[] = [];

    const mergedQueryData = castQueries(
      seasonsData,
      liquidityAndPrice,
      season,
      sdk
    );

    if (!mergedQueryData.length) return arr;

    const lastIndex = mergedQueryData.length - 1;

    mergedQueryData.forEach((data, i) => {
      const prevSeason = i !== lastIndex ? mergedQueryData[i + 1] : null;

      if (!prevSeason) return;

      const deltaTemperature =
        data.temperature?.minus(prevSeason.temperature) || ZERO_BN;

      const l2sr = data.totalLiquidity.div(data.beanSupply || 1);

      const deltaPodDemand = LibCases.calcDeltaPodDemand([
        {
          soilSoldOut: data.soilSoldOut,
          blocksToSoldOutSoil: data.blocksToSoldOutSoil,
          sownBeans: data.deltaSownBeans,
        },
        {
          soilSoldOut: prevSeason.soilSoldOut,
          blocksToSoldOutSoil: prevSeason.blocksToSoldOutSoil,
          sownBeans: prevSeason.deltaSownBeans,
        },
      ]);

      const { stateDisplay, delta } = LibCases.evaluateBeanstalk(
        {
          deltaPodDemand: deltaPodDemand || ZERO_BN,
          l2sr,
          podRate: data.podRate,
        },
        data.largestLiquidityWellPrice,
        data.deltaB
      );

      arr.push({
        season: {
          value: data.season,
        },
        beanMints: {
          value: data.rewardBeans,
        },
        maxSoil: {
          value: data.issuedSoil,
        },
        maxTemperature: {
          value: data.temperature,
          delta: deltaTemperature,
        },
        bean2MaxLPRatio: {
          value: data.bean2MaxLPRatio,
          delta: delta.bean2MaxLPGPPerBdvScalar.times(100),
        },
        price: {
          value: data.largestLiquidityWellPrice,
          display: stateDisplay.price,
        },
        l2sr: {
          value: l2sr,
          display: stateDisplay.l2sr,
        },
        podRate: {
          value: data.podRate,
          display: stateDisplay.podRate,
        },
        deltaPodDemand: {
          value: deltaPodDemand,
          display: stateDisplay.deltaPodDemand,
        },
      });
    });

    return arr;
  }, [season, seasonsData, liquidityAndPrice, sdk]);

  return {
    loading: liquidityAndPricesLoading || seasonsDataLoading,
    forecast,
    seasonsSummary,
  };
};

export default useSeasonsSummary;

// const displayMergedData = (data: ReturnType<typeof castQueries>) => {
//   const mapped = data.map((d) => ({
//     season: d.season.toString(),
//     price: d.price.toString(),
//     rewardBeans: d.rewardBeans.toString(),
//     beanSupply: d.beanSupply.toString(),
//     deltaB: d.deltaB.toString(),

//     issuedSoil: d.issuedSoil.toString(),
//     temperature: d.temperature.toString(),

//     podRate: d.podRate.toString(),
//     soilSoldOut: d.soilSoldOut,
//     blocksToSoldOutSoil: d.blocksToSoldOutSoil.toString(),
//     deltaSownBeans: d.deltaSownBeans.toString(),
//     caseId: d.caseId.toString(),

//     totalLiquidity: d.totalLiquidity.toString(),
//     largestLiquidityWellPrice: d.largestLiquidityWellPrice.toString(),
//   }));

//   return mapped;
// };
