import { BeanstalkSDK, TokenValue } from "@beanstalk/sdk";
import React, { useMemo, useState } from "react";
import { Item } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { TabButton } from "src/components/TabButton";
import { Row, TBody, THead, Table, Th } from "src/components/Table";
import { Row as TabRow } from "src/components/Layout";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";
import { mediaQuery, size } from "src/breakpoints";
import { Error } from "src/components/Error";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { useLPPositionSummary } from "src/tokens/useLPPositionSummary";

import { WellDetailLoadingRow, WellDetailRow } from "src/components/Well/Table/WellDetailRow";
import {
  MyWellPositionLoadingRow,
  MyWellPositionRow
} from "src/components/Well/Table/MyWellPositionRow";
import { useBeanstalkSiloAPYs } from "src/wells/useBeanstalkSiloAPYs";
import { useLagLoading } from "src/utils/ui/useLagLoading";
import useBasinStats from "src/wells/useBasinStats";
<<<<<<< HEAD

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const { data: wellStats } = useBasinStats();
  const sdk = useSdk();

  const [wellLiquidity, setWellLiquidity] = useState<(TokenValue | undefined)[]>([]);
  const [wellFunctionNames, setWellFunctionNames] = useState<string[]>([]);
  const [wellTokenPrices, setWellTokenPrices] = useState<(TokenValue | null)[][]>([]);
=======
import { useTokenPrices } from "src/utils/price/useTokenPrices";
import { useWellFunctionNames } from "src/wells/wellFunction/useWellFunctionNames";
import { BasinAPIResponse } from "src/types";
import { Well } from "@beanstalk/sdk-wells";
import useSdk from "src/utils/sdk/useSdk";
import { theme } from "src/utils/ui/theme";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const { data: wellStats = [] } = useBasinStats();
  const sdk = useSdk();

>>>>>>> master
  const [tab, showTab] = useState<number>(0);

  const { data: lpTokenPrices, isLoading: lpTokenPricesLoading } = useWellLPTokenPrice(wells);
  const { hasPositions, getPositionWithWell, isLoading: positionsLoading } = useLPPositionSummary();
  const { isLoading: apysLoading } = useBeanstalkSiloAPYs();
<<<<<<< HEAD
  // const [isLoadingWellData, setIsLoadingWellData] = useState<boolean>(true);

  useMemo(() => {
    const run = async () => {
      if (!wells || !wells.length) return;
      let _wellsLiquidityUSD = [];
      let _wellsTokenPrices = [];
      for (let i = 0; i < wells.length; i++) {
        if (!wells[i].tokens) return;
        const _tokenPrices = await Promise.all(wells[i].tokens!.map((token) => getPrice(token, sdk)));
        _wellsTokenPrices[i] = _tokenPrices;
        const _reserveValues = wells[i].reserves?.map((tokenReserve, index) =>
          tokenReserve.mul((_tokenPrices[index] as TokenValue) || TokenValue.ZERO)
        );
        let initialValue = TokenValue.ZERO;
        const _totalWellLiquidity = _reserveValues?.reduce((accumulator, currentValue) => currentValue.add(accumulator), initialValue);
        _wellsLiquidityUSD[i] = _totalWellLiquidity;
      }
      setWellLiquidity(_wellsLiquidityUSD);
      setWellTokenPrices(_wellsTokenPrices);

      let _wellsFunctionNames = [];
      for (let i = 0; i < wells.length; i++) {
        if (!wells[i].wellFunction) return;
        const _wellName = await wells[i].wellFunction!.contract.name();
        _wellsFunctionNames[i] = _wellName;
      }
      setWellFunctionNames(_wellsFunctionNames);
      // setIsLoadingWellData(false);
    };

    run();
  }, [sdk, wells]);
=======
  const { data: tokenPrices, isLoading: tokenPricesLoading } = useTokenPrices(wells);
  const { data: wellFnNames, isLoading: wellNamesLoading } = useWellFunctionNames(wells);

  const tableData = useMemo(
    () => makeTableData(sdk, wells, wellStats, tokenPrices),
    [sdk, tokenPrices, wellStats, wells]
  );

  const loading = useLagLoading(
    isLoading ||
      apysLoading ||
      positionsLoading ||
      lpTokenPricesLoading ||
      tokenPricesLoading ||
      wellNamesLoading
  );
