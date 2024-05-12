import { TokenValue } from "@beanstalk/sdk";
import React, { useMemo, useState } from "react";
import { Item } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { TabButton } from "src/components/TabButton";
import { Row, TBody, THead, Table, Th } from "src/components/Table";
import { Row as TabRow } from "src/components/Layout";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";
import { mediaQuery, size } from "src/breakpoints";
import { Error } from "src/components/Error";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { useLPPositionSummary } from "src/tokens/useLPPositionSummary";

import { WellDetailLoadingRow, WellDetailRow } from "src/components/Well/Table/WellDetailRow";
import { MyWellPositionLoadingRow, MyWellPositionRow } from "src/components/Well/Table/MyWellPositionRow";
import { useBeanstalkSiloAPYs } from "src/wells/useBeanstalkSiloAPYs";
import { useLagLoading } from "src/utils/ui/useLagLoading";
import useBasinStats from "src/wells/useBasinStats";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const { data: wellStats } = useBasinStats();
  const sdk = useSdk();

  const [wellLiquidity, setWellLiquidity] = useState<(TokenValue | undefined)[]>([]);
  const [wellFunctionNames, setWellFunctionNames] = useState<string[]>([]);
  const [wellTokenPrices, setWellTokenPrices] = useState<(TokenValue | null)[][]>([]);
  const [tab, showTab] = useState<number>(0);

  const { data: lpTokenPrices } = useWellLPTokenPrice(wells);
  const { hasPositions, getPositionWithWell, isLoading: positionsLoading } = useLPPositionSummary();
  const { isLoading: apysLoading } = useBeanstalkSiloAPYs();
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
          {loading ? (
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
    </Page>
  );
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
    width: 12em
  }
  :nth-child(2) {
    width: 12em
  }
  :nth-child(3) {
    width: 12em
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
