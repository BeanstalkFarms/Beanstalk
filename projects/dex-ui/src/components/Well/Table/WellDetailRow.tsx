import { TokenValue } from "@beanstalk/sdk";
import React, { FC, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Row, Td } from "src/components/Table";
import { TokenLogo } from "src/components/TokenLogo";
import styled from "styled-components";
import { mediaQuery, size } from "src/breakpoints";
import { formatNum } from "src/utils/format";
import { Well } from "@beanstalk/sdk/Wells";
import { Skeleton } from "src/components/Skeleton";
import { WellYieldWithTooltip } from "../WellYieldWithTooltip";
import { Item } from "src/components/Layout";

/// format value with 2 decimals, if value is less than 1M, otherwise use short format
const formatMayDecimals = (tv: TokenValue | undefined) => {
  if (!tv) return "-.--";
  if (tv.lt(1_000_000)) {
    return formatNum(tv, { minDecimals: 2, maxDecimals: 2 });
  }
  return tv.toHuman("short");
};

export const WellDetailRow: FC<{
  well: Well | undefined;
  liquidity: TokenValue | undefined;
  functionName: string | undefined;
}> = ({ well, liquidity, functionName }) => {
  const navigate = useNavigate();

  if (!well) return null;

  const tokens = well?.tokens || [];
  const logos: ReactNode[] = [];
  const smallLogos: ReactNode[] = [];
  const symbols: string[] = [];
  const gotoWell = () => navigate(`/wells/${well?.address}`);

  tokens.map((token: any) => {
    logos.push(<TokenLogo token={token} size={25} key={token.symbol} />);
    smallLogos.push(<TokenLogo token={token} size={16} key={token.symbol} />);
    symbols.push(token.symbol);
  });

  return (
    <TableRow onClick={gotoWell}>
      <DesktopContainer>
        <WellDetail>
          <TokenLogos>{logos}</TokenLogos>
          <TokenSymbols>{symbols.join("/")}</TokenSymbols>
        </WellDetail>
      </DesktopContainer>
      <DesktopContainer>
        <WellPricing>{functionName || "Price Function"}</WellPricing>
      </DesktopContainer>
      <DesktopContainer align="right">
        <Item column right>
          <WellYieldWithTooltip well={well} />
        </Item>
      </DesktopContainer>
      <DesktopContainer align="right">
        <Amount>${liquidity ? liquidity.toHuman("short") : "-.--"}</Amount>
      </DesktopContainer>
      <DesktopContainer align="right">
        <Reserves>
          {<TokenLogoWrapper>{smallLogos[0]}</TokenLogoWrapper>}
          {formatMayDecimals(well.reserves?.[0])}
        </Reserves>
        <Reserves>
          {<TokenLogoWrapper>{smallLogos[1]}</TokenLogoWrapper>}
          {formatMayDecimals(well.reserves?.[1])}
        </Reserves>
        {well.reserves && well.reserves.length > 2 ? <MoreReserves>{`+ ${well.reserves.length - 2} MORE`}</MoreReserves> : null}
      </DesktopContainer>
      <MobileContainer>
        <WellDetail>
          <TokenLogos>{logos}</TokenLogos>
          <TokenSymbols>{symbols.join("/")}</TokenSymbols>
        </WellDetail>
        <Amount>${formatNum(liquidity, { minDecimals: 2 })}</Amount>
      </MobileContainer>
    </TableRow>
  );
};

export const WellDetailLoadingRow: FC<{}> = () => {
  return (
    <TableRow onClick={() => {}}>
      <DesktopContainer>
        <LoadingColumn>
          <Skeleton height={25} width={40} />
          <Skeleton height={24} width={115} />
        </LoadingColumn>
      </DesktopContainer>
      <DesktopContainer>
        <Skeleton height={24} width={125} />
      </DesktopContainer>
      <DesktopContainer align="right">
        <Skeleton height={32} width={75} />
      </DesktopContainer>
      <DesktopContainer align="right">
        <Skeleton height={24} width={90} />
      </DesktopContainer>
      <DesktopContainer align="right">
        <LoadingColumn align="right">
          <Skeleton height={24} width={50} />
          <Skeleton height={24} width={50} />
        </LoadingColumn>
      </DesktopContainer>
      <MobileContainer>
        <LoadingColumn>
          <Skeleton height={26} width={200} />
          <Skeleton height={20} width={50} />
        </LoadingColumn>
      </MobileContainer>
    </TableRow>
  );
};

const LoadingColumn = styled.div<{ align?: "right" | "left" }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  ${(props) => `
    align-items: ${props.align === "right" ? "flex-end" : "flex-start"};
  `}

  ${mediaQuery.sm.only} {
    gap: 4px;
  }
`;

const TableRow = styled(Row)`
  @media (max-width: ${size.mobile}) {
    height: 66px;
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
  color: #1c1917;
  @media (max-width: ${size.mobile}) {
    font-size: 14px;
    margin-top: 2px;
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
  align-items: center;
  gap: 4px;
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

const TokenLogoWrapper = styled.div`
  margin-bottom: 2px;
`;

const TooltipContainer = styled.div`
  display: flex;
`;
