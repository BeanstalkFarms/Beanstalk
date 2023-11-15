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
import { Loading } from "../components/Loading";
import { Error } from "../components/Error";
import { displayTokenSymbol, formatNum, formatUSD } from "src/utils/format";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { useLPPositionSummary } from "src/tokens/useLPPositionSummary";
import { useBeanstalkSiloWhitelist } from "src/wells/useBeanstalkSiloWhitelist";
import { Tooltip } from "src/components/Tooltip";

const tooltipProps = {
  offsetX: -20,
  offsetY: 375,
  arrowSize: 4,
  arrowOffset: 95,
  side: "top",
  width: 200
} as const;

const usdValueTooltipProps = {
  offsetX: -40,
  offsetY: 375,
  arrowSize: 4,
  arrowOffset: 95,
  side: "top",
  width: 200
} as const;

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const navigate = useNavigate();
  const sdk = useSdk();
  const { address } = useAccount();
  const [wellLiquidity, setWellLiquidity] = useState<(TokenValue | undefined)[]>([]);
  const [wellFunctionNames, setWellFunctionNames] = useState<string[]>([]);
  const [wellLpBalances, setWellLpBalances] = useState<(TokenValue | undefined)[]>([]);
  const [tab, showTab] = useState<number>(0);

  const { data: lpTokenPrices } = useWellLPTokenPrice(wells);

  const { getPositionWithWell } = useLPPositionSummary();
  const { getIsWhitelisted } = useBeanstalkSiloWhitelist();

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
    return <Loading spinnerOnly />;
  }

  if (error) {
    return <Error message={error?.message} errorOnly />;
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
          <Amount>${formatNum(wellLiquidity[index], { minDecimals: 2 })}</Amount>
        </MobileContainer>
      </TableRow>
    );
  }

  function MyLPsRow(well: any, index: any) {
    const position = getPositionWithWell(well);
    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    if (!well || !position || position.total.lte(0)) {
      return null;
    }

    tokens.map((token: any) => {
      logos.push(<TokenLogo token={token} size={25} key={token.symbol} />);
      symbols.push(token.symbol);
    });

    const lpAddress = well.lpToken.address as string;
    const lpPrice = (lpAddress && lpAddress in lpTokenPrices && lpTokenPrices[lpAddress]) || undefined;
    const whitelisted = getIsWhitelisted(well);

    const lpBalance = wellLpBalances[index] || TokenValue.ZERO;
    const positionTotalUSD = (lpPrice && lpPrice.mul(lpBalance)) || undefined;

    const usdValue = {
      total: lpPrice?.mul(position.total) || TokenValue.ZERO,
      external: lpPrice?.mul(position.external) || TokenValue.ZERO,
      silo: lpPrice?.mul(position.silo) || TokenValue.ZERO,
      internal: lpPrice?.mul(position.internal) || TokenValue.ZERO
    };

    return (
      <TableRow key={well.address} onClick={gotoWell}>
        <DesktopContainer>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
          </WellDetail>
        </DesktopContainer>
        <DesktopContainer align="right">
          <BalanceContainer>
            <WellLPBalance>
              {whitelisted ? (
                <Tooltip
                  {...tooltipProps}
                  content={
                    <Breakdown>
                      <BreakdownRow>
                        {"Wallet: "}
                        <span>{formatNum(position.external)}</span>
                      </BreakdownRow>
                      <BreakdownRow>
                        {"Silo Deposits: "}
                        <span>{formatNum(position.silo)}</span>
                      </BreakdownRow>
                      <BreakdownRow>
                        {"Farm Balance: "}
                        <span>{formatNum(position.internal)}</span>
                      </BreakdownRow>
                    </Breakdown>
                  }
                >
                  {`${position?.total.toHuman("short") || "-"} ${displayTokenSymbol(well.lpToken)}`}
                </Tooltip>
              ) : (
                <>{`${position?.total.toHuman("short") || "-"} ${displayTokenSymbol(well.lpToken)}`}</>
              )}
            </WellLPBalance>
          </BalanceContainer>
        </DesktopContainer>
        <DesktopContainer align="right">
          <BalanceContainer>
            <WellLPBalance>
              {whitelisted ? (
                <Tooltip
                  {...usdValueTooltipProps}
                  content={
                    <Breakdown>
                      <BreakdownRow>
                        {"Wallet: "}
                        <span>{formatUSD(usdValue.external)}</span>
                      </BreakdownRow>
                      <BreakdownRow>
                        {"Silo Deposits: "}
                        <span>{formatUSD(usdValue.silo)}</span>
                      </BreakdownRow>
                      <BreakdownRow>
                        {"Farm Balance: "}
                        <span>{formatUSD(usdValue.internal)}</span>
                      </BreakdownRow>
                    </Breakdown>
                  }
                >
                  {formatUSD(positionTotalUSD)}
                </Tooltip>
              ) : (
                <>{formatUSD(positionTotalUSD)}</>
              )}
            </WellLPBalance>
          </BalanceContainer>
        </DesktopContainer>
        <MobileContainer>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
            {/* <Deployer>{deployer}</Deployer> */}
          </WellDetail>
          <WellLPBalance>{`${position?.total.toHuman("short") || "-"} ${displayTokenSymbol(well.lpToken)}`}</WellLPBalance>
        </MobileContainer>
        <MobileContainer align="right">
          <WellLPBalance>{formatUSD(positionTotalUSD)}</WellLPBalance>
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
              <DesktopHeader align="right">USD Value</DesktopHeader>
              <MobileHeader>My Liquidity Positions</MobileHeader>
              <MobileHeader align="right">USD Value</MobileHeader>
            </TableRow>
          </THead>
        )}
        <TBody>
          {anyLpPositions === false && tab === 1 ? (
            <>
              <NoLPRow colSpan={3}>
                <NoLPMessage>Liquidity Positions will appear here.</NoLPMessage>
              </NoLPRow>
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

const BalanceContainer = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const Breakdown = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 4px;
`;

const BreakdownRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 4px;
`;
