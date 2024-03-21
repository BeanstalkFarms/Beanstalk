import { TokenValue } from "@beanstalk/sdk";
import React, { FC, ReactNode } from "react";
import { Row, Td } from "src/components/Table";
import { TokenLogo } from "src/components/TokenLogo";
import styled from "styled-components";
import { mediaQuery, size } from "src/breakpoints";
import { displayTokenSymbol, formatNum, formatUSD } from "src/utils/format";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { LPBalanceSummary } from "src/tokens/useLPPositionSummary";
import { useBeanstalkSiloWhitelist } from "src/wells/useBeanstalkSiloWhitelist";
import { Tooltip } from "src/components/Tooltip";
import { Well } from "@beanstalk/sdk/Wells";
import { Skeleton } from "src/components/Skeleton";

import { useNavigate } from "react-router-dom";
import { useIsMobile } from "src/utils/ui/useIsMobile";

const PositionBreakdown: React.FC<{
  items: { external: TokenValue; silo: TokenValue; internal: TokenValue; total: TokenValue };
  isWhitelisted: boolean;
  isLP: boolean;
  totalDisplay: string;
}> = ({ items, isWhitelisted, totalDisplay, isLP = true }) => {
  const formatFn = isLP ? formatNum : formatUSD;
  const isMobile = useIsMobile();

  const getTooltipProps = () => {
    let base = { side: "right", offsetX: 3, offsetY: -100, arrowSize: 4, arrowOffset: 40 };

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

export const MyWellPositionRow: FC<{
  well: Well | undefined;
  position: LPBalanceSummary | undefined;
  prices: ReturnType<typeof useWellLPTokenPrice>["data"];
}> = ({ well, position, prices }) => {
  const navigate = useNavigate();
  const { getIsWhitelisted } = useBeanstalkSiloWhitelist();

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
    <TableRow onClick={gotoWell}>
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

export const MyWellPositionLoadingRow: FC<{}> = () => (
  <TableRow>
    <DesktopContainer>
      <LoadingColumn>
        <Skeleton height={25} width={40} />
        <Skeleton height={24} width={115} />
      </LoadingColumn>
    </DesktopContainer>
    <DesktopContainer align="right">
      <Skeleton height={24} width={115} />
    </DesktopContainer>
    <DesktopContainer align="right">
      <Skeleton height={24} width={115} />
    </DesktopContainer>
    <MobileContainer>
      <LoadingColumn>
        <Skeleton height={26} width={125} />
        <Skeleton height={20} width={50} />
      </LoadingColumn>
    </MobileContainer>
    <MobileContainer align="right">
      <Skeleton height={24} width={50} />
    </MobileContainer>
  </TableRow>
);

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
