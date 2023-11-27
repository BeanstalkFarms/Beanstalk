import React, { useMemo } from "react";
import styled from "styled-components";

import { TokenValue } from "@beanstalk/sdk";

import { mediaQuery } from "src/breakpoints";
import { BodyCaps, BodyS, BodyXS, LinksButtonText, TextNudge } from "src/components/Typography";
import { InfoBox } from "src/components/InfoBox";
import { TokenLogo } from "src/components/TokenLogo";
import { Tooltip } from "src/components/Tooltip";
import { FC } from "src/types";
import { formatUSD } from "src/utils/format";

import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { useLPPositionSummary } from "src/tokens/useLPPositionSummary";
import { useBeanstalkSiloWhitelist } from "src/wells/useBeanstalkSiloWhitelist";
import { LoadingItem } from "src/components/LoadingItem";
import { Well } from "@beanstalk/sdk/Wells";
import { Info } from "../Icons";

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

export const LiquidityBox: FC<Props> = ({ well: _well, loading }) => {
  const well = useMemo(() => _well, [_well]);

  const { getPositionWithWell } = useLPPositionSummary();
  const { getIsWhitelisted } = useBeanstalkSiloWhitelist();

  const position = getPositionWithWell(well);
  const isWhitelisted = getIsWhitelisted(well);

  const { data: lpTokenPriceMap } = useWellLPTokenPrice(well);

  const lpAddress = well?.lpToken?.address;
  const lpTokenPrice = lpAddress && lpAddress in lpTokenPriceMap ? lpTokenPriceMap[lpAddress] : TokenValue.ZERO;

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
                        BEANETH LP token holders can Deposit their LP tokens{" "}
                        <a className="underline" href="https://app.bean.money/#/balances" target="_blank" rel="noopener noreferrer">
                          in the Beanstalk Silo
                        </a>
                        &nbsp;for yield.
                      </div>
                    }
                    offsetX={0}
                    offsetY={0}
                    side="bottom"
                    arrowSize={4}
                    arrowOffset={50}
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
                        <a className="underline" href="https://app.bean.money/#/balances" target="_blank" rel="noopener noreferrer">
                          Farm Balance
                        </a>
                        &nbsp;allows users of the Beanstalk protocol to hold assets without needing to withdraw to an external wallet. Using
                        Farm Balances can help reduce gas costs and efficient movement of assets within Beanstalk.
                      </div>
                    }
                    offsetX={0}
                    offsetY={0}
                    arrowOffset={50}
                    side="bottom"
                    arrowSize={4}
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
                <>USD TOTAL: {formatUSD(USDTotal)}</>
              </Tooltip>
            ) : (
              <>USD TOTAL: {formatUSD(USDTotal)}</>
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
