import React, { useMemo } from "react";
import styled from "styled-components";

import { TokenValue } from "@beanstalk/sdk";
import { Well } from "@beanstalk/sdk/Wells";

import { mediaQuery, size } from "src/breakpoints";
import { BodyCaps, BodyS, BodyXS, LinksButtonText, TextNudge } from "src/components/Typography";
import { InfoBox } from "src/components/InfoBox";
import { TokenLogo } from "src/components/TokenLogo";
import { Tooltip } from "src/components/Tooltip";
import { FC } from "src/types";
import { formatUSD } from "src/utils/format";

import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import { useLPPositionSummary } from "src/tokens/useLPPositionSummary";
import { useBeanstalkSiloWhitelist } from "src/wells/useBeanstalkSiloWhitelist";

type Props = {
  well: Well | undefined;
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

export const LiquidityBox: FC<Props> = (props) => {
  const well = useMemo(() => props.well, [props.well]);

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
          <BoxHeader>My Liquidity</BoxHeader>
        </TextNudge>
        <BoxHeaderAmount>
          <TokenLogo token={well!.lpToken} size={16} mobileSize={16} isLP />
          <TextNudge amount={1.5}>{displayTV(position?.total)}</TextNudge>
        </BoxHeaderAmount>
      </InfoBox.Header>
      <InfoBox.Body>
        <InfoBox.Row>
          <InfoBox.Key>In my Wallet</InfoBox.Key>
          <InfoBox.Value>{displayTV(position?.external)}</InfoBox.Value>
        </InfoBox.Row>
        {isWhitelisted ? (
          <>
            <InfoBox.Row>
              <InfoBox.Key>Deposited in the Silo</InfoBox.Key>
              <InfoBox.Value>{displayTV(position?.silo)}</InfoBox.Value>
            </InfoBox.Row>
            <InfoBox.Row>
              <InfoBox.Key>In my Farm Balance</InfoBox.Key>
              <InfoBox.Value>{displayTV(position?.internal)}</InfoBox.Value>
            </InfoBox.Row>
          </>
        ) : null}
      </InfoBox.Body>
      <InfoBox.Footer>
        <USDWrapper>
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
              USD TOTAL: {formatUSD(USDTotal)}
            </Tooltip>
          ) : (
            <>USD TOTAL: {formatUSD(USDTotal)}</>
          )}
        </USDWrapper>
      </InfoBox.Footer>
    </InfoBox>
  );
};

const BoxHeader = styled.div`
  ${BodyCaps}
  @media (max-width: ${size.mobile}) {
    ${BodyS}
  }
`;

const InfoText = styled.div`
  ${BodyS}
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
