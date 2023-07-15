import { BigInt } from "@graphprotocol/graph-ts";

export function dayFromTimestamp(timestamp: BigInt): i32 {
  let day_ts = timestamp.toI32() - (timestamp.toI32() % 86400);
  return day_ts / 86400;
}

export function hourFromTimestamp(timestamp: BigInt): i32 {
  let day_ts = timestamp.toI32() - (timestamp.toI32() % 3600);
  return day_ts / 3600;
}
