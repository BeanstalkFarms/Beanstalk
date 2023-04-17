import { ethers } from "ethers";
import { Event } from "./processor";

export enum EventType {
  SILO = "silo",
  FIELD = "filed",
  FERTILIER = "fertilizer",
  MARKET = "market"
}

export const sortEvents = (a: Event, b: Event) => {
  const diff = a.blockNumber - b.blockNumber;
  if (diff !== 0) return diff;
  return a.logIndex - b.logIndex;
};

export const reduceEvent = (prev: Event[], e: ethers.Event) => {
  try {
    prev.push({
      event: e.event,
      args: e.args,
      blockNumber: e.blockNumber,
      logIndex: e.logIndex,
      transactionHash: e.transactionHash,
      transactionIndex: e.transactionIndex
    });
  } catch (err) {
    console.error(`Failed to parse event ${e.event} ${e.transactionHash}`, err, e);
  }
  return prev;
};
