import { Token, TokenValue } from "@beanstalk/sdk";

type NumberPrimitive = string | number | TokenValue | undefined | null;

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
  if (val === undefined || val === null) return options?.defaultValue || "-.--";

  const normalised = val instanceof TokenValue ? val.toHuman() : val.toString();

  return Number(normalised).toLocaleString("en-US", {
    minimumFractionDigits: options?.minDecimals || 0,
    maximumFractionDigits: options?.maxDecimals || 2
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

const normaliseAsTokenValue = (val: NumberPrimitive) => {
  if (val instanceof TokenValue) return val;
  const num = val ? (typeof val === "string" ? Number(val) : val) : 0;
  return TokenValue.ZERO.add(num);
};

/**
 * Formats a number as a percentage.
 * - If value to format is 0.01, it will be formatted as 1.00%.
 * - If value is undefined, it will be formatted as "--%" or options.defaultValue.
 * - If value is < (0.0001) (0.01%), it will be formatted as "<0.01%"
 */
export const formatPercent = (val: NumberPrimitive, options?: { defaultValue: string }) => {
  if (!val) return `${options?.defaultValue || "--"}%`;

  const pct = normaliseAsTokenValue(val).mul(100);

  if (pct.lt(0.01)) return "<0.01%";

  return `${formatNum(pct, { minDecimals: 2, maxDecimals: 2, ...options })}%`;
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
