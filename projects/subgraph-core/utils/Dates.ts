import { BigInt } from "@graphprotocol/graph-ts";

/**
 * Optionally accepts an offset, which adjusts the start of the day from UTC 00:00.
 * @param timestamp - the timestamp to extract the day from
 * @param offset - how much sooner the day should roll over (relative to UTC)
 *  for example, for PST (UTC-7), an appropriate offset would be -7 * 60 * 60.
 *  This would make the day roll over 7 hours later.
 */
export function dayFromTimestamp(timestamp: BigInt, offset: i32 = 0): i32 {
  let day_ts = timestamp.toI32() + offset - ((timestamp.toI32() + offset) % 86400);
  return day_ts / 86400;
}

export function hourFromTimestamp(timestamp: BigInt): i32 {
  let day_ts = timestamp.toI32() - (timestamp.toI32() % 3600);
  return day_ts / 3600;
}
