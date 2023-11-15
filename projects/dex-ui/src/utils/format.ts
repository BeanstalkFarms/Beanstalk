import { Token, TokenValue } from "@beanstalk/sdk";

type NumberPrimitive = string | number | TokenValue | undefined;

/**
 * We can for the most part use TokenValue.toHuman("short"),
 * but we can use this in cases where we don't want the shorthand K/M/B/T suffixes.
 * We use Number.toLocaleString() instead of Number.toFixed() as it includes thousands separators
 */
export const formatNum = (
  val: NumberPrimitive,
  options?: {
    defaultValue?: string;
    minDecimals?: number;
    maxDecimals?: number;
  }
) => {
  if (val === undefined) return options?.defaultValue || "-.--";

  const normalised = val instanceof TokenValue ? val.toHuman() : val.toString();

  return Number(normalised).toLocaleString("en-US", {
    minimumFractionDigits: 0 || options?.minDecimals,
    maximumFractionDigits: 2 || options?.maxDecimals
  });
};

export const formatUSD = (
  val: NumberPrimitive,
  options?: {
    defaultValue: string;
  }
) => {
  return `$${formatNum(val || TokenValue.ZERO, { minDecimals: 2, maxDecimals: 2, ...options })}`;
};

const TokenSymbolMap = {
  BEANWETHCP2w: "BEANETH LP"
};
export const displayTokenSymbol = (token: Token) => {
  if (token.symbol in TokenSymbolMap) {
    return TokenSymbolMap[token.symbol as keyof typeof TokenSymbolMap];
  }

  return token.symbol;
};
