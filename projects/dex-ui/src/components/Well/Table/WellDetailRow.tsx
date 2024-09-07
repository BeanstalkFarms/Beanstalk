import React, { FC } from "react";

import { Well } from "@beanstalk/sdk/Wells";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

import { TokenValue } from "@beanstalk/sdk";

import { mediaQuery, size } from "src/breakpoints";
import { Item } from "src/components/Layout";
import { Skeleton } from "src/components/Skeleton";
import { Row, Td } from "src/components/Table";
import { TokenLogo } from "src/components/TokenLogo";
import { formatNum } from "src/utils/format";

import { WellYieldWithTooltip } from "../WellYieldWithTooltip";

/// format value with 2 decimals, if value is less than 1M, otherwise use short format
const formatMayDecimals = (tv: TokenValue | undefined) => {
  if (!tv) return "-.--";
  if (tv.gt(0) && tv.lt(0.001)) return "<0.001";
  if (tv.lt(1_000_000)) {
    return formatNum(tv, { minDecimals: 2, maxDecimals: 2 });
  }
  return tv.toHuman("short");
};

export const WellDetailRow: FC<{
  well: Well | undefined;
  liquidity: TokenValue | undefined;
  functionName: string | undefined;
  price: TokenValue | undefined;
  volume: TokenValue | undefined;
}> = ({ well, liquidity, functionName, price, volume }) => {
  const navigate = useNavigate();
  const tokens = well?.tokens || [];

  const gotoWell = () => navigate(`/wells/${well?.address}`);

  const renderTokenSymbols = () => {
    return tokens
      .map((token) => token.symbol)
      .join("/")
      .toString();
  };

  if (!well) return null;

  return (
    <TableRow onClick={gotoWell}>
      <DesktopContainer>
        <WellDetail>
          <TokenLogos>
            {tokens.map((token, i) => (
              <TokenLogo
                token={token}
                size={25}
                key={`desktop-logos-${well.address}-${token.address}-${i}`}
              />
            ))}
          </TokenLogos>
          <TokenSymbols>{renderTokenSymbols()}</TokenSymbols>
        </WellDetail>
      </DesktopContainer>
      <DesktopContainer>
        <PricingFunction>
          <div className="function-name">{functionName || "Price Function"}</div>
          <div className="trading-fee">{"0.00% Trading Fees"}</div>
        </PricingFunction>
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
        <Amount>${price && price.gt(0) ? price.toHuman("short") : "-.--"}</Amount>
      </DesktopContainer>
      <DesktopContainer align="right">
        <Amount>${volume ? volume.toHuman("short") : "-.--"}</Amount>
      </DesktopContainer>
      <DesktopContainer align="right">
        {tokens.map((token, i) => {
          return (
            <Reserves key={`reserves-${well.address}-${token.address}-${i}`}>
              <TokenLogoWrapper>
                <TokenLogo token={token} size={16} />
              </TokenLogoWrapper>
              {formatMayDecimals(well.reserves?.[i])}
            </Reserves>
          );
        })}
        {well.reserves && well.reserves.length > 2 ? (
          <MoreReserves>{`+ ${well.reserves.length - 2} MORE`}</MoreReserves>
        ) : null}
      </DesktopContainer>
      <MobileContainer>
        <WellDetail>
          <TokenLogos>
            {tokens.map((token, i) => (
              <TokenLogo
                token={token}
                size={25}
                key={`mobile-logos-${well.address}-${token.address}-${i}`}
              />
            ))}
          </TokenLogos>
          <TokenSymbols>{renderTokenSymbols()}</TokenSymbols>
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
        <Skeleton height={24} width={90} />
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
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  flex: 1;
`;

const MoreReserves = styled.div`
  color: #9ca3af;
`;

const TokenLogoWrapper = styled.div`
  margin-bottom: 2px;
`;

const PricingFunction = styled.div`
  .function-name {
    color: #1c1917;
    font-size: 20px;
    line-height: 24px;
    text-transform: capitalize;
  }

  .trading-fee {
    color: #4b5563;
    font-size: 16px;
    line-height: 24px;
  }
`;
