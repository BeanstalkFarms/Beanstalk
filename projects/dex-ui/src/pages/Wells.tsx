import { TokenValue } from "@beanstalk/sdk";
import React, { ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Item } from "src/components/Layout";
import { Page } from "src/components/Page";
import { Title } from "src/components/PageComponents/Title";
import { TabButton } from "src/components/TabButton";
import { Row, TBody, THead, Table, Td, Th } from "src/components/Table";
import { Row as TabRow } from "src/components/Layout";
import { TokenLogo } from "src/components/TokenLogo";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { useWells } from "src/wells/useWells";
import styled from "styled-components";
import { useAccount } from "wagmi";
import { size } from "src/breakpoints";
import { Log } from "src/utils/logger";
import { Loading } from "./Loading";

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const navigate = useNavigate();
  const sdk = useSdk();
  const { address } = useAccount();
  const [wellLiquidity, setWellLiquidity] = useState<(TokenValue | undefined)[]>([]);
  const [wellFunctionNames, setWellFunctionNames] = useState<string[]>([]);
  const [wellLpBalances, setWellLpBalances] = useState<(TokenValue | undefined)[]>([]);
  const [tab, showTab] = useState<number>(0);

  useMemo(() => {
    const run = async () => {
      if (!wells || !wells.length) return;
      let _wellsLiquidityUSD = [];
      for (let i = 0; i < wells.length; i++) {
        if (!wells[i].tokens) return;
        const _tokenPrices = await Promise.all(wells[i].tokens!.map((token) => getPrice(token, sdk)));
        const _reserveValues = wells[i].reserves?.map((tokenReserve, index) =>
          tokenReserve.mul((_tokenPrices[index] as TokenValue) || TokenValue.ZERO)
        );
        let initialValue = TokenValue.ZERO;
        const _totalWellLiquidity = _reserveValues?.reduce((accumulator, currentValue) => currentValue.add(accumulator), initialValue);
        _wellsLiquidityUSD[i] = _totalWellLiquidity;
      }
      setWellLiquidity(_wellsLiquidityUSD);

      let _wellsFunctionNames = [];
      for (let i = 0; i < wells.length; i++) {
        if (!wells[i].wellFunction) return;
        const _wellName = await wells[i].wellFunction!.contract.name();
        _wellsFunctionNames[i] = _wellName;
      }
      setWellFunctionNames(_wellsFunctionNames);

      let _wellsLpBalances = [];
      for (let i = 0; i < wells.length; i++) {
        if (!address || !wells[i].lpToken) return;
        const _lpBalance = await wells[i].lpToken?.getBalance(address);
        _wellsLpBalances[i] = _lpBalance;
      }
      setWellLpBalances(_wellsLpBalances);
    };

    run();
  }, [sdk, wells, address]);

  if (isLoading) {
    return <Loading />
  }

  if (error) {
    Log.module("Wells").error(`useWells(): ${error.message}`);
  }

  function WellRow(well: any, index: any) {
    if (!well) return;
    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const smallLogos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    tokens.map((token: any) => {
      logos.push(<TokenLogo token={token} size={25} key={token.symbol} />);
      smallLogos.push(<TokenLogo token={token} size={16} key={token.symbol} />);
      symbols.push(token.symbol);
    });

    return (
      <TableRow key={well.address} onClick={gotoWell}>
        <DesktopContainer>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
          </WellDetail>
        </DesktopContainer>
        <DesktopContainer>
          <WellPricing>{wellFunctionNames[index] ? wellFunctionNames[index] : "Price Function"}</WellPricing>
        </DesktopContainer>
        <DesktopContainer align="right">
          <TradingFee>0.00%</TradingFee>
        </DesktopContainer>
        <DesktopContainer align="right">
          <Amount>${wellLiquidity[index] ? wellLiquidity[index]!.toHuman("short") : "-.--"}</Amount>
        </DesktopContainer>
        <DesktopContainer align="right">
          <Reserves>
            {smallLogos[0]}
            {well.reserves![0] ? well.reserves![0].toHuman("short") : "-.--"}
          </Reserves>
          <Reserves>
            {smallLogos[1]}
            {well.reserves![1] ? well.reserves![1].toHuman("short") : "-.--"}
          </Reserves>
          {well.reserves && well.reserves.length > 2 ? <MoreReserves>{`+ ${well.reserves.length - 2} MORE`}</MoreReserves> : null}
        </DesktopContainer>
        <MobileContainer>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
          </WellDetail>
          <Amount>${wellLiquidity[index] ? Number(wellLiquidity[index]!.toHuman()).toFixed(2) : "-.--"}</Amount>
        </MobileContainer>
      </TableRow>
    );
  }

  function MyLPsRow(well: any, index: any) {
    if (!well || !wellLpBalances || !wellLpBalances[index] || wellLpBalances[index]!.eq(TokenValue.ZERO)) return;
    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    tokens.map((token: any) => {
      logos.push(<TokenLogo token={token} size={25} key={token.symbol} />);
      symbols.push(token.symbol);
    });

    return (
      <TableRow key={well.address} onClick={gotoWell}>
        <DesktopContainer>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
          </WellDetail>
        </DesktopContainer>
        <DesktopContainer align="right">
          <WellLPBalance>{`${wellLpBalances[index]!.toHuman("short")} ${well.lpToken.symbol}`}</WellLPBalance>
        </DesktopContainer>
        <MobileContainer>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
            {/* <Deployer>{deployer}</Deployer> */}
          </WellDetail>
          <WellLPBalance>{`${wellLpBalances[index]!.toHuman("short")} ${well.lpToken.symbol}`}</WellLPBalance>
        </MobileContainer>
      </TableRow>
    );
  }

  const rows = wells?.map((well, index) => {
    return tab === 0 ? WellRow(well, index) : MyLPsRow(well, index);
  });

  const anyLpPositions = rows ? !rows.every((row) => row === undefined) : false;

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
      <Table>
        {tab === 0 ? (
          <THead>
            <TableRow>
              <DesktopHeader>Well</DesktopHeader>
              <DesktopHeader>Well Function</DesktopHeader>
              <DesktopHeader align="right">Trading Fees</DesktopHeader>
              <DesktopHeader align="right">Total Liquidity</DesktopHeader>
              <DesktopHeader align="right">Reserves</DesktopHeader>
              <MobileHeader>All Wells</MobileHeader>
            </TableRow>
          </THead>
        ) : (
          <THead>
            <TableRow>
              <DesktopHeader>My Positions</DesktopHeader>
              <DesktopHeader align="right">My Liquidity</DesktopHeader>
              <MobileHeader>My Liquidity Positions</MobileHeader>
            </TableRow>
          </THead>
        )}
        <TBody>
          {anyLpPositions === false && tab === 1 ? (
            <>
              <NoLPRow colSpan={2}>
                <NoLPMessage>Liquidity Positions will appear here.</NoLPMessage>
              </NoLPRow>
              <NoLPRowMobile>
                <NoLPMessage>Liquidity Positions will appear here.</NoLPMessage>
              </NoLPRowMobile>
            </>
          ) : (
            rows
          )}
        </TBody>
      </Table>
    </Page>
  );
};

