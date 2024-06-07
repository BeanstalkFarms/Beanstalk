import { ethers } from "ethers";

export function getBytesHexString(value: string | number, padding?: number) {
  const bigNumber = ethers.BigNumber.from(value.toString());
  const hexStr = bigNumber.toHexString();
  if (!padding) return hexStr;

  return ethers.utils.hexZeroPad(bigNumber.toHexString(), padding);
}

/**
 * @param value
 * @returns boolean
 *
 * returns whether or not the value is convertible to bytes.
 */
export function isConvertibleToBytes(
  value: number | ethers.utils.BytesLike | ethers.utils.Hexable | undefined | null
) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && !value) return false;
  if (typeof value === "number" && value < 0) return false;

  try {
    ethers.utils.arrayify(value);
    return true;
  } catch (e) {
    return false;
  }
}
