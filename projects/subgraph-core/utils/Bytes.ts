import { BigInt, Bytes } from "@graphprotocol/graph-ts";

// If all zeros are provided, convert into a null. Otherwise return the provided value
export function Bytes4_emptyToNull(b: Bytes): Bytes | null {
  return b == Bytes.fromHexString("0x00000000") ? null : b;
}

// For using the graph's Bytes in big endian format
export function BigInt_bigEndian(s: string): BigInt {
  return BigInt.fromUnsignedBytes(Bytes_bigEndian(s));
}

export function Bytes_bigEndian(s: string): Bytes {
  return Bytes.fromUint8Array(Bytes.fromHexString(s).reverse());
}
