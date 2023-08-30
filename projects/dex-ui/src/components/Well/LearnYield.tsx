import React from "react";
import styled from "styled-components";
import { ExpandBox } from "src/components/ExpandBox";
import { TextNudge } from "../Typography";
import { FC } from "src/types";
import { YieldSparkle } from "../Icons";

type Props = {};

function YieldDetails() {
  return (
    <TextContainer>
      <div>
        The BEAN:WETH Well has <strong>zero</strong> trading fees!
      </div>
      <div>
        If <span><StyledLink href="https://app.bean.money/#/governance">BIP-37</StyledLink></span> passes, Beanstalk will 
        issue Stalk and Seeds to users who Deposit LP tokens in the Silo.
      </div>
      <div>
        Stalkholders receive Bean seigniorage. Check out 
        the <span><StyledLink href="https://docs.bean.money/almanac/farm/silo">Beanstalk docs.</StyledLink></span>
      </div>
    </TextContainer>
  );
}

export const LearnYield: FC<Props> = () => {
  return (
    <ExpandBox drawerHeaderText="How can I earn yield?">
      <ExpandBox.Header>
        <YieldSparkle />
        <TextNudge amount={1}>How can I earn yield?</TextNudge>
      </ExpandBox.Header>
      <ExpandBox.Body>
        <YieldDetails />
      </ExpandBox.Body>
    </ExpandBox>
  );
};

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #4b5563;
`;

const StyledLink = styled.a`
  font-weight: 600;
  color: #4b5563;
  text-decoration-thickness: 1px;
`;
