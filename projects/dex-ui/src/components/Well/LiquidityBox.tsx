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

type Props = {
  well: Well | undefined;
};

export const LiquidityBox: FC<Props> = ({ well }) => {
  const { data: balance } = useTokenBalance(well?.lpToken!);
  const { data: siloBalance } = useSiloBalance(well?.lpToken!);

  /// memoize here to prevent new arr instances when passing into useWellLPTokenPrice
  const wellArr = useMemo(() => [well], [well]);
  const { data: lpTokenPriceMap } = useWellLPTokenPrice(wellArr);

  const lpSymbol = well?.lpToken?.symbol;
  const lpAddress = well?.lpToken?.address;

  const lpTokenPrice = lpAddress && lpAddress in lpTokenPriceMap ? lpTokenPriceMap[lpAddress] : TokenValue.ZERO;

  const siloTokenBalance = lpSymbol && siloBalance ? siloBalance : TokenValue.ZERO;
  const lpBalance = lpSymbol && balance ? balance[lpSymbol] : TokenValue.ZERO;
  const ttlBalance = siloTokenBalance.add(lpBalance);
  const USDTotal = ttlBalance.mul(lpTokenPrice);

  return (
    <InfoBox>
      <InfoBox.Header>
        <TextNudge amount={0} mobileAmount={2}>
          <BoxHeader>My Liquidity</BoxHeader>
        </TextNudge>
        <BoxHeaderAmount>
          <TokenLogo token={well!.lpToken} size={16} mobileSize={16} isLP />
          <TextNudge amount={1.5}>{balance ? balance[well!.lpToken!.symbol].toHuman("short") : "-"}</TextNudge>
        </BoxHeaderAmount>
      </InfoBox.Header>
      <InfoBox.Body>
        <InfoBox.Row>
          <InfoBox.Key>In my Wallet</InfoBox.Key>
          <InfoBox.Value>{balance ? balance[well!.lpToken!.symbol].toHuman("short") : "-"}</InfoBox.Value>
        </InfoBox.Row>
        <InfoBox.Row>
          <InfoBox.Key>Deposited in the Silo</InfoBox.Key>
          <InfoBox.Value>{siloBalance ? siloBalance.toHuman("short") : "-"}</InfoBox.Value>
        </InfoBox.Row>
      </InfoBox.Body>
      <InfoBox.Footer>
        <USDAmount>USD TOTAL: ${formatNum(USDTotal, { defaultValue: "-", minDecimals: 2 })}</USDAmount>
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
const USDAmount = styled.div`
  display: flex;
  flex: 2;
  justify-content: flex-end;
  color: #4b5563;
`;
