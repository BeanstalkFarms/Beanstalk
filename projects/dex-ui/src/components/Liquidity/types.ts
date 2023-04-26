import { TokenValue } from "@beanstalk/sdk";

export enum REMOVE_LIQUIDITY_MODE {
  Balanced,
  OneToken,
  Custom
}

export type LiquidityAmounts = {
  [key: number]: TokenValue;
};
