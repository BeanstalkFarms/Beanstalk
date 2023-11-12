import React, { useMemo } from "react";
import styled from "styled-components";
import { InfoBox } from "src/components/InfoBox";
import { BodyCaps, BodyXS, LinksButtonText, TextNudge } from "../Typography";
import { TokenLogo } from "../TokenLogo";
import { FC } from "src/types";
import { TokenValue } from "@beanstalk/sdk";
import { useTokenBalance } from "src/tokens/useTokenBalance";
import { size } from "src/breakpoints";
import { useSiloBalance } from "src/tokens/useSiloBalance";
import { Well } from "@beanstalk/sdk/Wells";
import { formatNum } from "src/utils/format";
import { useWellLPTokenPrice } from "src/wells/useWellLPTokenPrice";
import useTokenBalanceInternal from "src/tokens/useTokenBalanceInternal";
import { Tooltip } from "../Tooltip";
type Props = {
  well: Well | undefined;
};

export const LiquidityBox: FC<Props> = ({ well }) => {
  const { data: balance } = useTokenBalance(well?.lpToken!);
  const { data: siloBalance } = useSiloBalance(well?.lpToken!);
  const { data: internalBalance } = useTokenBalanceInternal(well?.lpToken);

  /// memoize here to prevent new arr instances when passing into useWellLPTokenPrice
  const { data: lpTokenPriceMap } = useWellLPTokenPrice(useMemo(() => [well], [well]));

  const lpSymbol = well?.lpToken?.symbol;
  const lpAddress = well?.lpToken?.address;

  const lpTokenPrice = lpAddress && lpAddress in lpTokenPriceMap ? lpTokenPriceMap[lpAddress] : TokenValue.ZERO;

  const lp = {
    silo: lpSymbol && siloBalance ? siloBalance : TokenValue.ZERO,
    wallet: lpSymbol && balance ? balance?.[lpSymbol] : TokenValue.ZERO,
    farm: lpSymbol && internalBalance ? internalBalance : TokenValue.ZERO
  };

  const usd = {
    silo: lp.silo.mul(lpTokenPrice),
    wallet: lp.wallet.mul(lpTokenPrice),
    farm: lp.farm.mul(lpTokenPrice)
  };

  const lpTotal = lp.farm.add(lp.silo).add(lp.wallet);
  const USDTotal = usd.silo.add(usd.wallet).add(usd.farm);

  return (
    <InfoBox>
      <InfoBox.Header>
        <TextNudge amount={0} mobileAmount={2}>
          <BoxHeader>My Liquidity</BoxHeader>
        </TextNudge>
        <BoxHeaderAmount>
          <TokenLogo token={well!.lpToken} size={16} mobileSize={16} isLP />
          <TextNudge amount={1.5}>{lpTotal.gt(0) ? lpTotal.toHuman("short") : "-"}</TextNudge>
        </BoxHeaderAmount>
      </InfoBox.Header>
      <InfoBox.Body>
        <InfoBox.Row>
          <InfoBox.Key>In my Wallet</InfoBox.Key>
          <InfoBox.Value>{lp.wallet.gt(0) ? lp.wallet.toHuman("short") : "-"}</InfoBox.Value>
        </InfoBox.Row>
        <InfoBox.Row>
          <InfoBox.Key>Deposited in the Silo</InfoBox.Key>
          <InfoBox.Value>{lp.silo.gt(0) ? lp.silo.toHuman("short") : "-"}</InfoBox.Value>
        </InfoBox.Row>
        <InfoBox.Row>
          <InfoBox.Key>In my Farm Balance</InfoBox.Key>
          <InfoBox.Value>{lp.farm.gt(0) ? lp.farm.toHuman("short") : "-"}</InfoBox.Value>
        </InfoBox.Row>
      </InfoBox.Body>
      <InfoBox.Footer>
        <USDWrapper>
          <Tooltip
            offsetX={-20}
            offsetY={375}
            arrowSize={4}
            arrowOffset={95}
            side={"top"}
            width={175}
            content={
              <Breakdown>
                <BreakdownRow>
                  {"Wallet: "}
                  <div>${usd.wallet.toHuman("short")}</div>
                </BreakdownRow>
                <BreakdownRow>
                  {"Silo Deposits: "}
                  <div>${usd.silo.toHuman("short")}</div>
                </BreakdownRow>
                <BreakdownRow>
                  {"Farm Balance: "}
                  <div>${usd.farm.toHuman("short")}</div>
                </BreakdownRow>
              </Breakdown>
            }
          >
            USD TOTAL: ${formatNum(USDTotal, { defaultValue: "-", minDecimals: 2 })}
          </Tooltip>
        </USDWrapper>
      </InfoBox.Footer>
    </InfoBox>
  );
};

const BoxHeader = styled.div`
  ${BodyCaps}
  @media (max-width: ${size.mobile}) {
    ${BodyXS}
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
