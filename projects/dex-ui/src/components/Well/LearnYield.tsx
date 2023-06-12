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
      <div>This Well has <strong>NO</strong> trading fees!</div> 
      <div>Instead, Beanstalk will issue Stalk rewards to users who Deposit LP Tokens.</div>
      <div>Stalk holders intermittently receive Beans as yield.</div>
      <StyledLink href="https://app.bean.money/">Add Liquidity and Deposit in one transaction using the Beanstalk site!</StyledLink>
    </TextContainer>
  );
};

export const LearnYield: FC<Props> = ({}) => {
  return (
    <ExpandBox width={408}>
      <ExpandBox.Header>
        <YieldSparkle />
        <TextNudge amount={1}>How can I earn yield?</TextNudge>
      </ExpandBox.Header>
      <ExpandBox.Body><YieldDetails /></ExpandBox.Body>
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