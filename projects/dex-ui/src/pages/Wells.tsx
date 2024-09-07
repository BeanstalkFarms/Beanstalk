import React, { useMemo, useState } from "react";

import styled from "styled-components";

import { BeanstalkSDK, TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk-wells";

import { mediaQuery, size } from "src/breakpoints";
import { Error } from "src/components/Error";
import { Item } from "src/components/Layout";
import { Row as TabRow } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { TabButton } from "src/components/TabButton";
import { Row, TBody, THead, Table, Th } from "src/components/Table";
import {
  MyWellPositionLoadingRow,
  MyWellPositionRow
} from "src/components/Well/Table/MyWellPositionRow";
import { WellDetailLoadingRow, WellDetailRow } from "src/components/Well/Table/WellDetailRow";
import { useLPPositionSummary } from "src/tokens/useLPPositionSummary";
import { BasinAPIResponse } from "src/types";
import { useTokenPrices } from "src/utils/price/useTokenPrices";
import useSdk from "src/utils/sdk/useSdk";
import { theme } from "src/utils/ui/theme";
import { useLagLoading } from "src/utils/ui/useLagLoading";
import useBasinStats from "src/wells/useBasinStats";
import { useBeanstalkSiloAPYs } from "src/wells/useBeanstalkSiloAPYs";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { useWells } from "src/wells/useWells";
import { useWellFunctionNames } from "src/wells/wellFunction/useWellFunctionNames";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const { data: wellStats = [] } = useBasinStats();
  const sdk = useSdk();

  console.log(wells);

  const [tab, showTab] = useState<number>(0);

  const { data: lpTokenPrices, isLoading: lpTokenPricesLoading } = useWellLPTokenPrice(wells);
  const { hasPositions, getPositionWithWell, isLoading: positionsLoading } = useLPPositionSummary();
  const { isLoading: apysLoading } = useBeanstalkSiloAPYs();
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
    const aWhitelisted = a.well.lpToken && sdk.tokens.getIsWhitelistedWellLPToken(a.well.lpToken);
    const bWhitelisted = b.well.lpToken && sdk.tokens.getIsWhitelistedWellLPToken(b.well.lpToken);

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
    width: 10em;
  }
  :nth-child(2) {
    width: 12em;
  }
  :nth-child(3) {
    width: 12em;
  }

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

  :nth-child(3) {
    @media (max-width: ${size.tablet}) {
      display: none;
    }
  }
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
