import React from "react";
import styled from "styled-components";
import { BodyL, BodyS, TextNudge } from "../Typography";
import { FC } from "src/types";
import { Token, TokenValue } from "@beanstalk/sdk";
import { TokenLogo } from "../TokenLogo";
import { Item, Row } from "../Layout";
import { size } from "src/breakpoints";
import { formatNum, formatPercent } from "src/utils/format";

import { MultiFlowPumpTooltip } from "./MultiFlowPumpTooltip";
import { Well } from "@beanstalk/sdk/Wells";

export type ReservesProps = {
  well: Well | undefined;
  reserves: {
    token: Token;
    amount: TokenValue;
    dollarAmount: TokenValue | null;
    percentage: TokenValue | null;
  }[];
};

export const Reserves: FC<ReservesProps> = ({ reserves, well }) => {
  if (!well) return null;

  const rows = (reserves ?? []).map((r, i) => (
    <Item key={i} column>
      <Symbol>
        {r.token?.symbol}
        <div className="info-icon">
          <MultiFlowPumpTooltip well={well} />
        </div>
      </Symbol>
      <Wrapper>
        <TokenLogo token={r.token} size={16} mobileSize={16} />
        <TextNudge amount={2}>
          <Amount>{formatNum(r.amount, { minDecimals: 2 })}</Amount>
        </TextNudge>
        <TextNudge amount={2}>
          <Percent>{formatPercent(r.percentage)}</Percent>
        </TextNudge>
      </Wrapper>
    </Item>
  ));

  return <Row gap={24}>{rows}</Row>;
};

const Symbol = styled.div`
  display: inline-flex;
  flex-direction: row;

  ${BodyL}
  color: #4B5563;
  @media (max-width: ${size.mobile}) {
    ${BodyS}
  }

  .info-icon {
    margin-left: 6px;
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
  @media (max-width: ${size.mobile}) {
    ${BodyS}
    font-weight: 600;
  }
`;
const Percent = styled.div`
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
  text-align: right;
  color: #9ca3af;
  @media (max-width: ${size.mobile}) {
    ${BodyS}
  }
`;
