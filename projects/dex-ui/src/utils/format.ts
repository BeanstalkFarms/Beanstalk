import { TokenValue } from "@beanstalk/sdk";
/**
 * We can for the most part use TokenValue.toHuman("short"),
 * but we can use this in cases where we don't want the shorthand K/M/B/T suffixes.
 * We use Number.toLocaleString() instead of Number.toFixed() as it includes thousands separators
 */
export const formatNum = (
  val: string | number | TokenValue | undefined,
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
