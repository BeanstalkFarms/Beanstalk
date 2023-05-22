import { Well } from "@beanstalk/sdk/Wells";
import React from "react";
import { AddEvent, EVENT_TYPE, RemoveEvent, SwapEvent, WellEvent } from "src/wells/useWellHistory";
import { Row, Td } from "../Table";

export const renderEvent = (event: WellEvent, well: Well) => {
  let action;
  let description;
  let time = formatTime(event.timestamp);
  switch (event.type) {
    case EVENT_TYPE.SWAP:
      event = event as SwapEvent;
      action = "Swap";
      description = `${event.fromAmount.toHuman("0.0a")} ${event.fromToken.symbol} for ${event.toAmount.toHuman("0.0a")} ${
        event.toToken.symbol
      }`;

      break;
    case EVENT_TYPE.ADD_LIQUIDITY:
      event = event as AddEvent;
      action = "Add Liquidity";

      description = event.tokenAmounts
        .map((amount, i) => {
          return `${amount.toHuman("0.0a")} ${well.tokens![i].symbol}`;
        })
        .join(" and ");
      break;
    case EVENT_TYPE.REMOVE_LIQUIDITY:
      event = event as RemoveEvent;
      action = "Remove Liquidity";
      description = event.tokenAmounts
        .map((amount, i) => {
          return `${amount.toHuman("0.0a")} ${well.tokens![i].symbol}`;
        })
        .join(" and ");
      break;
  }
  return (
    <Row key={event.tx}>
      <Td>{action}</Td>
      <Td>-</Td>
      <Td>{description}</Td>
      <Td>{time || event.block}</Td>
    </Row>
  );
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return null;
  const currentDate = new Date();
  currentDate.setTime(timestamp * 1000);
  return currentDate.toLocaleString();
};
