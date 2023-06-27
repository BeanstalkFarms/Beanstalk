import React from "react";
import { ExpandBox } from "src/components/ExpandBox";
import styled from "styled-components";
import { FC } from "src/types";

type Props = {
  width?: number;
};

function PumpDetails() {
  return (
    <TextContainer>
      <div>A Pump is an Oracle that integrates with a Well.</div>
      <div>Depending on their use case, developers can define the conditions under which their Well should write new reserves pricing data to the Pump, which can be used as a token price feed.</div>
      <div>Check out this <StyledLink href="https://app.bean.money/">multi-block MEV manipulation resistant Pump</StyledLink> developed by Beanstalk Farms!</div>
    </TextContainer>
  );
};

export const LearnPump: FC<Props> = ({ width }) => {
  return (
    <ExpandBox width={width || 408}>
      <ExpandBox.Header>
        <span role="img" aria-label="glass globe emoji">
          🔮
        </span>{" "}
        What’s a pump?
      </ExpandBox.Header>
      <ExpandBox.Body><PumpDetails /></ExpandBox.Body>
    </ExpandBox>
  );
};

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #4B5563;
`;

const StyledLink = styled.a`
  font-weight: 600;
  color: #4B5563;
  text-decoration-thickness: 1px;
`;