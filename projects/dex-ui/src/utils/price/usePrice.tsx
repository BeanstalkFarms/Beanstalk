import { BeanstalkSDK, Token, TokenValue } from "@beanstalk/sdk";
import { PriceLookups } from "./priceLookups";
import { Log } from "../logger";

export const getPrice = async (token: Token, sdk: BeanstalkSDK): Promise<TokenValue | null> => {
  const lookupFn = PriceLookups[token!.symbol];

  try {
    if (lookupFn) {
      const price = await lookupFn(sdk);
      Log.module("price").debug(`${token.symbol} price is `, price.toHuman());
      return price;
    } else {
      Log.module("price").log(`No price lookup function for ${token?.symbol}`);
      return null;
    }
  } catch (err) {
    Log.module("price").error(`Error looking up ${token.symbol} price: `, err);
  }

  return null;
};
