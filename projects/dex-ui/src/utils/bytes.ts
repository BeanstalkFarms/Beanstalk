import { ethers } from "ethers";

export function getBytesHexString(value: string | number, padding?: number) {
  const bigNumber = ethers.BigNumber.from(value.toString());
  const hexStr = bigNumber.toHexString();
  if (!padding) return hexStr;

  return ethers.utils.hexZeroPad(bigNumber.toHexString(), padding);
}
