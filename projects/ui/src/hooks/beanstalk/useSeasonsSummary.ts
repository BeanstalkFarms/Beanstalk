import {
  useSunButtonQuery,
  SunButtonQuery,
  useSeasonalLiquidityAndPriceByPoolQuery,
  SeasonalLiquidityAndPriceByPoolQuery,
} from '~/generated/graphql';
import { useAppSelector } from '~/state';
import BigNumber from 'bignumber.js';
import { toTokenUnitsBN } from '~/util';
import { useMemo } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import { ZERO_BN } from '~/constants';
import useSdk from '../sdk';
import useSeason from './useSeason';
import useBeanstalkCaseData from './useBeanstalkCaseData';
import usePrice from './usePrice';

type SeasonMap<T> = Record<number, T>;

type SunSeason = {
  price: BigNumber;
  rewardBeans: BigNumber;
  beanSupply: BigNumber;
  deltaB: BigNumber;
};

type SunField = {
  issuedSoil: BigNumber;
  temperature: BigNumber;
  podRate: BigNumber;
  soilSoldOut: boolean;
  blocksToSoldOutSoil: BigNumber;
  deltaSownBeans: BigNumber;
  caseId: BigNumber;
};

type SeasonalLiquidityAndPrice = {
  totalLiquidity: BigNumber;
  largestLiquidityWellPrice: BigNumber;
};

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
  bean2MaxLPScalar: SeasonSummaryItem;
  price: SeasonSummaryItem;
  l2sr: SeasonSummaryItem;
  podRate: SeasonSummaryItem;
  deltaPodDemand: SeasonSummaryItem;
};

const castField = (
  data: SunButtonQuery['fields'][number],
  beanDecimals: number
): SunField => ({
  issuedSoil: toTokenUnitsBN(data.issuedSoil, beanDecimals),
  temperature: new BigNumber(data.temperature),
  podRate: new BigNumber(data.podRate),
  soilSoldOut: data.soilSoldOut,
  blocksToSoldOutSoil: new BigNumber(data.blocksToSoldOutSoil),
  deltaSownBeans: toTokenUnitsBN(data.sownBeans, beanDecimals),
  caseId: new BigNumber(data.caseId),
});

const castSeason = (
  data: SunButtonQuery['seasons'][number],
  beanDecimals: number
): SunSeason => ({
  price: new BigNumber(data.price),
  rewardBeans: toTokenUnitsBN(
    data.season <= 6074 ? data.deltaBeans : data.rewardBeans,
    beanDecimals
  ),
  beanSupply: toTokenUnitsBN(data.beans, beanDecimals),
  deltaB: toTokenUnitsBN(data.deltaB, beanDecimals),
});

const parseSeasonalPoolsLiquidityResult = (
  snapshots: SeasonalLiquidityAndPriceByPoolQuery['seasons']
) => {
  const map = snapshots.reduce<SeasonMap<SeasonalLiquidityAndPrice>>(
    (memo, data) => {
      const poolLiquidity = new BigNumber(data.pool.liquidityUSD);
      const poolPrice = new BigNumber(data.pool.lastPrice);

      const price = memo[data.season]?.largestLiquidityWellPrice || ZERO_BN;
      const liquidity = memo[data.season]?.totalLiquidity || ZERO_BN;

      memo[data.season] = {
        // price of the largest liquidity well
        totalLiquidity: liquidity.plus(poolLiquidity),
        largestLiquidityWellPrice: poolPrice.gt(price) ? poolPrice : price,
      };

      return memo;
    },
    {}
  );

  return map;
};

const castQueries = (
  seasons: SunButtonQuery['seasons'],
  field: SunButtonQuery['fields'],
  priceAndLiquidityByPool: SeasonalLiquidityAndPriceByPoolQuery['seasons'],
  currentSeason: BigNumber,
  sdk: BeanstalkSDK
) => {
  if (!field.length || !seasons.length) return [];

  const beanDecimals = sdk.tokens.BEAN.decimals;
  const currSeason = currentSeason.toNumber();

  const fieldMap = field.reduce<SeasonMap<SunField>>((memo, curr) => {
    const seasonIndex = curr.season;
    memo[seasonIndex] = { ...castField(curr, beanDecimals) };
    return memo;
  }, {});
  const seasonFieldMap = seasons.reduce<SeasonMap<SunSeason>>((memo, curr) => {
    const seasonIndex = curr.season;
    memo[seasonIndex] = { ...castSeason(curr, beanDecimals) };
    return memo;
  }, {});
  const liquidityAndPriceMap = parseSeasonalPoolsLiquidityResult(
    priceAndLiquidityByPool
  );

  return Array.from({ length: 25 })
    .map((_, i) => {
      const seasonIndex = currSeason - i;
      return {
        season: new BigNumber(seasonIndex),
        ...fieldMap[seasonIndex],
        ...seasonFieldMap[seasonIndex],
        ...liquidityAndPriceMap[seasonIndex],
      };
    })
    .reverse();
};

