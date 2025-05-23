import React from "react";

import { Well } from "@beanstalk/sdk/Wells";
import styled from "styled-components";

import { Token, TokenValue } from "@beanstalk/sdk";

import { size } from "src/breakpoints";
import { FC } from "src/types";
import { formatNum, formatPercent } from "src/utils/format";
import { useIsMobile } from "src/utils/ui/useIsMobile";
import { useIsMultiFlowPump } from "src/wells/pump/utils";

import { MultiFlowPumpTooltip } from "./MultiFlowPumpTooltip";
import { Item, Row } from "../Layout";
import { TokenLogo } from "../TokenLogo";
import { TooltipProps } from "../Tooltip";
import { BodyL, BodyS, TextNudge } from "../Typography";

export type ReservesProps = {
  well: Well | undefined;
  reserves: {
    token: Token;
    amount: TokenValue;
    dollarAmount: TokenValue | null;
    percentage: TokenValue | null;
  }[];
  twaReserves: TokenValue[] | undefined;
};

export const Reserves: FC<ReservesProps> = ({ reserves, well, twaReserves }) => {
  const isMobile = useIsMobile();
  const { isMultiFlow } = useIsMultiFlowPump(well);

  if (!well) return null;

  const noPriceData = reserves.some((rsv) => rsv.dollarAmount === null);

  const rows = (reserves ?? []).map((r, i) => (
    <Item key={i} column>
      <Symbol>
        {r.token?.symbol}
        {isMultiFlow && (
          <div className="info-icon">
            <MultiFlowPumpTooltip
              well={well}
              twaReserves={twaReserves}
              tooltipProps={getTooltipProps(isMobile, i)}
            />
          </div>
        )}
      </Symbol>
      <Wrapper>
        <TokenLogo token={r.token} size={16} mobileSize={16} />
        <TextNudge amount={2}>
          <Amount>{formatNum(r.amount, { minDecimals: 2, minValue: 0.001 })}</Amount>
        </TextNudge>
        {!noPriceData ? (
          <TextNudge amount={2}>
            <Percent>{formatPercent(r.percentage)}</Percent>
          </TextNudge>
        ) : null}
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

const baseTooltipProps = {
  offsetX: 0,
  offsetY: 0,
  arrowSize: 0,
  arrowOffset: 0,
  side: "top"
} as TooltipProps;

const getTooltipProps = (isMobile: boolean, index: number) => {
  const copy = { ...baseTooltipProps };
  if (!isMobile) return copy;

  copy.width = 300;

  if (index === 0) copy.offsetX = -15;
  else copy.offsetX = -70;

  return copy;
};
