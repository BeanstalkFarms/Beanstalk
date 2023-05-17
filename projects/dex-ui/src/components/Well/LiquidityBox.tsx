import React from "react";
import styled from "styled-components";
import { InfoBox } from "src/components/InfoBox";
import { BodyCaps, LinksButtonText } from "../Typography";
import { TokenLogo } from "../TokenLogo";
import { FC } from "src/types";
import { Token } from "@beanstalk/sdk";

type Props = {
  lpToken: Token;
};

export const LiquidityBox: FC<Props> = ({ lpToken }) => {
  return (
    <InfoBox width={408}>
      <InfoBox.Header>
        <BoxHeader>My Liquidity</BoxHeader>
        <BoxHeaderAmount>
          <TokenLogo token={lpToken} size={16} isLP />
          69,420,000
        </BoxHeaderAmount>
      </InfoBox.Header>
      <InfoBox.Body>
        <InfoBox.Row>
          <InfoBox.Key>In my Wallet</InfoBox.Key>
          <InfoBox.Value>-</InfoBox.Value>
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
const FooterAmount = styled.div`
  display: flex;
  ${BodyCaps}
  align-self: flex-end;
  flex: 2;
  justify-content: flex-end;
`;