>>>>>>> master

  const loading = useLagLoading(isLoading || apysLoading || positionsLoading);

  if (error) {
    return <Error message={error?.message} errorOnly />;
  }

  return (
    <Page>
      <Title fontWeight={"600"} title="WELLS" largeOnMobile />
      <StyledRow gap={24} mobileGap={"0px"}>
        <Item stretch>
          <TabButton onClick={() => showTab(0)} active={tab === 0} stretch bold justify hover>
            <span>View Wells</span>
          </TabButton>
        </Item>
        <Item stretch>
          <TabButton onClick={() => showTab(1)} active={tab === 1} stretch bold justify hover>
            <span>My Liquidity Positions</span>
          </TabButton>
        </Item>
      </StyledRow>
      <StyledTable>
        {tab === 0 ? (
          <THead>
            <TableRow>
              <DesktopHeader>Well</DesktopHeader>
              <DesktopHeader>Well Function</DesktopHeader>
              <DesktopHeader align="right">Yield</DesktopHeader>
              <DesktopHeader align="right">Total Liquidity</DesktopHeader>
              <DesktopHeader align="right">Price</DesktopHeader>
              <DesktopHeader align="right">24H Volume</DesktopHeader>
              <DesktopHeader align="right">Reserves</DesktopHeader>
              <MobileHeader>All Wells</MobileHeader>
            </TableRow>
          </THead>
        ) : (
          <THead>
            <TableRow>
              <DesktopHeader>My Positions</DesktopHeader>
              <DesktopHeader align="right">My Liquidity</DesktopHeader>
              <DesktopHeader align="right">USD Value</DesktopHeader>
              <MobileHeader>My Liquidity Positions</MobileHeader>
              <MobileHeader align="right">USD Value</MobileHeader>
            </TableRow>
          </THead>
        )}
        <TBody>
          {loading || !tableData.length ? (
            <>
              {Array(5)
                .fill(null)
                .map((_, idx) =>
                  tab === 0 ? (
                    <WellDetailLoadingRow key={`well-detail-loading-row-${idx}`} />
                  ) : (
                    <MyWellPositionLoadingRow key={`well-position-loading-row-${idx}`} />
                  )
                )}
            </>
          ) : (
            <>
              {hasPositions === false && tab === 1 ? (
                <>
                  <NoLPRow colSpan={3}>
                    <NoLPMessage>Liquidity Positions will appear here.</NoLPMessage>
                  </NoLPRow>
                  <NoLPRowMobile colSpan={2}>
                    <NoLPMessage>Liquidity Positions will appear here.</NoLPMessage>
                  </NoLPRowMobile>
                </>
              ) : (
<<<<<<< HEAD
                wells?.map((well, index) => {
                  let price = undefined;
                  let volume = undefined;
                  if (wellStats && well.tokens && wellTokenPrices[index]) {
                    price = well.tokens[1].fromHuman(wellStats[index].last_price).mul(wellTokenPrices[index][1] as TokenValue);
                    volume =  well.tokens[1].fromHuman(wellStats[index].target_volume).mul(wellTokenPrices[index][1] as TokenValue);
                  };
                  return tab === 0 ? (
                    <WellDetailRow
                      well={well}
                      liquidity={wellLiquidity?.[index]}
                      functionName={wellFunctionNames?.[index]}
                      price={price}
                      volume={volume}
                      key={`well-detail-row-${well.address}-${index}`}
                    />
                  ) : (
=======
                tableData?.map(({ well, baseTokenPrice, liquidityUSD, targetVolume }, index) => {
                  if (tab === 0) {
                    const priceFnName =
                      well.wellFunction?.name || wellFnNames?.[well.wellFunction?.address || ""];

                    return (
                      <WellDetailRow
                        well={well}
                        liquidity={liquidityUSD}
                        functionName={priceFnName}
                        price={baseTokenPrice}
                        volume={targetVolume}
                        key={`well-detail-row-${well.address}-${index}`}
                      />
                    );
                  }

                  return (
>>>>>>> master
                    <MyWellPositionRow
                      well={well}
                      position={getPositionWithWell(well)}
                      prices={lpTokenPrices}
                      key={`My-liquidity-row-${well.address}-${index}`}
                    />
                  );
                })
              )}
            </>
          )}
        </TBody>
      </StyledTable>
      <MobileBottomNudge />
    </Page>
  );
};

const makeTableData = (
  sdk: BeanstalkSDK,
  wells?: Well[],
  stats?: BasinAPIResponse[],
  tokenPrices?: Record<string, TokenValue>
) => {
  if (!wells || !wells.length || !tokenPrices) return [];

  const statsByPoolId = (stats ?? []).reduce<Record<string, BasinAPIResponse>>(
    (prev, curr) => ({ ...prev, [curr.pool_id.toLowerCase()]: curr }),
    {}
  );

  const data = (wells || []).map((well) => {
    let baseTokenPrice: TokenValue | undefined = undefined;
    let liquidityUSD: TokenValue | undefined = undefined;
    let targetVolume: TokenValue | undefined = undefined;

    let liquidityUSDInferred: TokenValue | undefined = undefined;

    const token1 = well.tokens?.[0];
    const token2 = well.tokens?.[1];

    if (token1 && token2) {
      const basePrice = tokenPrices[token1.symbol] || TokenValue.ZERO;
      const targetPrice = tokenPrices[token2.symbol] || TokenValue.ZERO;

      const reserve1 = well.reserves?.[0];
      const reserve2 = well.reserves?.[1];
      const reserve1USD = reserve1?.mul(basePrice);
      const reserve2USD = reserve2?.mul(targetPrice);

      if (reserve2USD && reserve1 && reserve1.gt(0)) {
        baseTokenPrice = reserve2USD.div(reserve1);
      }
      if (reserve1USD && reserve2USD && reserve2USD.gt(0)) {
        liquidityUSD = reserve1USD.add(reserve2USD);
      }

      const baseVolume = token2.fromHuman(
        statsByPoolId[well.address.toLowerCase()]?.target_volume || 0
      );
      targetVolume = baseVolume.mul(targetPrice);

      const bothPricesAvailable = !!(reserve1USD && reserve2USD);
      const atLeastOnePriceAvailable = !!(reserve1USD || reserve1USD);

      if (atLeastOnePriceAvailable && !bothPricesAvailable) {
        // Since we don't have the other price, we assume reserves are balanced 50% - 50%
        if (reserve1USD) liquidityUSDInferred = reserve1USD.mul(2);
        if (reserve2USD) liquidityUSDInferred = reserve2USD.mul(2);
      } else if (bothPricesAvailable) {
        liquidityUSDInferred = liquidityUSD;
      }
    }

    const hasReserves = well.reserves?.[0]?.gt(0) && well.reserves?.[1]?.gt(0);

    return {
      well,
      baseTokenPrice,
      liquidityUSD,
      targetVolume,
      liquidityUSDInferred,
      hasReserves
    };
  });

  const whitelistedSort = data.sort(getSortByWhitelisted(sdk));

  const sortedByLiquidity = whitelistedSort.sort((a, b) => {
    if (!a.liquidityUSDInferred) return 1;
    if (!b.liquidityUSDInferred) return -1;

    const diff = a.liquidityUSDInferred.sub(b.liquidityUSDInferred);
    if (diff.eq(0)) return 0;
    return diff.gt(0) ? -1 : 1;
  });

  const sortedByHasReserves = sortedByLiquidity.sort((a, b) => {
    if (a.hasReserves === b.hasReserves) return 0;
    return a.hasReserves && !b.hasReserves ? -1 : 1;
  });

  return sortedByHasReserves;
};

const getSortByWhitelisted =
  (sdk: BeanstalkSDK) =>
  <T extends { well: Well }>(a: T, b: T) => {
    const aWhitelisted = a.well.lpToken && sdk.tokens.isWhitelisted(a.well.lpToken);
    const bWhitelisted = b.well.lpToken && sdk.tokens.isWhitelisted(b.well.lpToken);

    if (aWhitelisted) return -1;
    if (bWhitelisted) return 1;
    return 0;
  };

const StyledTable = styled(Table)`
  overflow: auto;
`;

const TableRow = styled(Row)`
  @media (max-width: ${size.mobile}) {
    height: 66px;
  }
`;

const StyledRow = styled(TabRow)`
  @media (max-width: ${size.mobile}) {
    position: fixed;
    width: 100vw;
    top: calc(100% - 48px);
    left: 0;
  }
`;

const MobileHeader = styled(Th)`
  font-size: 14px;
  padding: 8px 16px;
  @media (min-width: ${size.mobile}) {
    display: none;
  }
`;

const DesktopHeader = styled(Th)`
  :nth-child(1) {
<<<<<<< HEAD
    width: 12em
  }
  :nth-child(2) {
    width: 12em
  }
  :nth-child(3) {
    width: 12em
  }
=======
    width: 10em;
  }
  :nth-child(2) {
    width: 12em;
  }
  :nth-child(3) {
    width: 12em;
  }

>>>>>>> master
  :nth-child(5) {
    @media (max-width: ${size.desktop}) {
      display: none;
    }
  }
  :nth-child(6) {
    @media (max-width: ${size.desktop}) {
      display: none;
    }
  }
<<<<<<< HEAD
=======

  :nth-child(3) {
    @media (max-width: ${size.tablet}) {
      display: none;
    }
  }
>>>>>>> master
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const NoLPRow = styled.td`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #9ca3af;

  ${mediaQuery.sm.only} {
    display: none;
  }
`;

const NoLPRowMobile = styled.td`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #9ca3af;

  ${mediaQuery.sm.up} {
    display: none;
  }
`;

const NoLPMessage = styled.div`
  display: flex;
  justify-content: center;
  color: #4b5563;

  @media (max-width: ${size.mobile}) {
    font-size: 14px;
  }
`;

const MobileBottomNudge = styled.div`
  height: ${theme.spacing(8)};
  width: 100%;

  ${theme.media.query.sm.up} {
    display: none;
  }
`;