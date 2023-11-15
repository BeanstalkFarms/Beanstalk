import { TokenValue } from "@beanstalk/sdk";
import React, { FC, ReactNode, useMemo, useState } from "react";
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
import { size } from "src/breakpoints";
import { Loading } from "../components/Loading";
import { Error } from "../components/Error";
import { displayTokenSymbol, formatNum, formatUSD } from "src/utils/format";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { LPBalanceSummary, useLPPositionSummary } from "src/tokens/useLPPositionSummary";
import { useBeanstalkSiloWhitelist } from "src/wells/useBeanstalkSiloWhitelist";
import { Tooltip } from "src/components/Tooltip";
import { Well } from "@beanstalk/sdk/Wells";
import useIsMobile from "src/utils/ui/useIsMobile";

const PositionBreakdown: React.FC<{
  items: { external: TokenValue; silo: TokenValue; internal: TokenValue; total: TokenValue };
  isWhitelisted: boolean;
  isLP: boolean;
  totalDisplay: string;
}> = ({ items, isWhitelisted, totalDisplay, isLP = true }) => {
  const formatFn = isLP ? formatNum : formatUSD;
  const isMobile = useIsMobile();

  const getTooltipProps = () => {
    let base = {
      side: "right",
      offsetX: 3,
      offsetY: -100,
      arrowSize: 4,
      arrowOffset: 40
    };

    if (isMobile) {
      if (isLP) {
        base.offsetY = -162;
        base.arrowOffset = 67;
      } else {
        base.side = "left";
        base.offsetX = -5;
        base.offsetY = -96;
        base.arrowOffset = 43;
      }
    } else if (!isMobile && !isLP) {
      base.side = "left";
      base.offsetX = -10;
      base.offsetY = -100;
    }

    return base;
  };

  return isWhitelisted ? (
    <Tooltip
      {...getTooltipProps()}
      content={
        <Breakdown>
          <BreakdownRow>
            {"Wallet Balance:"}
            <span>{formatFn(items.external)}</span>
          </BreakdownRow>
          <BreakdownRow>
            {"Silo Deposits:"}
            <span>{formatFn(items.silo)}</span>
          </BreakdownRow>
          <BreakdownRow>
            {"Farm Balance:"}
            <span>{formatFn(items.internal)}</span>
          </BreakdownRow>
        </Breakdown>
      }
    >
      <WellLPBalance>{totalDisplay}</WellLPBalance>
    </Tooltip>
  ) : (
    <WellLPBalance>{totalDisplay}</WellLPBalance>
  );
};

export const Wells = () => {
  const { data: wells, isLoading, error } = useWells();
  const navigate = useNavigate();
  const sdk = useSdk();

  const [wellLiquidity, setWellLiquidity] = useState<(TokenValue | undefined)[]>([]);
  const [wellFunctionNames, setWellFunctionNames] = useState<string[]>([]);
  const [tab, showTab] = useState<number>(0);

  const { data: lpTokenPrices } = useWellLPTokenPrice(wells);

  const { hasPositions, getPositionWithWell } = useLPPositionSummary();

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
    };

    run();
  }, [sdk, wells]);

  if (isLoading) {
    return <Loading spinnerOnly />;
  }

  if (error) {
    return <Error message={error?.message} errorOnly />;
  }

  const MyLiquidityRow: FC<{
    well: Well | undefined;
    position: LPBalanceSummary | undefined;
    prices: ReturnType<typeof useWellLPTokenPrice>["data"];
  }> = ({ well, position, prices }) => {
    const lpAddress = well?.lpToken?.address;
    const lpToken = well?.lpToken;

    if (!well || !position || position.total.lte(0) || !lpAddress || !lpToken) {
      return null;
    }

    const tokens = well.tokens || [];
    const logos: ReactNode[] = [];
    const symbols: string[] = [];
    const gotoWell = () => navigate(`/wells/${well.address}`);

    tokens.map((token: any) => {
      logos.push(<TokenLogo token={token} size={25} key={token.symbol} />);
      symbols.push(token.symbol);
    });

    const lpPrice = lpAddress && lpAddress in prices ? prices[lpAddress] : undefined;
    const whitelisted = getIsWhitelisted(well);

    const positionsUSD = {
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
            <PositionBreakdown
              isWhitelisted={whitelisted}
              items={position}
              totalDisplay={`${position?.total.toHuman("short") || "-"} ${displayTokenSymbol(lpToken)}`}
              isLP
            />
          </BalanceContainer>
        </DesktopContainer>
        <DesktopContainer align="right">
          <BalanceContainer>
            <PositionBreakdown isWhitelisted={whitelisted} items={positionsUSD} totalDisplay={formatUSD(positionsUSD.total)} isLP={false} />
          </BalanceContainer>
        </DesktopContainer>
        <MobileContainer>
          <WellDetail>
            <TokenLogos>{logos}</TokenLogos>
            <TokenSymbols>{symbols.join("/")}</TokenSymbols>
            {/* <Deployer>{deployer}</Deployer> */}
          </WellDetail>
          <BalanceContainer left={true}>
            <PositionBreakdown
              items={position}
              isWhitelisted={whitelisted}
              totalDisplay={`${position?.total.toHuman("short") || "-"} ${displayTokenSymbol(lpToken)}`}
              isLP
            />
          </BalanceContainer>
        </MobileContainer>
        <MobileContainer align="right">
          <BalanceContainer>
            <PositionBreakdown items={positionsUSD} isWhitelisted={whitelisted} totalDisplay={formatUSD(positionsUSD.total)} isLP={false} />
          </BalanceContainer>
        </MobileContainer>
      </TableRow>
    );
  };

  const WellRow: FC<{ well: Well | undefined; index: number }> = ({ well, index }) => {
    if (!well) return null;

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
  };

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
          {hasPositions === false && tab === 1 ? (
            <>
              <NoLPRow colSpan={3}>
                <NoLPMessage>Liquidity Positions will appear here.</NoLPMessage>
              </NoLPRow>
            </>
          ) : (
            wells?.map((well, index) => {
              return tab === 0 ? (
                <>
                  <WellRow well={well} index={index} key={well.address} />
                </>
              ) : (
                <MyLiquidityRow well={well} position={getPositionWithWell(well)} prices={lpTokenPrices} key={well.address} />
              );
            })
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

const BalanceContainer = styled.div<{ left?: boolean }>`
  display: flex;
  justify-content: ${(props) => (props.left ? "flex-start" : "flex-end")};
`;

const Breakdown = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 4px;
  @media (max-width: ${size.mobile}) {
    gap: 0px;
  }
`;

const BreakdownRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 4px;
`;