const getAdjustmentDisplay = (value: BigNumber | undefined) => {
  if (!value) return '--';
  if (value.eq(0)) return 'No adjustment';
  return 'Expected adjustment';
};

const useSeasonsSummary = () => {
  const field = useAppSelector((s) => s._beanstalk.field);
  const beanTokenData = useAppSelector((s) => s._bean.token);
  const { caseState } = useAppSelector((s) => s._beanstalk.case);
  const pools = useAppSelector((s) => s._bean.pools);
  const price = usePrice();
  const evaluation = useBeanstalkCaseData();
  const season = useSeason();
  const sdk = useSdk();

  const maxPrevSeason = season.minus(25).toNumber();
  const currentSeason = season.toNumber();
  const skipQuery = season.lte(0);

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
        first: Object.keys(pools).length * 25,
        season_gte: maxPrevSeason,
        season_lte: currentSeason,
      },
      context: { subgraph: 'bean' },
      skip: skipQuery || !Object.keys(pools).length,
    });

  const twaDeltaB = beanTokenData.deltaB;

  const forecast = useMemo(() => {
    const summary: SeasonSummary = {
      season: {
        value: season.plus(1),
      },
      beanMints: {
        value: twaDeltaB?.gt(0) ? twaDeltaB : undefined,
      },
      maxSoil: {
        value: twaDeltaB?.lt(0) ? twaDeltaB : undefined,
      },
      maxTemperature: {
        value: field.temperature.max.plus(evaluation?.delta.temperature || 0),
        delta: evaluation?.delta.temperature,
        display: getAdjustmentDisplay(evaluation?.delta.temperature),
      },
      bean2MaxLPScalar: {
        value: evaluation?.delta.bean2MaxLPGPPerBdv || ZERO_BN,
        delta: evaluation?.delta.bean2MaxLPGPPerBdvScalar || ZERO_BN,
        display: getAdjustmentDisplay(evaluation?.delta.bean2MaxLPGPPerBdv),
      },
      price: {
        value: price,
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
  }, [caseState, price, season, evaluation, field, twaDeltaB]);

  const seasonsSummary = useMemo(() => {
    const arr: SeasonSummary[] = [];

    const seasonsArr = seasonsData?.seasons ?? [];
    const fieldArr = seasonsData?.fields ?? [];
    const liquidityArr = liquidityAndPrice?.seasons ?? [];

    if (!seasonsArr.length || !fieldArr.length || !liquidityArr.length) {
      return arr;
    }

    // ordered: [season, season - n]
    const mergedQueryData = castQueries(
      seasonsArr,
      fieldArr,
      liquidityArr,
      season,
      sdk
    );

    const lastIndex = mergedQueryData.length - 1;

    mergedQueryData.forEach((data, i) => {
      const prevSeason = i !== lastIndex ? mergedQueryData[i + 1] : null;

      if (!prevSeason) return;

      const deltaTemperature = data.temperature.minus(prevSeason.temperature);

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
          display: getAdjustmentDisplay(deltaTemperature),
        },
        bean2MaxLPScalar: {
          value: delta.bean2MaxLPGPPerBdv,
          delta: delta.bean2MaxLPGPPerBdvScalar,
          display: getAdjustmentDisplay(delta.bean2MaxLPGPPerBdv),
        },
        price: {
          value: data.price,
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
  }, [
    season,
    seasonsData?.fields,
    seasonsData?.seasons,
    liquidityAndPrice?.seasons,
    sdk,
  ]);

  return {
    loading: liquidityAndPricesLoading || seasonsDataLoading,
    forecast,
    seasonsSummary,
  };
};

export default useSeasonsSummary;

/**
 * minted beans = twaDeltaB
 * issued soil = twaDeltaSoil
 *
 * for each well
 *    - cap delta B at 1% of supply
 *
 *    well A's delta B => 2% of total bean supply
 *    well B's delta B => .5% of total bean supply
 */
