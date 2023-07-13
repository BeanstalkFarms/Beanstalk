import React from "react";
import styled from "styled-components";
import { BodyL, BodyXS, TextNudge } from "../Typography";
import { FC } from "src/types";
import { Token, TokenValue } from "@beanstalk/sdk";
import { TokenLogo } from "../TokenLogo";
import { Item, Row } from "../Layout";

type Props = {
  reserves: {
    token: Token;
    amount: TokenValue;
    dollarAmount: TokenValue | null;
    percentage: TokenValue | null;
  }[];
};
export const Reserves: FC<Props> = ({ reserves }) => {
  const rows = (reserves ?? []).map((r, i) => (
    <Item key={i} column>
      <Symbol>{r.token?.symbol}</Symbol>
      <Wrapper>
        <TokenLogo token={r.token} size={16} mobileSize={16} />
        <TextNudge amount={2}>
          <Amount>{r.amount.toHuman("short")}</Amount>
        </TextNudge>
        <TextNudge amount={2}>
          <Percent>{`(${r.percentage?.mul(100).toHuman("short")}%)`}</Percent>
        </TextNudge>
      </Wrapper>
    </Item>
  ));

  return <Row gap={24}>{rows}</Row>;
};

const Symbol = styled.div`
  ${BodyL}
  color: #4B5563;
  @media (max-width: 475px) {
    ${BodyXS}
  }
`;
const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 4px;
  align-items: center;
`;
const Amount = styled.div`
  font-weight: 600;
  font-size: 20px;
  line-height: 24px;
  text-align: right;
  color: #000000;
  @media (max-width: 475px) {
    ${BodyXS}
    font-weight: 600;
  }
`;
const Percent = styled.div`
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
  text-align: right;
  color: #9ca3af;
  @media (max-width: 475px) {
    ${BodyXS}
  }
`;
