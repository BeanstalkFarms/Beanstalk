import React from "react";
import styled from "styled-components";
import { InfoBox } from "src/components/InfoBox";
import { BodyCaps, LinksButtonText } from "../Typography";
import { TokenLogo } from "../TokenLogo";
import { FC } from "src/types";
import { Token } from "@beanstalk/sdk";
import { useTokenBalance } from "src/tokens/useTokenBalance";

type Props = {
  lpToken: Token;
  width?: number;
};

export const LiquidityBox: FC<Props> = ({ lpToken, width }) => {

  const { data: balance } = useTokenBalance(lpToken);

  return (
    <InfoBox width={width || 408}>
      <InfoBox.Header>
        <BoxHeader>My Liquidity</BoxHeader>
        <BoxHeaderAmount>
          <TokenLogo token={lpToken} size={16} isLP />
          {balance ? balance[lpToken.symbol].toHuman() : '-'}
        </BoxHeaderAmount>
      </InfoBox.Header>
      <InfoBox.Body>
        <InfoBox.Row>
          <InfoBox.Key>In my Wallet</InfoBox.Key>
          <InfoBox.Value>{balance ? balance[lpToken.symbol].toHuman() : '-'}</InfoBox.Value>
        </InfoBox.Row>
        <InfoBox.Row>
          <InfoBox.Key>Deposited in the Silo</InfoBox.Key>
          <InfoBox.Value>-</InfoBox.Value>
        </InfoBox.Row>
      </InfoBox.Body>
      {/* <InfoBox.Footer>
        <FooterAmount>USD Total: $69,420</FooterAmount>
      </InfoBox.Footer> */}
    </InfoBox>
  );
};

const BoxHeader = styled.div`
  ${BodyCaps}
`;
const BoxHeaderAmount = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  ${LinksButtonText}
`;