const TableRow = styled(Row)`
  @media (max-width: ${size.mobile}) {
    height: 66px;
  }
`;

const StyledRow = styled(TabRow)`
  @media (max-width: ${size.mobile}) {
    position: fixed;
    width: 100vw;
    margin-left: -12px;
    margin-bottom: -2px;
    top: calc(100% - 40px);
  }
`;

const DesktopContainer = styled(Td)`
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const MobileContainer = styled(Td)`
  padding: 8px 16px;
  @media (min-width: ${size.mobile}) {
    display: none;
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
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const WellDetail = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  @media (min-width: ${size.mobile}) {
    flex-direction: column;
  }
`;

const TokenLogos = styled.div`
  display: flex;
  div:not(:first-child) {
    margin-left: -8px;
  }
`;
const TokenSymbols = styled.div`
  font-size: 20px;
  line-height: 24px;
  margin-top: 8px;
  color: #1c1917;
  @media (max-width: ${size.mobile}) {
    font-size: 14px;
  }
`;

const Amount = styled.div`
  font-weight: 500;
  font-size: 20px;
  line-height: 24px;
  color: #1c1917;

  @media (max-width: ${size.mobile}) {
    font-size: 14px;
    font-weight: normal;
  }
`;

const Reserves = styled.div`
  display: flex;
  flex-direction: row;
  justify-content flex-end;
  gap: 8px;
  flex: 1;
`;

const MoreReserves = styled.div`
  color: #9ca3af;
`;

const TradingFee = styled.div`
  font-size: 20px;
  line-height: 24px;
  color: #4b5563;
  text-transform: uppercase;
`;

const WellPricing = styled.div`
  font-size: 20px;
  line-height: 24px;
  text-transform: capitalize;
`;

const NoLPRow = styled.td`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #9ca3af;
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const NoLPRowMobile = styled.td`
  background-color: #fff;
  height: 120px;
  border-bottom: 0.5px solid #9ca3af;
  @media (min-width: ${size.mobile}) {
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

const WellLPBalance = styled.div`
  font-size: 20px;
  line-height: 24px;
  @media (max-width: ${size.mobile}) {
    font-size: 14px;
    font-weight: normal;
  }
`;
