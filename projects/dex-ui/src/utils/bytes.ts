import { ethers } from "ethers";

export function getBytesHexString(value: string | number, padding?: number) {
  const bigNumber = ethers.BigNumber.from(value.toString());
  const hexStr = bigNumber.toHexString();
  if (!padding) return hexStr;

  return ethers.utils.hexZeroPad(bigNumber.toHexString(), padding);
}

export function convertBytes32ToString(bytes32Value: string): string {
  const cleanBytes32 = bytes32Value.startsWith("0x") ? bytes32Value.slice(2) : bytes32Value;
  const trimmedBytes32 = cleanBytes32.replace(/0+$/, "");
  if (trimmedBytes32.length === 0) {
    return "";
  }

  try {
    const paddedBytes32 = trimmedBytes32.padEnd(64, "0");
    return ethers.utils.parseBytes32String("0x" + paddedBytes32);
  } catch (error) {
    console.error("Error converting bytes32 to string:", error);
    return "";
  }
}
