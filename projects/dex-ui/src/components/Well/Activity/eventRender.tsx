import { Well } from "@beanstalk/sdk/Wells";
import React from "react";
import { AddEvent, EVENT_TYPE, RemoveEvent, SwapEvent, WellEvent } from "src/wells/useWellHistory";
import { Row, Td } from "../Table";
import { TokenValue } from "@beanstalk/sdk";
import styled from "styled-components";
import { size } from "src/breakpoints";

export const renderEvent = (event: WellEvent, well: Well, tokenPrices: (TokenValue | null)[]) => {
  let action;
  let description;
  let valueUSD;
  let time = formatTime(event.timestamp);
  var accumulator = TokenValue.ZERO;
  switch (event.type) {
    case EVENT_TYPE.SWAP:
      event = event as SwapEvent;
      action = "Swap";
      valueUSD = `$${event.fromAmount
        .mul(tokenPrices[0] || 0)
        .add(event.toAmount.mul(tokenPrices[1] || 0))
        .toHuman("short")}`;
      description = `${event.fromAmount.toHuman("short")} ${event.fromToken.symbol} for ${event.toAmount.toHuman("short")} ${
        event.toToken.symbol
      }`;

      break;
    case EVENT_TYPE.ADD_LIQUIDITY:
      event = event as AddEvent;
      action = "Add Liquidity";
      event.tokenAmounts.forEach(function (amount, i) {
        accumulator = accumulator.add(amount.mul(tokenPrices[i] || 0));
      });
      valueUSD = `$${accumulator.toHuman("short")}`;
      description = event.tokenAmounts
        .map((amount, i) => {
          return `${amount.toHuman("short")} ${well.tokens![i].symbol}`;
        })
        .join(" and ");
      break;
    case EVENT_TYPE.REMOVE_LIQUIDITY:
      event = event as RemoveEvent;
      action = "Remove Liquidity";
      event.tokenAmounts.forEach(function (amount, i) {
        accumulator = accumulator.add(amount.mul(tokenPrices[i] || 0));
      });
      valueUSD = `$${accumulator.toHuman("short")}`;
      description = event.tokenAmounts
        .map((amount, i) => {
          return `${amount.toHuman("short")} ${well.tokens![i].symbol}`;
        })
        .join(" and ");
      break;
  }
  return (
    <Row key={event.tx}>
      <Td>
        <Action>{action}</Action>
      </Td>
      <DesktopOnlyTd align={"right"}>{valueUSD}</DesktopOnlyTd>
      <DesktopOnlyTd align={"right"}>{description}</DesktopOnlyTd>
      <Td align={"right"}>{time || event.block}</Td>
    </Row>
  );
};

const Action = styled.div`
  color: #4b5563;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 0.5px;
`;

const DesktopOnlyTd = styled(Td)`
  @media (max-width: ${size.mobile}) {
    display: none;
  }
`;

const formatTime = (timestamp?: number) => {
  if (!timestamp) return null;
  const currentDate = new Date();
  currentDate.setTime(timestamp * 1000);
  return currentDate.toLocaleString();
};
