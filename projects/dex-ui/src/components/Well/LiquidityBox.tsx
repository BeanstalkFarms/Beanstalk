import React from "react";

import { Well } from "@beanstalk/sdk/Wells";
import styled from "styled-components";

import { TokenValue } from "@beanstalk/sdk";

import { mediaQuery } from "src/breakpoints";
import { Info } from "src/components/Icons";
import { InfoBox } from "src/components/InfoBox";
import { LoadingItem } from "src/components/LoadingItem";
import { TokenLogo } from "src/components/TokenLogo";
import { Tooltip } from "src/components/Tooltip";
import { BodyCaps, BodyS, BodyXS, LinksButtonText, TextNudge } from "src/components/Typography";
import { useLPPositionSummary } from "src/tokens/useLPPositionSummary";
import { FC } from "src/types";
import { formatUSD } from "src/utils/format";
import useSdk from "src/utils/sdk/useSdk";
import { useBeanstalkSiloWhitelist } from "src/wells/useBeanstalkSiloWhitelist";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";

type Props = {
  well: Well | undefined;
  loading: boolean;
};

const tooltipProps = {
  offsetX: -20,
  offsetY: 375,
  arrowSize: 4,
  arrowOffset: 95,
  side: "top",
  width: 175
} as const;

const displayTV = (value?: TokenValue) => (value?.gt(0) ? value.toHuman("short") : "-");

export const LiquidityBox: FC<Props> = ({ well, loading }) => {
  const sdk = useSdk();

  const { getPositionWithWell } = useLPPositionSummary();
  const { getIsWhitelisted } = useBeanstalkSiloWhitelist();

  const position = getPositionWithWell(well);
  const isWhitelisted = getIsWhitelisted(well);

  const { data: lpTokenPriceMap = {} } = useWellLPTokenPrice(well);
  const sdkToken = well?.lpToken && sdk.tokens.findByAddress(well.lpToken.address);

  const lpAddress = well?.lpToken?.address;
  const lpTokenPrice =
    lpAddress && lpAddress in lpTokenPriceMap ? lpTokenPriceMap[lpAddress] : TokenValue.ZERO;

  const siloUSD = position?.silo.mul(lpTokenPrice) || TokenValue.ZERO;
  const externalUSD = position?.external.mul(lpTokenPrice) || TokenValue.ZERO;
  const internalUSD = position?.internal.mul(lpTokenPrice) || TokenValue.ZERO;

  const USDTotal = siloUSD.add(externalUSD).add(internalUSD);

  return (
    <InfoBox>
      <InfoBox.Header>
        <TextNudge amount={0} mobileAmount={2}>
          <BoxHeader>
            <LoadingItem loading={loading} onLoading={null}>
              {"My Liquidity"}
            </LoadingItem>
          </BoxHeader>
        </TextNudge>
        <LoadingItem loading={loading} onLoading={null}>
          <BoxHeaderAmount>
            <TokenLogo token={well?.lpToken} size={16} mobileSize={16} isLP />
            <TextNudge amount={1.5}>{displayTV(position?.total)}</TextNudge>
          </BoxHeaderAmount>
        </LoadingItem>
      </InfoBox.Header>
      <InfoBox.Body>
        <InfoBox.Row>
          <LoadingItem loading={loading} loadProps={{ height: 24, width: 100 }}>
            <InfoBox.Key>In my Wallet</InfoBox.Key>
          </LoadingItem>
          <InfoBox.Value>{displayTV(position?.external)}</InfoBox.Value>
        </InfoBox.Row>
        {!loading && isWhitelisted ? (
          <>
            <InfoBox.Row>
              <InfoBox.Key>
                <TooltipContainer>
                  In the Beanstalk Silo
                  <Tooltip
                    content={
                      <div className="tooltip-content">
                        {sdkToken?.symbol} LP token holders can Deposit their LP tokens in the{" "}
                        <a
                          className="underline"
                          href="https://app.bean.money/#/silo"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Beanstalk Silo
                        </a>
                        &nbsp;for yield.
                      </div>
                    }
                    offsetX={-40}
                    offsetY={350}
                    side="bottom"
                    arrowSize={0}
                    arrowOffset={0}
                    width={270}
                  >
                    <Info color="#4b5563" />
                  </Tooltip>
                </TooltipContainer>
              </InfoBox.Key>
              <InfoBox.Value>{displayTV(position?.silo)}</InfoBox.Value>
            </InfoBox.Row>
            <InfoBox.Row>
              <InfoBox.Key>
                <TooltipContainer>
                  In my Beanstalk Farm Balance
                  <Tooltip
                    content={
                      <div className="tooltip-content">
                        <a
                          className="underline"
                          href="https://app.bean.money/#/balances"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Farm Balances
                        </a>
                        &nbsp;allow Beanstalk users to hold assets in the protocol on their behalf.
                        Using Farm Balances can reduce gas costs and facilitate efficient movement
                        of assets within Beanstalk.
                      </div>
                    }
                    offsetX={-40}
                    offsetY={525}
                    arrowOffset={0}
                    side="bottom"
                    arrowSize={0}
                    width={270}
                  >
                    <Info color="#4b5563" />
                  </Tooltip>
                </TooltipContainer>
              </InfoBox.Key>
              <InfoBox.Value>{displayTV(position?.internal)}</InfoBox.Value>
            </InfoBox.Row>
          </>
        ) : null}
      </InfoBox.Body>
      <InfoBox.Footer>
        <USDWrapper>
          <LoadingItem loading={loading} loadProps={{ height: 24, width: 100 }}>
            {isWhitelisted ? (
              <Tooltip
                {...tooltipProps}
                content={
                  <Breakdown>
                    <BreakdownRow>
                      {"Wallet: "}
                      <div>${externalUSD.toHuman("short")}</div>
                    </BreakdownRow>
                    <BreakdownRow>
                      {"Silo Deposits: "}
                      <div>${siloUSD.toHuman("short")}</div>
                    </BreakdownRow>
                    <BreakdownRow>
                      {"Farm Balance: "}
                      <div>${internalUSD.toHuman("short")}</div>
                    </BreakdownRow>
                  </Breakdown>
                }
              >
                <>USD TOTAL: {USDTotal.gt(0) ? formatUSD(USDTotal) : "$--"}</>
              </Tooltip>
            ) : (
              <>USD TOTAL: {USDTotal.gt(0) ? formatUSD(USDTotal) : "$--"}</>
            )}
          </LoadingItem>
        </USDWrapper>
      </InfoBox.Footer>
    </InfoBox>
  );
};

const BoxHeader = styled.div`
  ${BodyCaps}
  min-height: 24px;
  ${mediaQuery.sm.only} {
    ${BodyS}
  }
`;

const BoxHeaderAmount = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  ${LinksButtonText}
`;

const USDWrapper = styled.div`
  display: flex;
  flex: 2;
  justify-content: flex-end;
  gap: 8px;
  color: #4b5563;
  cursor: pointer;
`;

const Breakdown = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const BreakdownRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 4px;
`;

const TooltipContainer = styled.div`
  display: inline-flex;
  gap: 4px;

  .tooltip-content {
    ${BodyXS}
  }

  .underline {
    text-decoration: underline;

    &:visited {
      color: #fff;
    }
  }
`;
